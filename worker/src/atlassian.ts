import type { WorkerConfig, WorkerEnv } from './config';
import { WorkerHttpError } from './http';
import { SessionStore, type AuthenticatedInstallation, type StoredJiraSite } from './session-store';
import { createOpaqueToken, decryptToken, encryptToken } from './token-crypto';

const ATLASSIAN_TOKEN_URL = 'https://auth.atlassian.com/oauth/token';
const ATLASSIAN_API_ORIGIN = 'https://api.atlassian.com';
const REQUEST_TIMEOUT_MS = 15_000;

export interface AtlassianFetch {
  (input: string | URL | Request, init?: RequestInit): Promise<Response>;
}

export function resolveGrantedSite(
  installation: AuthenticatedInstallation,
  siteHost: string,
): StoredJiraSite {
  const site = installation.sites.find((candidate) => candidate.host === siteHost);
  if (site === undefined) {
    throw new WorkerHttpError(403, 'SITE_NOT_AUTHORIZED', 'This Jira site is not connected.');
  }
  return site;
}

export async function createAtlassianTransport(
  installation: AuthenticatedInstallation,
  site: StoredJiraSite,
  env: WorkerEnv,
  config: WorkerConfig,
  fetcher: AtlassianFetch = fetch,
): Promise<{ readonly request: (path: string, init: RequestInit) => Promise<Response> }> {
  const accessToken = await rotateAccessToken(installation, env, config, fetcher);
  const baseUrl = `${ATLASSIAN_API_ORIGIN}/ex/jira/${encodeURIComponent(site.cloudId)}`;

  return {
    async request(path: string, init: RequestInit): Promise<Response> {
      if (!/^\/rest\/api\/3\/[A-Za-z0-9%?=&,._~/-]+$/u.test(path) || path.includes('..')) {
        throw new WorkerHttpError(
          500,
          'INTERNAL_ERROR',
          'An unsupported Jira operation was requested.',
        );
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      const headers = new Headers(init.headers);
      headers.set('Authorization', `Bearer ${accessToken}`);
      headers.set('Accept', 'application/json');
      if (init.body !== undefined && init.body !== null) {
        headers.set('Content-Type', 'application/json');
      }
      try {
        return await fetcher(`${baseUrl}${path}`, { ...init, headers, signal: controller.signal });
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          throw new WorkerHttpError(504, 'JIRA_TIMEOUT', 'Jira did not respond in time.');
        }
        throw new WorkerHttpError(502, 'JIRA_UPSTREAM_ERROR', 'Jira is temporarily unavailable.');
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

async function rotateAccessToken(
  installation: AuthenticatedInstallation,
  env: WorkerEnv,
  config: WorkerConfig,
  fetcher: AtlassianFetch,
): Promise<string> {
  const store = new SessionStore(env.DB, {
    sessionIdleTtlSeconds: config.sessionIdleTtlSeconds,
  });
  const leaseId = createOpaqueToken(24);
  const now = Math.floor(Date.now() / 1_000);
  if (!(await store.acquireRefreshLease(installation.installationId, leaseId, now + 30))) {
    throw new WorkerHttpError(
      409,
      'JIRA_UPSTREAM_ERROR',
      'The Jira connection is refreshing. Try again.',
    );
  }

  let response: Response;
  try {
    response = await fetchWithTimeout(
      fetcher,
      ATLASSIAN_TOKEN_URL,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          client_id: config.atlassianClientId,
          client_secret: config.atlassianClientSecret,
          refresh_token: await decryptToken(
            installation.encryptedRefreshToken,
            config.tokenEncryptionKey,
          ),
        }),
      },
      'SESSION_EXPIRED',
    );
  } catch (error) {
    await store.releaseRefreshLease(installation.installationId, leaseId);
    throw error;
  }

  if (response.status === 400 || response.status === 401 || response.status === 403) {
    await store.revokeInstallation(installation.installationId);
    throw new WorkerHttpError(401, 'SESSION_EXPIRED', 'Connect Jira again to continue.');
  }
  if (!response.ok) {
    await store.releaseRefreshLease(installation.installationId, leaseId);
    throw new WorkerHttpError(502, 'JIRA_UPSTREAM_ERROR', 'Jira authorization is unavailable.');
  }

  const body = await readBoundedJson(response, 16_384);
  if (
    !isRecord(body) ||
    typeof body.access_token !== 'string' ||
    body.access_token.length < 16 ||
    typeof body.refresh_token !== 'string' ||
    body.refresh_token.length < 16
  ) {
    await store.releaseRefreshLease(installation.installationId, leaseId);
    throw new WorkerHttpError(
      502,
      'JIRA_UPSTREAM_ERROR',
      'Jira authorization returned invalid data.',
    );
  }
  const completed = await store.completeRefresh(
    installation.installationId,
    leaseId,
    await encryptToken(body.refresh_token, config.tokenEncryptionKey),
  );
  if (!completed) {
    throw new WorkerHttpError(
      409,
      'JIRA_UPSTREAM_ERROR',
      'The Jira connection changed. Try again.',
    );
  }
  return body.access_token;
}

async function fetchWithTimeout(
  fetcher: AtlassianFetch,
  url: string,
  init: RequestInit,
  timeoutCode: 'SESSION_EXPIRED',
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetcher(url, { ...init, signal: controller.signal });
  } catch {
    throw new WorkerHttpError(504, timeoutCode, 'Jira authorization timed out. Connect again.');
  } finally {
    clearTimeout(timeout);
  }
}

async function readBoundedJson(response: Response, maximumBytes: number): Promise<unknown> {
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > maximumBytes) {
    throw new WorkerHttpError(
      502,
      'JIRA_UPSTREAM_ERROR',
      'Jira authorization returned too much data.',
    );
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new WorkerHttpError(
      502,
      'JIRA_UPSTREAM_ERROR',
      'Jira authorization returned invalid data.',
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
