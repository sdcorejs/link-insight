export interface WorkerEnv {
  readonly DB: D1Database;
  readonly PUBLIC_WORKER_ORIGIN: string;
  readonly ALLOWED_EXTENSION_IDS: string;
  readonly SESSION_IDLE_TTL_SECONDS: string;
  readonly OAUTH_STATE_TTL_SECONDS: string;
  readonly EXCHANGE_CODE_TTL_SECONDS: string;
  readonly ATLASSIAN_CLIENT_ID: string;
  readonly ATLASSIAN_CLIENT_SECRET: string;
  readonly TOKEN_ENCRYPTION_KEY: string;
  readonly SESSION_HMAC_KEY: string;
}

export interface WorkerConfig {
  readonly publicOrigin: string;
  readonly oauthCallbackUrl: string;
  readonly allowedExtensionIds: ReadonlySet<string>;
  readonly sessionIdleTtlSeconds: number;
  readonly oauthStateTtlSeconds: number;
  readonly exchangeCodeTtlSeconds: number;
  readonly atlassianClientId: string;
  readonly atlassianClientSecret: string;
  readonly tokenEncryptionKey: string;
  readonly sessionHmacKey: string;
  readonly maxRequestBytes: number;
  readonly authenticatedRequestLimit: number;
  readonly rateLimitWindowSeconds: number;
}

const EXTENSION_ID = /^[a-p]{32}$/u;

export function readWorkerConfig(env: WorkerEnv): WorkerConfig {
  const publicOrigin = parsePublicOrigin(env.PUBLIC_WORKER_ORIGIN);
  const allowedExtensionIds = new Set(
    env.ALLOWED_EXTENSION_IDS.split(',')
      .map((value) => value.trim())
      .filter((value) => value !== ''),
  );
  if (
    allowedExtensionIds.size === 0 ||
    [...allowedExtensionIds].some((value) => !EXTENSION_ID.test(value))
  ) {
    throw new TypeError('ALLOWED_EXTENSION_IDS must contain exact Chrome extension IDs.');
  }

  return {
    publicOrigin,
    oauthCallbackUrl: `${publicOrigin}/oauth/callback`,
    allowedExtensionIds,
    sessionIdleTtlSeconds: parseSeconds(env.SESSION_IDLE_TTL_SECONDS, 86_400, 7_776_000),
    oauthStateTtlSeconds: parseSeconds(env.OAUTH_STATE_TTL_SECONDS, 60, 900),
    exchangeCodeTtlSeconds: parseSeconds(env.EXCHANGE_CODE_TTL_SECONDS, 30, 600),
    atlassianClientId: requireSecret(env.ATLASSIAN_CLIENT_ID, 'ATLASSIAN_CLIENT_ID'),
    atlassianClientSecret: requireSecret(env.ATLASSIAN_CLIENT_SECRET, 'ATLASSIAN_CLIENT_SECRET'),
    tokenEncryptionKey: requireSecret(env.TOKEN_ENCRYPTION_KEY, 'TOKEN_ENCRYPTION_KEY'),
    sessionHmacKey: requireSecret(env.SESSION_HMAC_KEY, 'SESSION_HMAC_KEY'),
    maxRequestBytes: 32 * 1_024,
    authenticatedRequestLimit: 120,
    rateLimitWindowSeconds: 60,
  };
}

export function extensionIdFromRedirectUri(redirectUri: string): string | null {
  try {
    const url = new URL(redirectUri);
    const match = /^([a-p]{32})\.chromiumapp\.org$/u.exec(url.hostname);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function parsePublicOrigin(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError('PUBLIC_WORKER_ORIGIN must be an absolute HTTPS origin.');
  }
  if (
    url.protocol !== 'https:' ||
    url.username !== '' ||
    url.password !== '' ||
    url.port !== '' ||
    url.pathname !== '/' ||
    url.search !== '' ||
    url.hash !== ''
  ) {
    throw new TypeError('PUBLIC_WORKER_ORIGIN must be an exact HTTPS origin.');
  }
  return url.origin;
}

function parseSeconds(value: string, minimum: number, maximum: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new TypeError('Worker expiry configuration is outside its allowed range.');
  }
  return parsed;
}

function requireSecret(value: string, name: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${name} is required.`);
  }
  return value;
}
