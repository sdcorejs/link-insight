import type {
  AiSummary,
  JiraConnectionStatus,
  JiraTransitionExecuteResult,
  JiraTransitionFieldValue,
  JiraTransitionsResult,
} from './contracts';
import { isLinkInsightErrorCode, type LinkInsightErrorCode } from './errors';
import { parseAiSummary } from './summary-validation';
import {
  parseConnectionStatusResponse,
  parseJiraTransitionExecuteRequest,
  parseJiraTransitionExecuteResponse,
  parseJiraTransitionsResponse,
} from './worker-api-contracts';

export interface LinkSummaryRequest {
  readonly type: 'LINK_SUMMARY_REQUEST';
  readonly requestId: string;
  readonly url: string;
}

export interface LinkSummarySuccessResponse {
  readonly type: 'LINK_SUMMARY_SUCCESS';
  readonly requestId: string;
  readonly summary: AiSummary;
}

export interface LinkSummaryErrorResponse {
  readonly type: 'LINK_SUMMARY_ERROR';
  readonly requestId: string;
  readonly error: {
    readonly code: LinkInsightErrorCode;
    readonly message: string;
  };
}

export type LinkSummaryResponse = LinkSummarySuccessResponse | LinkSummaryErrorResponse;

export interface JiraConnectRequest {
  readonly type: 'JIRA_CONNECT_REQUEST';
  readonly requestId: string;
}

export interface JiraConnectionStatusRequest {
  readonly type: 'JIRA_CONNECTION_STATUS_REQUEST';
  readonly requestId: string;
}

export interface JiraDisconnectRequest {
  readonly type: 'JIRA_DISCONNECT_REQUEST';
  readonly requestId: string;
}

export interface JiraConsentSetRequest {
  readonly type: 'JIRA_CONSENT_SET_REQUEST';
  readonly requestId: string;
  readonly enabled: boolean;
}

export interface JiraTransitionsRequest {
  readonly type: 'JIRA_TRANSITIONS_REQUEST';
  readonly requestId: string;
  readonly url: string;
}

export interface JiraTransitionExecuteMessageRequest {
  readonly type: 'JIRA_TRANSITION_EXECUTE_REQUEST';
  readonly requestId: string;
  readonly url: string;
  readonly transitionId: string;
  readonly idempotencyKey: string;
  readonly values: Readonly<Record<string, JiraTransitionFieldValue>>;
  readonly comment?: string;
}

export type JiraRuntimeRequest =
  | JiraConnectRequest
  | JiraConnectionStatusRequest
  | JiraDisconnectRequest
  | JiraConsentSetRequest
  | JiraTransitionsRequest
  | JiraTransitionExecuteMessageRequest;

export interface JiraConnectionSuccessResponse {
  readonly type: 'JIRA_CONNECTION_SUCCESS';
  readonly requestId: string;
  readonly connection: JiraConnectionStatus;
  readonly consentEnabled: boolean;
}

export interface JiraDisconnectSuccessResponse {
  readonly type: 'JIRA_DISCONNECT_SUCCESS';
  readonly requestId: string;
  readonly remoteRevocationConfirmed: boolean;
}

export interface JiraConsentSuccessResponse {
  readonly type: 'JIRA_CONSENT_SUCCESS';
  readonly requestId: string;
  readonly enabled: boolean;
}

export interface JiraTransitionsSuccessResponse {
  readonly type: 'JIRA_TRANSITIONS_SUCCESS';
  readonly requestId: string;
  readonly result: JiraTransitionsResult;
}

export interface JiraTransitionExecuteSuccessResponse {
  readonly type: 'JIRA_TRANSITION_EXECUTE_SUCCESS';
  readonly requestId: string;
  readonly result: JiraTransitionExecuteResult;
}

export interface JiraOperationErrorResponse {
  readonly type: 'JIRA_OPERATION_ERROR';
  readonly requestId: string;
  readonly error: {
    readonly code: LinkInsightErrorCode;
    readonly message: string;
  };
}

export type JiraRuntimeResponse =
  | JiraConnectionSuccessResponse
  | JiraDisconnectSuccessResponse
  | JiraConsentSuccessResponse
  | JiraTransitionsSuccessResponse
  | JiraTransitionExecuteSuccessResponse
  | JiraOperationErrorResponse;

export function isLinkSummaryRequest(value: unknown): value is LinkSummaryRequest {
  if (!isRecord(value) || value.type !== 'LINK_SUMMARY_REQUEST') {
    return false;
  }

  return isSafeRequestId(value.requestId) && isNonEmptyString(value.url);
}

