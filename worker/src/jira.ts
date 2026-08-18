import type {
  JiraIssueContext,
  JiraTransition,
  JiraTransitionField,
  JiraTransitionFieldType,
  JiraTransitionFieldValue,
  JiraTransitionsResult,
} from '../../src/core/contracts';
import { WorkerHttpError } from './http';

export interface AtlassianTransport {
  readonly request: (path: string, init: RequestInit) => Promise<Response>;
}

const CONTEXT_FIELDS = [
  'summary',
  'description',
  'issuetype',
  'status',
  'priority',
  'assignee',
  'labels',
  'comment',
].join(',');
const EMAIL_LIKE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu;
const CONTENT_CHARACTER_LIMIT = 16_000;
const LABEL_TOTAL_LIMIT = 2_000;

export async function loadJiraContext(
  transport: AtlassianTransport,
  issueKey: string,
): Promise<JiraIssueContext> {
  const query = new URLSearchParams({ fields: CONTEXT_FIELDS });
  const response = await transport.request(
    `/rest/api/3/issue/${encodeURIComponent(issueKey)}?${query.toString()}`,
    { method: 'GET' },
  );
  await requireJiraSuccess(response);
  const body = await readJiraJson(response, 256 * 1_024);
  if (!isRecord(body) || !isRecord(body.fields) || body.key !== issueKey) {
    throw malformedJiraResponse();
  }
  const fields = body.fields;
  const title = nestedString(fields.summary);
  const issueType = objectName(fields.issuetype);
  const status = objectName(fields.status);
  if (title === null || issueType === null || status === null) {
    throw malformedJiraResponse();
  }
  const comments = normalizeComments(fields.comment);
  const titleText = truncate(redactEmailLike(title), 500);
  const labels = normalizeStringArray(fields.labels, 50, 255, LABEL_TOTAL_LIMIT);
  const descriptionBudget = Math.max(
    0,
    CONTENT_CHARACTER_LIMIT -
      titleText.length -
      labels.reduce((total, label) => total + label.length, 0) -
      comments.reduce((total, comment) => total + comment.length, 0),
  );
  return {
    issueKey,
    title: titleText,
    description: truncate(
      redactEmailLike(adfToPlainText(fields.description)),
      Math.min(12_000, descriptionBudget),
    ),
    issueType: truncate(redactEmailLike(issueType), 120),
    status: truncate(redactEmailLike(status), 120),
    priority: nullableObjectName(fields.priority, 120),
    assignee: nullableDisplayName(fields.assignee),
    labels,
    comments,
  };
}

export async function loadJiraTransitions(
  transport: AtlassianTransport,
  issueKey: string,
  currentStatus: string,
): Promise<JiraTransitionsResult> {
  const response = await transport.request(
    `/rest/api/3/issue/${encodeURIComponent(issueKey)}/transitions?expand=transitions.fields`,
    { method: 'GET' },
  );
  await requireJiraSuccess(response);
  const body = await readJiraJson(response, 512 * 1_024);
  if (!isRecord(body) || !Array.isArray(body.transitions) || body.transitions.length > 100) {
    throw malformedJiraResponse();
  }
  const transitions = body.transitions.map(normalizeTransition);
  if (transitions.some((transition) => transition === null)) {
    throw malformedJiraResponse();
  }
  return {
    issueKey,
    currentStatus: truncate(currentStatus, 120),
    transitions: transitions as JiraTransition[],
  };
}

export function buildTransitionPayload(
  transition: JiraTransition,
  values: Readonly<Record<string, JiraTransitionFieldValue>>,
  comment: string | undefined,
): Record<string, unknown> {
  if (transition.unsupportedRequiredFields.length > 0) {
    throw new WorkerHttpError(
      422,
      'JIRA_FIELD_VALIDATION',
      'This transition has required fields that must be completed in Jira.',
    );
  }
  const fieldsById = new Map(transition.fields.map((field) => [field.fieldId, field]));
  for (const fieldId of Object.keys(values)) {
    if (!fieldsById.has(fieldId)) {
      throw validationError();
    }
  }
  const fields: Record<string, unknown> = {};
  for (const field of transition.fields) {
    const value = values[field.fieldId];
    if (value === undefined) {
      if (field.required) {
        throw validationError();
      }
      continue;
    }
    fields[field.fieldId] = normalizeTransitionValue(field, value);
  }

  const payload: Record<string, unknown> = { transition: { id: transition.id }, fields };
  const normalizedComment = comment?.trim();
  if (normalizedComment !== undefined && normalizedComment !== '') {
    payload.update = {
      comment: [
        {
          add: {
            body: {
              type: 'doc',
              version: 1,
              content: [
                { type: 'paragraph', content: [{ type: 'text', text: normalizedComment }] },
              ],
            },
          },
        },
      ],
    };
  }
  return payload;
}

