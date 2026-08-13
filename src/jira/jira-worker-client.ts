import type {
  JiraConnectionStatus,
  JiraIssueContext,
  JiraTransitionExecuteResult,
  JiraTransitionsResult,
} from '../core/contracts';
import { LinkInsightError, type LinkInsightErrorCode } from '../core/errors';
import {
  parseConnectionStatusResponse,
  parseJiraContextResponse,
  parseJiraTransitionExecuteResponse,
  parseJiraTransitionsResponse,
  parseOAuthExchangeResponse,
  parseOAuthStartResponse,
  parseWorkerErrorResponse,
  WORKER_API_PATHS,
  type JiraContextRequest,
  type JiraTransitionExecuteRequest,
  type OAuthExchangeRequest,
  type OAuthExchangeResponse,
  type OAuthStartRequest,
  type OAuthStartResponse,
  type WorkerErrorCode,
} from '../core/worker-api-contracts';
import { parseWorkerOrigin, RUNTIME_CONFIG } from '../config/runtime-config';

export interface WorkerFetch {
  (input: string | URL | Request, init?: RequestInit): Promise<Response>;
}

interface JiraWorkerClientOptions {
  readonly origin?: string;
  readonly timeoutMs?: number;
  readonly fetcher?: WorkerFetch;
}

export class JiraWorkerClient {
  private readonly origin: string;
  private readonly timeoutMs: number;
  private readonly fetcher: WorkerFetch;

  constructor(options: JiraWorkerClientOptions = {}) {
    this.origin = parseWorkerOrigin(options.origin ?? RUNTIME_CONFIG.worker.origin);
    this.timeoutMs = options.timeoutMs ?? RUNTIME_CONFIG.worker.timeoutMs;
    this.fetcher = options.fetcher ?? fetch;
  }

  startOAuth(input: OAuthStartRequest): Promise<OAuthStartResponse> {
    return this.request(WORKER_API_PATHS.oauthStart, 'POST', input, (value) =>
      parseOAuthStartResponse(value, this.origin),
    );
  }

  exchangeOAuth(input: OAuthExchangeRequest): Promise<OAuthExchangeResponse> {
    return this.request(WORKER_API_PATHS.oauthExchange, 'POST', input, parseOAuthExchangeResponse);
  }

  getConnection(sessionToken: string): Promise<JiraConnectionStatus> {
    return this.request(
      WORKER_API_PATHS.connection,
      'GET',
      undefined,
      parseConnectionStatusResponse,
      sessionToken,
    );
  }

  async disconnect(sessionToken: string): Promise<void> {
    await this.requestEmpty(WORKER_API_PATHS.disconnect, 'POST', {}, sessionToken);
  }

  getContext(sessionToken: string, input: JiraContextRequest): Promise<JiraIssueContext> {
    return this.request(
      WORKER_API_PATHS.jiraContext,
      'POST',
      input,
      parseJiraContextResponse,
      sessionToken,
    );
  }

  getTransitions(sessionToken: string, input: JiraContextRequest): Promise<JiraTransitionsResult> {
    return this.request(
      WORKER_API_PATHS.jiraTransitionsQuery,
      'POST',
      input,
      parseJiraTransitionsResponse,
      sessionToken,
    );
  }

  executeTransition(
    sessionToken: string,
    input: JiraTransitionExecuteRequest,
  ): Promise<JiraTransitionExecuteResult> {
    return this.request(
      WORKER_API_PATHS.jiraTransitionsExecute,
      'POST',
      input,
      parseJiraTransitionExecuteResponse,
      sessionToken,
    );
  }

  private async request<T>(
    path: string,
    method: 'GET' | 'POST',
    body: unknown,
    parser: (value: unknown) => T | null,
    sessionToken?: string,
  ): Promise<T> {
    const response = await this.fetchResponse(path, method, body, sessionToken);
    if (!response.ok) {
      throw await parseError(response);
    }
    const value = await readBoundedJson(response);
    const parsed = parser(value);
    if (parsed === null) {
      throw new LinkInsightError(
        'WORKER_INVALID_RESPONSE',
        'The Jira service returned invalid data.',
      );
    }
    return parsed;
  }

