import type {
  JiraConnectionStatus,
  JiraIssueContext,
  JiraTransition,
  JiraTransitionExecuteResult,
  JiraTransitionField,
  JiraTransitionFieldValue,
  JiraTransitionsResult,
} from './contracts';

export const WORKER_API_PATHS = Object.freeze({
  oauthStart: '/v1/oauth/start',
  oauthExchange: '/v1/oauth/exchange',
  connection: '/v1/connection',
  disconnect: '/v1/connection/disconnect',
  jiraContext: '/v1/jira/context',
  jiraTransitionsQuery: '/v1/jira/transitions/query',
  jiraTransitionsExecute: '/v1/jira/transitions/execute',
  health: '/health',
  privacy: '/privacy',
});

export type WorkerErrorCode =
  | 'INVALID_REQUEST'
  | 'UNAUTHORIZED_ORIGIN'
  | 'UNAUTHORIZED_SESSION'
  | 'SESSION_EXPIRED'
  | 'OAUTH_STATE_INVALID'
  | 'OAUTH_EXCHANGE_FAILED'
  | 'SITE_NOT_AUTHORIZED'
  | 'JIRA_NOT_FOUND'
  | 'JIRA_FORBIDDEN'
  | 'JIRA_TRANSITION_STALE'
  | 'JIRA_FIELD_VALIDATION'
  | 'JIRA_RATE_LIMIT'
  | 'JIRA_TIMEOUT'
  | 'JIRA_UPSTREAM_ERROR'
  | 'AMBIGUOUS_WRITE_OUTCOME'
  | 'INTERNAL_ERROR';

export interface WorkerErrorResponse {
  readonly error: {
    readonly code: WorkerErrorCode;
    readonly message: string;
  };
}

export interface OAuthStartRequest {
  readonly redirectUri: string;
  readonly codeChallenge: string;
}

export interface OAuthStartResponse {
  readonly authorizationUrl: string;
}

export interface OAuthExchangeRequest {
  readonly exchangeCode: string;
  readonly verifier: string;
  readonly redirectUri: string;
}

export interface OAuthExchangeResponse {
  readonly sessionToken: string;
  readonly connection: JiraConnectionStatus;
}

export interface JiraContextRequest {
  readonly siteHost: string;
  readonly issueKey: string;
}

export interface JiraTransitionExecuteRequest extends JiraContextRequest {
  readonly transitionId: string;
  readonly idempotencyKey: string;
  readonly values: Readonly<Record<string, JiraTransitionFieldValue>>;
  readonly comment?: string;
}

const ISSUE_KEY = /^[A-Z][A-Z0-9_]{0,63}-[1-9]\d{0,17}$/u;
const TENANT = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u;
const TRANSITION_ID = /^\d{1,64}$/u;
const FIELD_ID = /^[A-Za-z][A-Za-z0-9_.-]{0,127}$/u;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const OPAQUE_CODE = /^[A-Za-z0-9._~-]{32,512}$/u;
const CODE_CHALLENGE = /^[A-Za-z0-9_-]{43,128}$/u;
const SUPPORTED_FIELD_TYPES = new Set([
  'text',
  'textarea',
  'number',
  'date',
  'single-select',
  'multi-select',
  'user',
  'resolution',
  'comment',
]);
const WORKER_ERROR_CODES = new Set<WorkerErrorCode>([
  'INVALID_REQUEST',
  'UNAUTHORIZED_ORIGIN',
  'UNAUTHORIZED_SESSION',
  'SESSION_EXPIRED',
  'OAUTH_STATE_INVALID',
  'OAUTH_EXCHANGE_FAILED',
  'SITE_NOT_AUTHORIZED',
  'JIRA_NOT_FOUND',
  'JIRA_FORBIDDEN',
  'JIRA_TRANSITION_STALE',
  'JIRA_FIELD_VALIDATION',
  'JIRA_RATE_LIMIT',
  'JIRA_TIMEOUT',
  'JIRA_UPSTREAM_ERROR',
  'AMBIGUOUS_WRITE_OUTCOME',
  'INTERNAL_ERROR',
]);

