import type {
  OAuthExchangeRequest,
  OAuthExchangeResponse,
  OAuthStartRequest,
  OAuthStartResponse,
} from '../../src/core/worker-api-contracts';
import { isJiraSiteHost } from '../../src/core/worker-api-contracts';
import type { WorkerConfig, WorkerEnv } from './config';
import { extensionIdFromRedirectUri } from './config';
import { WorkerHttpError } from './http';
import { SessionStore, type StoredJiraSite } from './session-store';
import { createOpaqueToken, encryptToken, hashOpaqueToken, pkceChallenge } from './token-crypto';

export const OAUTH_SCOPES = 'offline_access read:jira-work write:jira-work';
const TOKEN_URL = 'https://auth.atlassian.com/oauth/token';
const ACCESSIBLE_RESOURCES_URL = 'https://api.atlassian.com/oauth/token/accessible-resources';

interface AtlassianTokenResponse {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly scopes: string;
}

export function buildAtlassianAuthorizationUrl(input: {
  readonly clientId: string;
  readonly callbackUrl: string;
  readonly state: string;
}): URL {
  const url = new URL('https://auth.atlassian.com/authorize');
  url.searchParams.set('audience', 'api.atlassian.com');
  url.searchParams.set('client_id', input.clientId);
  url.searchParams.set('scope', OAUTH_SCOPES);
  url.searchParams.set('redirect_uri', input.callbackUrl);
  url.searchParams.set('state', input.state);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('prompt', 'consent');
  return url;
}

export async function startOAuth(
  input: OAuthStartRequest,
  env: WorkerEnv,
  config: WorkerConfig,
): Promise<OAuthStartResponse> {
  const extensionId = extensionIdFromRedirectUri(input.redirectUri);
  if (extensionId === null || !config.allowedExtensionIds.has(extensionId)) {
    throw new WorkerHttpError(
      403,
      'UNAUTHORIZED_ORIGIN',
      'This extension callback is not allowed.',
    );
  }
  const state = createOpaqueToken();
  const stateHash = await hashOpaqueToken(state, config.sessionHmacKey);
  const now = Math.floor(Date.now() / 1_000);
  await new SessionStore(env.DB, {
    sessionIdleTtlSeconds: config.sessionIdleTtlSeconds,
  }).putOAuthState({
    stateHash,
    extensionId,
    redirectUri: input.redirectUri,
    codeChallenge: input.codeChallenge,
    expiresAt: now + config.oauthStateTtlSeconds,
  });
  return {
    authorizationUrl: buildAtlassianAuthorizationUrl({
      clientId: config.atlassianClientId,
      callbackUrl: config.oauthCallbackUrl,
      state,
    }).toString(),
  };
}

export async function handleOAuthCallback(
  request: Request,
  env: WorkerEnv,
  config: WorkerConfig,
): Promise<Response> {
  const url = new URL(request.url);
  const state = url.searchParams.get('state');
  if (state === null || !/^[A-Za-z0-9_-]{32,128}$/u.test(state)) {
    throw new WorkerHttpError(400, 'OAUTH_STATE_INVALID', 'The OAuth state is invalid or expired.');
  }
  const store = new SessionStore(env.DB, { sessionIdleTtlSeconds: config.sessionIdleTtlSeconds });
  const stateRecord = await store.consumeOAuthState(
    await hashOpaqueToken(state, config.sessionHmacKey),
  );
  if (stateRecord === null) {
    throw new WorkerHttpError(400, 'OAUTH_STATE_INVALID', 'The OAuth state is invalid or expired.');
  }

  const callback = new URL(stateRecord.redirectUri);
  if (url.searchParams.get('error') !== null) {
    callback.searchParams.set('error', 'authorization_cancelled');
    return Response.redirect(callback.toString(), 303);
  }
  const code = url.searchParams.get('code');
  if (code === null || code.length > 2_048) {
    callback.searchParams.set('error', 'authorization_failed');
    return Response.redirect(callback.toString(), 303);
  }

  try {
    const tokens = await exchangeAuthorizationCode(code, config);
    const sites = await loadAccessibleResources(tokens.accessToken);
    if (sites.length === 0) {
      throw new WorkerHttpError(403, 'SITE_NOT_AUTHORIZED', 'No approved Jira site was selected.');
    }
    const installationId = createOpaqueToken();
    const exchangeCode = createOpaqueToken();
    const now = Math.floor(Date.now() / 1_000);
    await store.createPendingInstallation({
      installationId,
      encryptedRefreshToken: await encryptToken(tokens.refreshToken, config.tokenEncryptionKey),
      scopes: tokens.scopes,
      sites,
      exchangeCodeHash: await hashOpaqueToken(exchangeCode, config.sessionHmacKey),
      codeChallenge: stateRecord.codeChallenge,
      redirectUri: stateRecord.redirectUri,
      exchangeExpiresAt: now + config.exchangeCodeTtlSeconds,
    });
    callback.searchParams.set('exchange_code', exchangeCode);
    return Response.redirect(callback.toString(), 303);
  } catch (error) {
    if (error instanceof WorkerHttpError && error.code === 'SITE_NOT_AUTHORIZED') {
      callback.searchParams.set('error', 'site_not_authorized');
    } else {
      callback.searchParams.set('error', 'authorization_failed');
    }
    return Response.redirect(callback.toString(), 303);
  }
}