export async function executeJiraTransition(
  transport: AtlassianTransport,
  issueKey: string,
  payload: Readonly<Record<string, unknown>>,
): Promise<void> {
  let response: Response;
  try {
    response = await transport.request(
      `/rest/api/3/issue/${encodeURIComponent(issueKey)}/transitions`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );
  } catch (error) {
    if (
      error instanceof WorkerHttpError &&
      (error.code === 'JIRA_TIMEOUT' || error.code === 'JIRA_UPSTREAM_ERROR')
    ) {
      throw new WorkerHttpError(
        502,
        'AMBIGUOUS_WRITE_OUTCOME',
        'Jira may have applied the transition. Refresh before trying again.',
      );
    }
    throw error;
  }
  if (response.status === 204) {
    return;
  }
  if (response.status >= 500) {
    throw new WorkerHttpError(
      502,
      'AMBIGUOUS_WRITE_OUTCOME',
      'Jira may have applied the transition. Refresh before trying again.',
    );
  }
  await requireJiraSuccess(response);
  throw malformedJiraResponse();
}

async function requireJiraSuccess(response: Response): Promise<void> {
  if (response.ok) {
    return;
  }
  const mapping: Partial<
    Record<number, [number, ConstructorParameters<typeof WorkerHttpError>[1], string]>
  > = {
    400: [422, 'JIRA_FIELD_VALIDATION', 'Jira rejected one or more transition fields.'],
    401: [401, 'SESSION_EXPIRED', 'Connect Jira again to continue.'],
    403: [403, 'JIRA_FORBIDDEN', 'Jira did not allow this operation.'],
    404: [404, 'JIRA_NOT_FOUND', 'The Jira issue was not found.'],
    409: [409, 'JIRA_TRANSITION_STALE', 'The Jira transition changed. Refresh and try again.'],
    422: [422, 'JIRA_FIELD_VALIDATION', 'Jira rejected one or more transition fields.'],
    429: [429, 'JIRA_RATE_LIMIT', 'Jira rate limit reached. Try again later.'],
  };
  const mapped = mapping[response.status];
  if (mapped !== undefined) {
    throw new WorkerHttpError(...mapped);
  }
  throw new WorkerHttpError(502, 'JIRA_UPSTREAM_ERROR', 'Jira is temporarily unavailable.');
}

async function readJiraJson(response: Response, maximumBytes: number): Promise<unknown> {
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > maximumBytes) {
    throw malformedJiraResponse();
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw malformedJiraResponse();
  }
}

function normalizeTransition(value: unknown): JiraTransition | null {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    !/^\d{1,64}$/u.test(value.id) ||
    typeof value.name !== 'string' ||
    !isRecord(value.to) ||
    typeof value.to.name !== 'string' ||
    !isRecord(value.fields)
  ) {
    return null;
  }
  const fields: JiraTransitionField[] = [];
  const unsupportedRequiredFields: string[] = [];
  const unsupportedOptionalFields: string[] = [];
  for (const [fieldId, rawField] of Object.entries(value.fields).slice(0, 64)) {
    if (
      !isRecord(rawField) ||
      typeof rawField.name !== 'string' ||
      typeof rawField.required !== 'boolean'
    ) {
      return null;
    }
    const field = normalizeTransitionField(fieldId, rawField);
    if (field === null) {
      if (rawField.required) {
        unsupportedRequiredFields.push(truncate(rawField.name, 255));
      } else {
        unsupportedOptionalFields.push(truncate(rawField.name, 255));
      }
    } else {
      fields.push(field);
    }
  }
  return {
    id: value.id,
    name: truncate(value.name, 255),
    toStatus: truncate(value.to.name, 120),
    fields,
    unsupportedRequiredFields,
    unsupportedOptionalFields,
  };
}

function normalizeTransitionField(
  fieldId: string,
  value: Record<string, unknown>,
): JiraTransitionField | null {
  if (!/^[A-Za-z][A-Za-z0-9_.-]{0,127}$/u.test(fieldId) || !isRecord(value.schema)) {
    return null;
  }
  const allowedValues = normalizeAllowedValues(value.allowedValues);
  const type = mapFieldType(
    value.schema,
    (allowedValues?.length ?? 0) > 0,
    value.allowedValues !== undefined,
  );
  if (type === null) {
    return null;
  }
  const maxLength =
    typeof value.schema.maxLength === 'number' && Number.isInteger(value.schema.maxLength)
      ? Math.min(Math.max(value.schema.maxLength, 1), 4_000)
      : type === 'textarea' || type === 'comment'
        ? 4_000
        : type === 'text'
          ? 255
          : undefined;
  return {
    fieldId,
    label: truncate(String(value.name), 255),
    type,
    required: value.required === true,
    ...(allowedValues === undefined ? {} : { allowedValues }),
    ...(maxLength === undefined ? {} : { maxLength }),
  };
}

function mapFieldType(
  schema: Record<string, unknown>,
  hasAllowedValues: boolean,
  declaresAllowedValues: boolean,
): JiraTransitionFieldType | null {
  const type = schema.type;
  const system = schema.system;
  if (system === 'resolution' || type === 'resolution') {
    return hasAllowedValues ? 'resolution' : null;
  }
  if (type === 'user') return hasAllowedValues ? 'user' : null;
  if (type === 'date') return 'date';
  if (type === 'number') return 'number';
  if (declaresAllowedValues && !hasAllowedValues) return null;
  if (type === 'array' && hasAllowedValues) return 'multi-select';
  if ((type === 'option' || type === 'priority' || type === 'string') && hasAllowedValues)
    return 'single-select';
  if (type === 'string')
    return schema.custom === 'com.atlassian.jira.plugin.system.customfieldtypes:textarea'
      ? 'textarea'
      : 'text';
  return null;
}