export function isJiraSiteHost(value: unknown): value is string {
  if (typeof value !== 'string' || value !== value.toLowerCase()) {
    return false;
  }
  const suffix = '.atlassian.net';
  if (!value.endsWith(suffix)) {
    return false;
  }
  const tenant = value.slice(0, -suffix.length);
  return TENANT.test(tenant) && !tenant.includes('.');
}

export function isJiraIssueKey(value: unknown): value is string {
  return typeof value === 'string' && ISSUE_KEY.test(value);
}

export function parseJiraContextRequest(value: unknown): JiraContextRequest | null {
  if (!isExactRecord(value, ['siteHost', 'issueKey'])) {
    return null;
  }
  return isJiraSiteHost(value.siteHost) && isJiraIssueKey(value.issueKey)
    ? { siteHost: value.siteHost, issueKey: value.issueKey }
    : null;
}

export function parseJiraContextResponse(value: unknown): JiraIssueContext | null {
  if (
    !isExactRecord(value, [
      'issueKey',
      'title',
      'description',
      'issueType',
      'status',
      'priority',
      'assignee',
      'labels',
      'comments',
    ]) ||
    !isJiraIssueKey(value.issueKey) ||
    !isBoundedString(value.title, 500) ||
    !isBoundedString(value.description, 12_000, true) ||
    !isBoundedString(value.issueType, 120) ||
    !isBoundedString(value.status, 120) ||
    !isNullableBoundedString(value.priority, 120) ||
    !isNullableBoundedString(value.assignee, 255) ||
    !isStringArray(value.labels, 50, 255) ||
    !isStringArray(value.comments, 3, 1_000)
  ) {
    return null;
  }

  const totalLength =
    value.title.length +
    value.description.length +
    value.labels.reduce((total, item) => total + item.length, 0) +
    value.comments.reduce((total, item) => total + item.length, 0);
  if (totalLength > 16_000) {
    return null;
  }

  return {
    issueKey: value.issueKey,
    title: value.title,
    description: value.description,
    issueType: value.issueType,
    status: value.status,
    priority: value.priority,
    assignee: value.assignee,
    labels: [...value.labels],
    comments: [...value.comments],
  };
}

export function parseJiraTransitionsResponse(value: unknown): JiraTransitionsResult | null {
  if (
    !isExactRecord(value, ['issueKey', 'currentStatus', 'transitions']) ||
    !isJiraIssueKey(value.issueKey) ||
    !isBoundedString(value.currentStatus, 120) ||
    !Array.isArray(value.transitions) ||
    value.transitions.length > 100
  ) {
    return null;
  }

  const transitions: JiraTransition[] = [];
  for (const candidate of value.transitions) {
    const transition = parseTransition(candidate);
    if (transition === null) {
      return null;
    }
    transitions.push(transition);
  }
  return { issueKey: value.issueKey, currentStatus: value.currentStatus, transitions };
}

export function parseJiraTransitionExecuteRequest(
  value: unknown,
): JiraTransitionExecuteRequest | null {
  if (!isRecord(value)) {
    return null;
  }
  const allowedKeys =
    value.comment === undefined
      ? ['siteHost', 'issueKey', 'transitionId', 'idempotencyKey', 'values']
      : ['siteHost', 'issueKey', 'transitionId', 'idempotencyKey', 'values', 'comment'];
  if (!hasExactKeys(value, allowedKeys)) {
    return null;
  }
  const base = parseJiraContextRequest({ siteHost: value.siteHost, issueKey: value.issueKey });
  const values = parseFieldValues(value.values);
  if (
    base === null ||
    typeof value.transitionId !== 'string' ||
    !TRANSITION_ID.test(value.transitionId) ||
    typeof value.idempotencyKey !== 'string' ||
    !UUID.test(value.idempotencyKey) ||
    values === null ||
    (value.comment !== undefined && !isBoundedString(value.comment, 4_000, true))
  ) {
    return null;
  }

  return {
    ...base,
    transitionId: value.transitionId,
    idempotencyKey: value.idempotencyKey,
    values,
    ...(typeof value.comment === 'string' ? { comment: value.comment } : {}),
  };
}

