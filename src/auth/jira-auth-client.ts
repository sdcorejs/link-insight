import type { JiraConnectionStatus } from '../core/contracts';
import { LinkInsightError } from '../core/errors';
import type {
  OAuthExchangeRequest,
  OAuthExchangeResponse,
  OAuthStartRequest,
  OAuthStartResponse,
} from '../core/worker-api-contracts';

interface IdentityGateway {
  getRedirectURL(path?: string): string;
  launchWebAuthFlow(details: {
    readonly url: string;
    readonly interactive: boolean;
  }): Promise<string>;
}

interface OAuthWorkerGateway {
  startOAuth(input: OAuthStartRequest): Promise<OAuthStartResponse>;
  exchangeOAuth(input: OAuthExchangeRequest): Promise<OAuthExchangeResponse>;
}

interface JiraAuthSettings {
  saveSessionToken(value: string): Promise<void>;
  saveSelectedSiteHosts(hosts: readonly string[]): Promise<void>;
}

interface JiraAuthClientDependencies {
  readonly identity: IdentityGateway;
  readonly worker: OAuthWorkerGateway;
  readonly settings: JiraAuthSettings;
}

export class JiraAuthClient {
  constructor(private readonly dependencies: JiraAuthClientDependencies) {}

  async connect(): Promise<JiraConnectionStatus> {
    const redirectUri = this.dependencies.identity.getRedirectURL('jira-oauth');
    const expectedCallback = parseRedirect(redirectUri);
    const verifier = createVerifier();
    const codeChallenge = await createCodeChallenge(verifier);
    const start = await this.dependencies.worker.startOAuth({ redirectUri, codeChallenge });

    let callbackValue: string;
    try {
      callbackValue = await this.dependencies.identity.launchWebAuthFlow({
        url: start.authorizationUrl,
        interactive: true,
      });
    } catch {
      throw new LinkInsightError('OAUTH_CANCELLED', 'Jira connection was cancelled.');
    }
    const callback = validateCallback(callbackValue, expectedCallback);
    const error = callback.searchParams.get('error');
    if (error !== null) {
      throw new LinkInsightError(
        error === 'authorization_cancelled' ? 'OAUTH_CANCELLED' : 'OAUTH_FAILED',
        error === 'authorization_cancelled'
          ? 'Jira connection was cancelled.'
          : 'Jira connection failed.',
      );
    }
    if (
      [...callback.searchParams.keys()].some((key) => key !== 'exchange_code') ||
      callback.hash !== ''
    ) {
      throw new LinkInsightError('OAUTH_STATE_INVALID', 'The Jira connection callback is invalid.');
    }
    const exchangeCode = callback.searchParams.get('exchange_code');
    if (exchangeCode === null || !/^[A-Za-z0-9._~-]{32,512}$/u.test(exchangeCode)) {
      throw new LinkInsightError('OAUTH_STATE_INVALID', 'The Jira connection callback is invalid.');
    }
    const exchange = await this.dependencies.worker.exchangeOAuth({
      exchangeCode,
      verifier,
      redirectUri,
    });
    await this.dependencies.settings.saveSessionToken(exchange.sessionToken);
    await this.dependencies.settings.saveSelectedSiteHosts(
      exchange.connection.sites.map((site) => site.host),
    );
    return exchange.connection;
  }
}

function parseRedirect(value: string): URL {
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      !/^[a-p]{32}\.chromiumapp\.org$/u.test(url.hostname) ||
      url.pathname !== '/jira-oauth' ||
      url.search !== '' ||
      url.hash !== ''
    ) {
      throw new TypeError();
    }
    return url;
  } catch {
    throw new LinkInsightError('OAUTH_STATE_INVALID', 'The Jira connection redirect is invalid.');
  }
}

function validateCallback(value: string, expected: URL): URL {
  try {
    const callback = new URL(value);
    if (
      callback.protocol !== expected.protocol ||
      callback.hostname !== expected.hostname ||
      callback.port !== '' ||
      callback.username !== '' ||
      callback.password !== '' ||
      callback.pathname !== expected.pathname
    ) {
      throw new TypeError();
    }
    return callback;
  } catch {
    throw new LinkInsightError('OAUTH_STATE_INVALID', 'The Jira connection callback is invalid.');
  }
}

function createVerifier(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = '';
  for (const byte of bytes) binary += String.fromCodePoint(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

async function createCodeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const bytes = new Uint8Array(digest);
  let binary = '';
  for (const byte of bytes) binary += String.fromCodePoint(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}