export function parseLinkSummaryResponse(value: unknown): LinkSummaryResponse | null {
  if (!isRecord(value) || !isSafeRequestId(value.requestId)) {
    return null;
  }

  if (value.type === 'LINK_SUMMARY_SUCCESS') {
    const summary = parseAiSummary(value.summary);
    return summary === null
      ? null
      : {
          type: 'LINK_SUMMARY_SUCCESS',
          requestId: value.requestId,
          summary,
        };
  }

  if (value.type === 'LINK_SUMMARY_ERROR' && isRecord(value.error)) {
    if (!isLinkInsightErrorCode(value.error.code) || !isNonEmptyString(value.error.message)) {
      return null;
    }

    return {
      type: 'LINK_SUMMARY_ERROR',
      requestId: value.requestId,
      error: {
        code: value.error.code,
        message: value.error.message,
      },
    };
  }

  return null;
}

export function isJiraRuntimeRequest(value: unknown): value is JiraRuntimeRequest {
  if (!isRecord(value) || !isSafeRequestId(value.requestId) || typeof value.type !== 'string') {
    return false;
  }

  if (
    value.type === 'JIRA_CONNECT_REQUEST' ||
    value.type === 'JIRA_CONNECTION_STATUS_REQUEST' ||
    value.type === 'JIRA_DISCONNECT_REQUEST'
  ) {
    return hasExactKeys(value, ['type', 'requestId']);
  }
  if (value.type === 'JIRA_CONSENT_SET_REQUEST') {
    return (
      hasExactKeys(value, ['type', 'requestId', 'enabled']) && typeof value.enabled === 'boolean'
    );
  }
  if (value.type === 'JIRA_TRANSITIONS_REQUEST') {
    return hasExactKeys(value, ['type', 'requestId', 'url']) && isNonEmptyString(value.url);
  }
  if (value.type === 'JIRA_TRANSITION_EXECUTE_REQUEST') {
    const allowedKeys =
      value.comment === undefined
        ? ['type', 'requestId', 'url', 'transitionId', 'idempotencyKey', 'values']
        : ['type', 'requestId', 'url', 'transitionId', 'idempotencyKey', 'values', 'comment'];
    if (!hasExactKeys(value, allowedKeys) || !isNonEmptyString(value.url)) {
      return false;
    }
    return (
      parseJiraTransitionExecuteRequest({
        siteHost: 'validation.atlassian.net',
        issueKey: 'VALID-1',
        transitionId: value.transitionId,
        idempotencyKey: value.idempotencyKey,
        values: value.values,
        ...(typeof value.comment === 'string' ? { comment: value.comment } : {}),
      }) !== null
    );
  }
  return false;
}

export function parseJiraRuntimeResponse(value: unknown): JiraRuntimeResponse | null {
  if (!isRecord(value) || !isSafeRequestId(value.requestId) || typeof value.type !== 'string') {
    return null;
  }
  if (value.type === 'JIRA_CONNECTION_SUCCESS') {
    if (!hasExactKeys(value, ['type', 'requestId', 'connection', 'consentEnabled'])) {
      return null;
    }
    const connection = parseConnectionStatusResponse(value.connection);
    return connection === null || typeof value.consentEnabled !== 'boolean'
      ? null
      : {
          type: value.type,
          requestId: value.requestId,
          connection,
          consentEnabled: value.consentEnabled,
        };
  }
  if (value.type === 'JIRA_DISCONNECT_SUCCESS') {
    return hasExactKeys(value, ['type', 'requestId', 'remoteRevocationConfirmed']) &&
      typeof value.remoteRevocationConfirmed === 'boolean'
      ? {
          type: value.type,
          requestId: value.requestId,
          remoteRevocationConfirmed: value.remoteRevocationConfirmed,
        }
      : null;
  }
  if (value.type === 'JIRA_CONSENT_SUCCESS') {
    return hasExactKeys(value, ['type', 'requestId', 'enabled']) &&
      typeof value.enabled === 'boolean'
      ? { type: value.type, requestId: value.requestId, enabled: value.enabled }
      : null;
  }
  if (value.type === 'JIRA_TRANSITIONS_SUCCESS') {
    if (!hasExactKeys(value, ['type', 'requestId', 'result'])) {
      return null;
    }
    const result = parseJiraTransitionsResponse(value.result);
    return result === null ? null : { type: value.type, requestId: value.requestId, result };
  }
  if (value.type === 'JIRA_TRANSITION_EXECUTE_SUCCESS') {
    if (!hasExactKeys(value, ['type', 'requestId', 'result'])) {
      return null;
    }
    const result = parseJiraTransitionExecuteResponse(value.result);
    return result === null ? null : { type: value.type, requestId: value.requestId, result };
  }
  if (value.type === 'JIRA_OPERATION_ERROR') {
    if (
      !hasExactKeys(value, ['type', 'requestId', 'error']) ||
      !isRecord(value.error) ||
      !hasExactKeys(value.error, ['code', 'message']) ||
      !isLinkInsightErrorCode(value.error.code) ||
      !isNonEmptyString(value.error.message) ||
      value.error.message.length > 500
    ) {
      return null;
    }
    return {
      type: value.type,
      requestId: value.requestId,
      error: { code: value.error.code, message: value.error.message },
    };
  }
  return null;
}

function isSafeRequestId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 128;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return (
    Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key))
  );
}