export async function exchangeInstallationSession(
  input: OAuthExchangeRequest,
  env: WorkerEnv,
  config: WorkerConfig,
): Promise<OAuthExchangeResponse> {
  const extensionId = extensionIdFromRedirectUri(input.redirectUri);
  if (extensionId === null || !config.allowedExtensionIds.has(extensionId)) {
    throw new WorkerHttpError(
      403,
      'UNAUTHORIZED_ORIGIN',
      'This extension callback is not allowed.',
    );
  }
  const rawSessionToken = createOpaqueToken();
  const result = await new SessionStore(env.DB, {
    sessionIdleTtlSeconds: config.sessionIdleTtlSeconds,
  }).exchangeSession({
    exchangeCodeHash: await hashOpaqueToken(input.exchangeCode, config.sessionHmacKey),
    codeChallenge: await pkceChallenge(input.verifier),
    redirectUri: input.redirectUri,
    sessionTokenHash: await hashOpaqueToken(rawSessionToken, config.sessionHmacKey),
  });
  if (result === null) {
    throw new WorkerHttpError(
      400,
      'OAUTH_EXCHANGE_FAILED',
      'The connection exchange is invalid or expired.',
    );
  }
  return {
    sessionToken: rawSessionToken,
    connection: {
      connected: true,
      reauthorizationRequired: false,
      sites: result.sites.map(({ host, displayName }) => ({ host, displayName })),
    },
  };
}

async function exchangeAuthorizationCode(
  code: string,
  config: WorkerConfig,
): Promise<AtlassianTokenResponse> {
  const response = await fetchWithTimeout(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: config.atlassianClientId,
      client_secret: config.atlassianClientSecret,
      code,
      redirect_uri: config.oauthCallbackUrl,
    }),
  });
  if (!response.ok) {
    throw new WorkerHttpError(502, 'OAUTH_EXCHANGE_FAILED', 'Atlassian authorization failed.');
  }
  const body = await readBoundedJson(response, 16_384);
  if (!isRecord(body)) {
    throw new WorkerHttpError(
      502,
      'OAUTH_EXCHANGE_FAILED',
      'Atlassian returned an invalid token response.',
    );
  }
  const accessToken = body.access_token;
  const refreshToken = body.refresh_token;
  const scope = body.scope;
  if (
    typeof accessToken !== 'string' ||
    accessToken.length < 16 ||
    typeof refreshToken !== 'string' ||
    refreshToken.length < 16 ||
    typeof scope !== 'string' ||
    !hasRequiredScopes(scope)
  ) {
    throw new WorkerHttpError(
      502,
      'OAUTH_EXCHANGE_FAILED',
      'Atlassian returned an invalid token response.',
    );
  }
  return { accessToken, refreshToken, scopes: scope };
}

async function loadAccessibleResources(accessToken: string): Promise<readonly StoredJiraSite[]> {
  const response = await fetchWithTimeout(ACCESSIBLE_RESOURCES_URL, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new WorkerHttpError(
      502,
      'OAUTH_EXCHANGE_FAILED',
      'Atlassian site access could not be verified.',
    );
  }
  const body = await readBoundedJson(response, 64 * 1_024);
  if (!Array.isArray(body) || body.length > 100) {
    throw new WorkerHttpError(
      502,
      'OAUTH_EXCHANGE_FAILED',
      'Atlassian returned invalid site access data.',
    );
  }
  const sites: StoredJiraSite[] = [];
  for (const value of body) {
    if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string') {
      continue;
    }
    try {
      const siteUrl = new URL(String(value.url));
      if (
        siteUrl.protocol !== 'https:' ||
        siteUrl.pathname !== '/' ||
        siteUrl.username !== '' ||
        siteUrl.password !== '' ||
        siteUrl.port !== '' ||
        siteUrl.search !== '' ||
        siteUrl.hash !== '' ||
        !isJiraSiteHost(siteUrl.hostname) ||
        !Array.isArray(value.scopes) ||
        !value.scopes.includes('read:jira-work') ||
        !value.scopes.includes('write:jira-work')
      ) {
        continue;
      }
      sites.push({
        cloudId: value.id.slice(0, 255),
        host: siteUrl.hostname,
        displayName: value.name.slice(0, 255),
      });
    } catch {
      continue;
    }
  }
  return sites;
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch {
    throw new WorkerHttpError(
      502,
      'OAUTH_EXCHANGE_FAILED',
      'Atlassian authorization is unavailable.',
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function readBoundedJson(response: Response, maximumBytes: number): Promise<unknown> {
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > maximumBytes) {
    throw new WorkerHttpError(502, 'OAUTH_EXCHANGE_FAILED', 'Atlassian returned too much data.');
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new WorkerHttpError(502, 'OAUTH_EXCHANGE_FAILED', 'Atlassian returned invalid JSON.');
  }
}

function hasRequiredScopes(value: string): boolean {
  const scopes = new Set(value.split(/\s+/u));
  return OAUTH_SCOPES.split(' ').every((scope) => scopes.has(scope));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