  private async requestEmpty(
    path: string,
    method: 'POST',
    body: unknown,
    sessionToken: string,
  ): Promise<void> {
    const response = await this.fetchResponse(path, method, body, sessionToken);
    if (!response.ok) {
      throw await parseError(response);
    }
    if (response.status !== 204) {
      throw new LinkInsightError(
        'WORKER_INVALID_RESPONSE',
        'The Jira service returned invalid data.',
      );
    }
  }

  private async fetchResponse(
    path: string,
    method: 'GET' | 'POST',
    body: unknown,
    sessionToken?: string,
  ): Promise<Response> {
    if (!(Object.values(WORKER_API_PATHS) as readonly string[]).includes(path)) {
      throw new LinkInsightError('INVALID_REQUEST', 'This Jira operation is not supported.');
    }
    const headers = new Headers({ Accept: 'application/json' });
    if (sessionToken !== undefined) {
      const normalizedToken = sessionToken.trim();
      if (normalizedToken === '') {
        throw new LinkInsightError('JIRA_NOT_CONNECTED', 'Connect Jira in the extension options.');
      }
      headers.set('Authorization', `Bearer ${normalizedToken}`);
    }
    const init: RequestInit = { method, headers };
    if (method === 'POST') {
      headers.set('Content-Type', 'application/json');
      init.body = JSON.stringify(body);
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await this.fetcher(`${this.origin}${path}`, { ...init, signal: controller.signal });
    } catch {
      throw new LinkInsightError('WORKER_UNAVAILABLE', 'The Jira service is unavailable.');
    } finally {
      clearTimeout(timeout);
    }
  }
}

async function parseError(response: Response): Promise<LinkInsightError> {
  const value = await readBoundedJson(response).catch(() => null);
  const parsed = parseWorkerErrorResponse(value);
  if (parsed === null) {
    return new LinkInsightError(
      'WORKER_INVALID_RESPONSE',
      'The Jira service returned invalid data.',
    );
  }
  return new LinkInsightError(mapWorkerErrorCode(parsed.error.code), parsed.error.message);
}

function mapWorkerErrorCode(code: WorkerErrorCode): LinkInsightErrorCode {
  const mapping: Record<WorkerErrorCode, LinkInsightErrorCode> = {
    INVALID_REQUEST: 'INVALID_REQUEST',
    UNAUTHORIZED_ORIGIN: 'UNAUTHORIZED_SENDER',
    UNAUTHORIZED_SESSION: 'JIRA_NOT_CONNECTED',
    SESSION_EXPIRED: 'JIRA_REAUTHORIZATION_REQUIRED',
    OAUTH_STATE_INVALID: 'OAUTH_STATE_INVALID',
    OAUTH_EXCHANGE_FAILED: 'OAUTH_FAILED',
    SITE_NOT_AUTHORIZED: 'JIRA_SITE_NOT_AUTHORIZED',
    JIRA_NOT_FOUND: 'JIRA_NOT_FOUND',
    JIRA_FORBIDDEN: 'JIRA_FORBIDDEN',
    JIRA_TRANSITION_STALE: 'JIRA_TRANSITION_STALE',
    JIRA_FIELD_VALIDATION: 'JIRA_FIELD_VALIDATION',
    JIRA_RATE_LIMIT: 'JIRA_RATE_LIMIT',
    JIRA_TIMEOUT: 'JIRA_TIMEOUT',
    JIRA_UPSTREAM_ERROR: 'JIRA_UPSTREAM_ERROR',
    AMBIGUOUS_WRITE_OUTCOME: 'AMBIGUOUS_WRITE_OUTCOME',
    INTERNAL_ERROR: 'WORKER_UNAVAILABLE',
  };
  return mapping[code];
}

async function readBoundedJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > 512 * 1_024) {
    throw new LinkInsightError(
      'WORKER_INVALID_RESPONSE',
      'The Jira service returned too much data.',
    );
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new LinkInsightError(
      'WORKER_INVALID_RESPONSE',
      'The Jira service returned invalid data.',
    );
  }
}