function normalizeAllowedValues(
  value: unknown,
): readonly { readonly id: string; readonly label: string }[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const normalized = [];
  for (const candidate of value.slice(0, 500)) {
    if (!isRecord(candidate)) continue;
    const id = candidate.id ?? candidate.accountId ?? candidate.value;
    const label = candidate.name ?? candidate.displayName ?? candidate.value;
    if (typeof id === 'string' && typeof label === 'string') {
      normalized.push({ id: truncate(id, 255), label: truncate(label, 255) });
    }
  }
  return normalized;
}

function normalizeTransitionValue(
  field: JiraTransitionField,
  value: JiraTransitionFieldValue,
): unknown {
  if (field.type === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) throw validationError();
    return value;
  }
  if (field.type === 'multi-select') {
    if (
      !Array.isArray(value) ||
      value.length > 50 ||
      value.some((item) => typeof item !== 'string')
    ) {
      throw validationError();
    }
    validateAllowed(field, value);
    return value.map((id) => ({ id }));
  }
  if (typeof value !== 'string' || value.trim() === '') throw validationError();
  const normalized = value.trim();
  if (field.maxLength !== undefined && normalized.length > field.maxLength) throw validationError();
  if (field.type === 'date' && !isValidIsoDate(normalized)) throw validationError();
  if (field.type === 'single-select' || field.type === 'resolution' || field.type === 'user') {
    validateAllowed(field, [normalized]);
    return field.type === 'user' ? { accountId: normalized } : { id: normalized };
  }
  return normalized;
}

function isValidIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (match === null) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

function validateAllowed(field: JiraTransitionField, ids: readonly string[]): void {
  if (field.allowedValues === undefined) return;
  const allowed = new Set(field.allowedValues.map((item) => item.id));
  if (ids.some((id) => !allowed.has(id))) throw validationError();
}

export function adfToPlainText(value: unknown): string {
  const parts: string[] = [];
  walkAdf(value, parts, 0);
  return parts
    .join('')
    .replace(/[ \t]+\n/gu, '\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();
}

function walkAdf(value: unknown, parts: string[], depth: number): void {
  if (depth > 32 || !isRecord(value)) return;
  if (value.type === 'text' && typeof value.text === 'string') parts.push(value.text);
  if (value.type === 'hardBreak') parts.push('\n');
  if (Array.isArray(value.content)) {
    for (const child of value.content.slice(0, 2_000)) walkAdf(child, parts, depth + 1);
  }
  if (
    ['paragraph', 'heading', 'listItem', 'blockquote', 'codeBlock'].includes(String(value.type))
  ) {
    parts.push('\n');
  }
}

function normalizeComments(value: unknown): readonly string[] {
  if (!isRecord(value) || !Array.isArray(value.comments)) return [];
  return value.comments
    .filter(isRecord)
    .sort((left, right) => String(right.created ?? '').localeCompare(String(left.created ?? '')))
    .slice(0, 3)
    .map((comment) => truncate(redactEmailLike(adfToPlainText(comment.body)), 1_000));
}

function normalizeStringArray(
  value: unknown,
  maximum: number,
  maxLength: number,
  totalLimit: number,
): readonly string[] {
  if (!Array.isArray(value)) return [];
  const normalized: string[] = [];
  let total = 0;
  for (const item of value
    .filter((candidate): candidate is string => typeof candidate === 'string')
    .slice(0, maximum)) {
    const remaining = totalLimit - total;
    if (remaining <= 0) break;
    const label = truncate(redactEmailLike(item), Math.min(maxLength, remaining));
    normalized.push(label);
    total += label.length;
  }
  return normalized;
}

function nestedString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function objectName(value: unknown): string | null {
  return isRecord(value) && typeof value.name === 'string' && value.name.trim() !== ''
    ? value.name
    : null;
}

function nullableObjectName(value: unknown, maxLength: number): string | null {
  const name = objectName(value);
  return name === null ? null : truncate(redactEmailLike(name), maxLength);
}

function nullableDisplayName(value: unknown): string | null {
  return isRecord(value) && typeof value.displayName === 'string'
    ? truncate(redactEmailLike(value.displayName), 255)
    : null;
}

function truncate(value: string, maximum: number): string {
  return value.slice(0, maximum);
}

function redactEmailLike(value: string): string {
  return value.replace(EMAIL_LIKE, '[redacted email]');
}

function validationError(): WorkerHttpError {
  return new WorkerHttpError(
    422,
    'JIRA_FIELD_VALIDATION',
    'Complete the required Jira fields and try again.',
  );
}

function malformedJiraResponse(): WorkerHttpError {
  return new WorkerHttpError(502, 'JIRA_UPSTREAM_ERROR', 'Jira returned an invalid response.');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