export function parseJiraTransitionExecuteResponse(
  value: unknown,
): JiraTransitionExecuteResult | null {
  if (
    isExactRecord(value, ['issueKey', 'applied']) &&
    isJiraIssueKey(value.issueKey) &&
    value.applied === false
  ) {
    return { issueKey: value.issueKey, applied: false };
  }
  if (
    !isExactRecord(value, ['issueKey', 'oldStatus', 'newStatus', 'applied']) ||
    !isJiraIssueKey(value.issueKey) ||
    !isBoundedString(value.oldStatus, 120) ||
    !isBoundedString(value.newStatus, 120) ||
    value.applied !== true
  ) {
    return null;
  }
  return {
    issueKey: value.issueKey,
    oldStatus: value.oldStatus,
    newStatus: value.newStatus,
    applied: value.applied,
  };
}

export function parseConnectionStatusResponse(value: unknown): JiraConnectionStatus | null {
  if (
    !isExactRecord(value, ['connected', 'reauthorizationRequired', 'sites']) ||
    typeof value.connected !== 'boolean' ||
    typeof value.reauthorizationRequired !== 'boolean' ||
    !Array.isArray(value.sites) ||
    value.sites.length > 100
  ) {
    return null;
  }
  const sites = [];
  for (const candidate of value.sites) {
    if (
      !isExactRecord(candidate, ['host', 'displayName']) ||
      !isJiraSiteHost(candidate.host) ||
      !isBoundedString(candidate.displayName, 255)
    ) {
      return null;
    }
    sites.push({ host: candidate.host, displayName: candidate.displayName });
  }
  if (!value.connected && sites.length > 0) {
    return null;
  }
  return {
    connected: value.connected,
    reauthorizationRequired: value.reauthorizationRequired,
    sites,
  };
}

export function parseOAuthStartRequest(value: unknown): OAuthStartRequest | null {
  if (!isExactRecord(value, ['redirectUri', 'codeChallenge'])) {
    return null;
  }
  return isAllowedChromiumRedirect(value.redirectUri) &&
    typeof value.codeChallenge === 'string' &&
    CODE_CHALLENGE.test(value.codeChallenge)
    ? { redirectUri: value.redirectUri, codeChallenge: value.codeChallenge }
    : null;
}

export function parseOAuthStartResponse(
  value: unknown,
  expectedWorkerOrigin: string,
): OAuthStartResponse | null {
  if (!isExactRecord(value, ['authorizationUrl']) || typeof value.authorizationUrl !== 'string') {
    return null;
  }
  try {
    const url = new URL(value.authorizationUrl);
    if (
      url.protocol !== 'https:' ||
      url.hostname !== 'auth.atlassian.com' ||
      url.pathname !== '/authorize' ||
      url.username !== '' ||
      url.password !== '' ||
      url.port !== '' ||
      url.hash !== '' ||
      !hasExactAuthorizationQuery(url, expectedWorkerOrigin)
    ) {
      return null;
    }
    return { authorizationUrl: url.toString() };
  } catch {
    return null;
  }
}

