export type LinkInsightErrorCode =
  | 'INVALID_REQUEST'
  | 'UNAUTHORIZED_SENDER'
  | 'UNSUPPORTED_LINK'
  | 'MISSING_API_KEY'
  | 'INVALID_API_KEY'
  | 'GEMINI_INVALID_REQUEST'
  | 'GEMINI_RATE_LIMIT'
  | 'GEMINI_TIMEOUT'
  | 'GEMINI_NETWORK_ERROR'
  | 'GEMINI_UNAVAILABLE'
  | 'GEMINI_EMPTY_RESPONSE'
  | 'GEMINI_INVALID_RESPONSE'
  | 'GEMINI_REQUEST_FAILED'
  | 'CONTENT_FETCH_FAILED'
  | 'INTERNAL_ERROR';

export class LinkInsightError extends Error {
  override readonly name = 'LinkInsightError';

  constructor(
    readonly code: LinkInsightErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export function isLinkInsightError(error: unknown): error is LinkInsightError {
  return error instanceof LinkInsightError;
}
