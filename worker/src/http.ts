import type { WorkerErrorCode, WorkerErrorResponse } from '../../src/core/worker-api-contracts';

export class WorkerHttpError extends Error {
  override readonly name = 'WorkerHttpError';

  constructor(
    readonly status: number,
    readonly code: WorkerErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export function isAllowedExtensionOrigin(
  origin: string | null,
  allowedExtensionIds: ReadonlySet<string>,
): boolean {
  if (origin === null) {
    return false;
  }
  const match = /^chrome-extension:\/\/([a-p]{32})$/u.exec(origin);
  return match !== null && allowedExtensionIds.has(match[1]!);
}

export function buildCorsHeaders(
  origin: string | null,
  allowedExtensionIds: ReadonlySet<string>,
): Headers {
  const headers = securityHeaders();
  if (isAllowedExtensionOrigin(origin, allowedExtensionIds)) {
    headers.set('Access-Control-Allow-Origin', origin!);
    headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    headers.set('Access-Control-Max-Age', '600');
    headers.set('Vary', 'Origin');
  }
  return headers;
}

export async function readJsonBody(request: Request, maximumBytes: number): Promise<unknown> {
  const contentType = request.headers.get('Content-Type')?.split(';', 1)[0]?.trim().toLowerCase();
  if (contentType !== 'application/json') {
    throw new WorkerHttpError(400, 'INVALID_REQUEST', 'Expected an application/json request.');
  }
  const contentLength = request.headers.get('Content-Length');
  if (contentLength !== null && Number(contentLength) > maximumBytes) {
    throw new WorkerHttpError(413, 'INVALID_REQUEST', 'The request body is too large.');
  }
  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > maximumBytes) {
    throw new WorkerHttpError(413, 'INVALID_REQUEST', 'The request body is too large.');
  }
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new WorkerHttpError(400, 'INVALID_REQUEST', 'The request body is not valid JSON.');
  }
}

export function requireAllowedOrigin(
  request: Request,
  allowedExtensionIds: ReadonlySet<string>,
): string {
  const origin = request.headers.get('Origin');
  if (!isAllowedExtensionOrigin(origin, allowedExtensionIds)) {
    throw new WorkerHttpError(403, 'UNAUTHORIZED_ORIGIN', 'This extension origin is not allowed.');
  }
  return origin!;
}

export function requireBearerToken(request: Request): string {
  const authorization = request.headers.get('Authorization');
  if (authorization === null || !authorization.startsWith('Bearer ')) {
    throw new WorkerHttpError(401, 'UNAUTHORIZED_SESSION', 'Connect Jira again to continue.');
  }
  const token = authorization.slice('Bearer '.length);
  if (!/^[A-Za-z0-9_-]{32,128}$/u.test(token)) {
    throw new WorkerHttpError(401, 'UNAUTHORIZED_SESSION', 'Connect Jira again to continue.');
  }
  return token;
}

export function jsonResponse(
  value: unknown,
  status = 200,
  headers: Headers = securityHeaders(),
): Response {
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(value), { status, headers });
}

export function errorResponse(error: unknown, headers: Headers = securityHeaders()): Response {
  const normalized =
    error instanceof WorkerHttpError
      ? error
      : new WorkerHttpError(500, 'INTERNAL_ERROR', 'The service could not complete this request.');
  const body: WorkerErrorResponse = {
    error: { code: normalized.code, message: normalized.message },
  };
  return jsonResponse(body, normalized.status, headers);
}

export function securityHeaders(): Headers {
  return new Headers({
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
  });
}