function hasExactAuthorizationQuery(url: URL, expectedWorkerOrigin: string): boolean {
  const keys = [
    'audience',
    'client_id',
    'scope',
    'redirect_uri',
    'state',
    'response_type',
    'prompt',
  ] as const;
  if (
    [...url.searchParams.keys()].length !== keys.length ||
    keys.some((key) => url.searchParams.getAll(key).length !== 1)
  ) {
    return false;
  }
  const clientId = url.searchParams.get('client_id');
  const state = url.searchParams.get('state');
  const redirectUri = url.searchParams.get('redirect_uri');
  if (
    url.searchParams.get('audience') !== 'api.atlassian.com' ||
    url.searchParams.get('scope') !== 'offline_access read:jira-work write:jira-work' ||
    url.searchParams.get('response_type') !== 'code' ||
    url.searchParams.get('prompt') !== 'consent' ||
    typeof clientId !== 'string' ||
    clientId.trim() === '' ||
    clientId.length > 512 ||
    typeof state !== 'string' ||
    !OPAQUE_CODE.test(state) ||
    typeof redirectUri !== 'string'
  ) {
    return false;
  }
  try {
    const callback = new URL(redirectUri);
    const expectedOrigin = new URL(expectedWorkerOrigin);
    return (
      expectedWorkerOrigin === expectedOrigin.origin &&
      expectedOrigin.protocol === 'https:' &&
      expectedOrigin.username === '' &&
      expectedOrigin.password === '' &&
      expectedOrigin.port === '' &&
      expectedOrigin.pathname === '/' &&
      expectedOrigin.search === '' &&
      expectedOrigin.hash === '' &&
      callback.protocol === 'https:' &&
      callback.origin === expectedOrigin.origin &&
      callback.username === '' &&
      callback.password === '' &&
      callback.port === '' &&
      callback.pathname === '/oauth/callback' &&
      callback.search === '' &&
      callback.hash === ''
    );
  } catch {
    return false;
  }
}

export function parseOAuthExchangeRequest(value: unknown): OAuthExchangeRequest | null {
  if (!isExactRecord(value, ['exchangeCode', 'verifier', 'redirectUri'])) {
    return null;
  }
  return typeof value.exchangeCode === 'string' &&
    OPAQUE_CODE.test(value.exchangeCode) &&
    typeof value.verifier === 'string' &&
    OPAQUE_CODE.test(value.verifier) &&
    isAllowedChromiumRedirect(value.redirectUri)
    ? { exchangeCode: value.exchangeCode, verifier: value.verifier, redirectUri: value.redirectUri }
    : null;
}

export function parseOAuthExchangeResponse(value: unknown): OAuthExchangeResponse | null {
  if (
    !isExactRecord(value, ['sessionToken', 'connection']) ||
    typeof value.sessionToken !== 'string' ||
    !OPAQUE_CODE.test(value.sessionToken)
  ) {
    return null;
  }
  const connection = parseConnectionStatusResponse(value.connection);
  return connection === null ? null : { sessionToken: value.sessionToken, connection };
}

export function parseWorkerErrorResponse(value: unknown): WorkerErrorResponse | null {
  if (!isExactRecord(value, ['error']) || !isExactRecord(value.error, ['code', 'message'])) {
    return null;
  }
  if (
    typeof value.error.code !== 'string' ||
    !WORKER_ERROR_CODES.has(value.error.code as WorkerErrorCode) ||
    !isBoundedString(value.error.message, 500)
  ) {
    return null;
  }
  return { error: { code: value.error.code as WorkerErrorCode, message: value.error.message } };
}

export function isAllowedChromiumRedirect(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 512) {
    return false;
  }
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      /^[a-p]{32}\.chromiumapp\.org$/u.test(url.hostname) &&
      url.username === '' &&
      url.password === '' &&
      url.port === '' &&
      url.pathname === '/jira-oauth' &&
      url.search === '' &&
      url.hash === ''
    );
  } catch {
    return false;
  }
}

function parseTransition(value: unknown): JiraTransition | null {
  const keys =
    isRecord(value) && value.unsupportedOptionalFields !== undefined
      ? [
          'id',
          'name',
          'toStatus',
          'fields',
          'unsupportedRequiredFields',
          'unsupportedOptionalFields',
        ]
      : ['id', 'name', 'toStatus', 'fields', 'unsupportedRequiredFields'];
  if (
    !isExactRecord(value, keys) ||
    typeof value.id !== 'string' ||
    !TRANSITION_ID.test(value.id) ||
    !isBoundedString(value.name, 255) ||
    !isBoundedString(value.toStatus, 120) ||
    !Array.isArray(value.fields) ||
    value.fields.length > 64 ||
    !isStringArray(value.unsupportedRequiredFields, 64, 255) ||
    (value.unsupportedOptionalFields !== undefined &&
      !isStringArray(value.unsupportedOptionalFields, 64, 255))
  ) {
    return null;
  }
  const fields: JiraTransitionField[] = [];
  for (const candidate of value.fields) {
    const field = parseTransitionField(candidate);
    if (field === null) {
      return null;
    }
    fields.push(field);
  }
  return {
    id: value.id,
    name: value.name,
    toStatus: value.toStatus,
    fields,
    unsupportedRequiredFields: [...value.unsupportedRequiredFields],
    ...(value.unsupportedOptionalFields === undefined
      ? {}
      : { unsupportedOptionalFields: [...value.unsupportedOptionalFields] }),
  };
}

