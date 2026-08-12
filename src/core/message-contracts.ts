import type { AiSummary } from './contracts';
import type { LinkInsightErrorCode } from './errors';
import { parseAiSummary } from './summary-validation';

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
    if (!isNonEmptyString(value.error.code) || !isNonEmptyString(value.error.message)) {
      return null;
    }

    return {
      type: 'LINK_SUMMARY_ERROR',
      requestId: value.requestId,
      error: {
        code: value.error.code as LinkInsightErrorCode,
        message: value.error.message,
      },
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