function parseTransitionField(value: unknown): JiraTransitionField | null {
  if (!isRecord(value)) {
    return null;
  }
  const optionalKeys = ['allowedValues', 'maxLength'];
  const requiredKeys = ['fieldId', 'label', 'type', 'required'];
  if (!hasOnlyKeys(value, [...requiredKeys, ...optionalKeys]) || !hasKeys(value, requiredKeys)) {
    return null;
  }
  if (
    typeof value.fieldId !== 'string' ||
    !FIELD_ID.test(value.fieldId) ||
    !isBoundedString(value.label, 255) ||
    typeof value.type !== 'string' ||
    !SUPPORTED_FIELD_TYPES.has(value.type) ||
    typeof value.required !== 'boolean' ||
    (value.maxLength !== undefined &&
      (typeof value.maxLength !== 'number' ||
        !Number.isInteger(value.maxLength) ||
        value.maxLength < 1 ||
        value.maxLength > 4_000))
  ) {
    return null;
  }
  const allowedValues = parseAllowedValues(value.allowedValues);
  if (value.allowedValues !== undefined && allowedValues === null) {
    return null;
  }
  return {
    fieldId: value.fieldId,
    label: value.label,
    type: value.type as JiraTransitionField['type'],
    required: value.required,
    ...(allowedValues === null ? {} : { allowedValues }),
    ...(typeof value.maxLength === 'number' ? { maxLength: value.maxLength } : {}),
  };
}

function parseAllowedValues(
  value: unknown,
): readonly { readonly id: string; readonly label: string }[] | null {
  if (value === undefined) {
    return null;
  }
  if (!Array.isArray(value) || value.length > 500) {
    return null;
  }
  const parsed = [];
  for (const candidate of value) {
    if (
      !isExactRecord(candidate, ['id', 'label']) ||
      !isBoundedString(candidate.id, 255) ||
      !isBoundedString(candidate.label, 255)
    ) {
      return null;
    }
    parsed.push({ id: candidate.id, label: candidate.label });
  }
  return parsed;
}

function parseFieldValues(
  value: unknown,
): Readonly<Record<string, JiraTransitionFieldValue>> | null {
  if (!isRecord(value) || Object.keys(value).length > 32) {
    return null;
  }
  const parsed: Record<string, JiraTransitionFieldValue> = {};
  for (const [fieldId, candidate] of Object.entries(value)) {
    if (!FIELD_ID.test(fieldId)) {
      return null;
    }
    if (typeof candidate === 'string' && candidate.length <= 4_000) {
      parsed[fieldId] = candidate;
    } else if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      parsed[fieldId] = candidate;
    } else if (isStringArray(candidate, 50, 255)) {
      parsed[fieldId] = [...candidate];
    } else {
      return null;
    }
  }
  return parsed;
}

function isNullableBoundedString(value: unknown, maxLength: number): value is string | null {
  return value === null || isBoundedString(value, maxLength);
}

function isBoundedString(value: unknown, maxLength: number, allowEmpty = false): value is string {
  return (
    typeof value === 'string' &&
    value.length <= maxLength &&
    (allowEmpty || value.trim().length > 0)
  );
}

function isStringArray(value: unknown, maxItems: number, maxLength: number): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= maxItems &&
    value.every((item) => typeof item === 'string' && item.length <= maxLength)
  );
}

function isExactRecord(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return isRecord(value) && hasExactKeys(value, keys);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).length === keys.length && hasKeys(value, keys);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

function hasKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return keys.every((key) => Object.hasOwn(value, key));
}
