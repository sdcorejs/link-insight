import { env } from 'cloudflare:workers';
import { describe, expect, it, vi } from 'vitest';

import { readWorkerConfig } from '../src/config';
import {
  buildAtlassianAuthorizationUrl,
  handleOAuthCallback,
  OAUTH_SCOPES,
  startOAuth,
} from '../src/oauth';
import { SessionStore } from '../src/session-store';
import { decryptToken, encryptToken, hashOpaqueToken, pkceChallenge } from '../src/token-crypto';

describe('Worker OAuth and installation sessions', () => {
  it('uses only the approved resource-level Jira scopes in the authorization URL', () => {
    const url = buildAtlassianAuthorizationUrl({
      clientId: 'unit-test-only',
      callbackUrl: 'https://link-insight.invalid/oauth/callback',
      state: 'state-value-that-is-long-enough-for-the-contract',
    });

    expect(url.origin + url.pathname).toBe('https://auth.atlassian.com/authorize');
    expect(url.searchParams.get('audience')).toBe('api.atlassian.com');
    expect(url.searchParams.get('scope')).toBe(OAUTH_SCOPES);
    expect(new Set(url.searchParams.get('scope')?.split(' '))).toEqual(
      new Set(['offline_access', 'read:jira-work', 'write:jira-work']),
    );
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('prompt')).toBe('consent');
  });

  it('encrypts refresh tokens with versioned AES-GCM and hashes session tokens', async () => {
    const encrypted = await encryptToken('refresh-token-plaintext', env.TOKEN_ENCRYPTION_KEY);

    expect(encrypted.keyVersion).toBe(1);
    expect(encrypted.ciphertext).not.toContain('refresh-token-plaintext');
    await expect(decryptToken(encrypted, env.TOKEN_ENCRYPTION_KEY)).resolves.toBe(
      'refresh-token-plaintext',
    );
    await expect(hashOpaqueToken('opaque-session', env.SESSION_HMAC_KEY)).resolves.toBe(
      await hashOpaqueToken('opaque-session', env.SESSION_HMAC_KEY),
    );
    await expect(
      pkceChallenge('verifier-value-with-at-least-thirty-two-characters'),
    ).resolves.toMatch(/^[A-Za-z0-9_-]{43}$/u);
  });

  it('consumes OAuth state once and rejects replay or expiry', async () => {
    let now = 1_000_000;
    const store = new SessionStore(env.DB, { now: () => now });
    await store.putOAuthState({
      stateHash: 'state-hash',
      extensionId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      redirectUri: 'https://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.chromiumapp.org/jira-oauth',
      codeChallenge: 'challenge',
      expiresAt: now + 100,
    });

    await expect(store.consumeOAuthState('state-hash')).resolves.toMatchObject({
      extensionId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    });
    await expect(store.consumeOAuthState('state-hash')).resolves.toBeNull();

    await store.putOAuthState({
      stateHash: 'expired-state-hash',
      extensionId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      redirectUri: 'https://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.chromiumapp.org/jira-oauth',
      codeChallenge: 'challenge',
      expiresAt: now + 1,
    });
    now += 2;
    await expect(store.consumeOAuthState('expired-state-hash')).resolves.toBeNull();
  });

  it('returns a raw installation token once but stores only hashes and ciphertext', async () => {
    const now = 2_000_000;
    const store = new SessionStore(env.DB, { now: () => now });
    const encrypted = await encryptToken('rotating-refresh-plaintext', env.TOKEN_ENCRYPTION_KEY);
    await store.createPendingInstallation({
      installationId: 'installation-1',
      encryptedRefreshToken: encrypted,
      scopes: OAUTH_SCOPES,
      sites: [{ cloudId: 'cloud-1', host: 'acme.atlassian.net', displayName: 'Acme Jira' }],
      exchangeCodeHash: 'exchange-code-hash',
      codeChallenge: 'challenge-hash',
      redirectUri: 'https://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.chromiumapp.org/jira-oauth',
      exchangeExpiresAt: now + 300,
    });
    const sessionHash = await hashOpaqueToken('raw-installation-session', env.SESSION_HMAC_KEY);

    await expect(
      store.exchangeSession({
        exchangeCodeHash: 'exchange-code-hash',
        codeChallenge: 'challenge-hash',
        redirectUri: 'https://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.chromiumapp.org/jira-oauth',
        sessionTokenHash: sessionHash,
      }),
    ).resolves.toMatchObject({ installationId: 'installation-1' });
    await expect(
      store.exchangeSession({
        exchangeCodeHash: 'exchange-code-hash',
        codeChallenge: 'challenge-hash',
        redirectUri: 'https://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.chromiumapp.org/jira-oauth',
        sessionTokenHash: 'replay',
      }),
    ).resolves.toBeNull();

    const row = await env.DB.prepare(
      'SELECT session_token_hash, refresh_token_ciphertext FROM installations JOIN grants USING (installation_id) WHERE installation_id = ?',
    )
      .bind('installation-1')
      .first<Record<string, string>>();
    expect(row?.session_token_hash).toBe(sessionHash);
    expect(row?.session_token_hash).not.toContain('raw-installation-session');
    expect(row?.refresh_token_ciphertext).not.toContain('rotating-refresh-plaintext');
  });

  it('enforces one refresh lease and purges sessions after 30 days of inactivity', async () => {
    let now = 3_000_000;
    const store = new SessionStore(env.DB, { now: () => now });
    await store.createPendingInstallation({
      installationId: 'installation-cleanup',
      encryptedRefreshToken: await encryptToken('refresh-for-cleanup', env.TOKEN_ENCRYPTION_KEY),
      scopes: OAUTH_SCOPES,
      sites: [{ cloudId: 'cloud-2', host: 'acme.atlassian.net', displayName: 'Acme Jira' }],
      exchangeCodeHash: 'cleanup-code',
      codeChallenge: 'cleanup-challenge',
      redirectUri: 'https://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.chromiumapp.org/jira-oauth',
      exchangeExpiresAt: now + 300,
    });
    expect(await store.acquireRefreshLease('installation-cleanup', 'lease-one', now + 30)).toBe(
      true,
    );
    expect(await store.acquireRefreshLease('installation-cleanup', 'lease-two', now + 30)).toBe(
      false,
    );

    now += 30 * 24 * 60 * 60 + 1;
    await store.cleanupExpired();
    await expect(
      env.DB.prepare('SELECT installation_id FROM installations WHERE installation_id = ?')
        .bind('installation-cleanup')
        .first(),
    ).resolves.toBeNull();
  });

  it('atomically rate-limits authenticated installations and resets the window', async () => {
    let now = 4_000_000;
    const store = new SessionStore(env.DB, { now: () => now });
    await env.DB.prepare(
      'INSERT INTO installations (installation_id, created_at, last_activity_at, expires_at) VALUES (?, ?, ?, ?)',
    )
      .bind('rate-installation', now, now, now + 1_000)
      .run();

    await expect(store.consumeRateLimit('rate-installation', 2, 60)).resolves.toBe(true);
    await expect(store.consumeRateLimit('rate-installation', 2, 60)).resolves.toBe(true);
    await expect(store.consumeRateLimit('rate-installation', 2, 60)).resolves.toBe(false);
    now += 61;
    await expect(store.consumeRateLimit('rate-installation', 2, 60)).resolves.toBe(true);
  });

  it('rejects credential-bearing accessible-resource URLs returned by Atlassian', async () => {
    const config = readWorkerConfig(env);
    const redirectUri = 'https://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.chromiumapp.org/jira-oauth';
    const start = await startOAuth(
      {
        redirectUri,
        codeChallenge: 'challenge-value-that-is-at-least-forty-three-characters-long',
      },
      env,
      config,
    );
    const state = new URL(start.authorizationUrl).searchParams.get('state')!;
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          access_token: 'access-token-value-long-enough',
          refresh_token: 'refresh-token-value-long-enough',
          scope: OAUTH_SCOPES,
        }),
      )
      .mockResolvedValueOnce(
        Response.json([
          {
            id: 'cloud-1',
            name: 'Acme Jira',
            url: 'https://user:password@acme.atlassian.net/',
            scopes: ['read:jira-work', 'write:jira-work'],
          },
        ]),
      );
    vi.stubGlobal('fetch', fetcher);

    const response = await handleOAuthCallback(
      new Request(`${config.oauthCallbackUrl}?state=${state}&code=authorization-code`),
      env,
      config,
    );

    expect(new URL(response.headers.get('Location')!).searchParams.get('error')).toBe(
      'site_not_authorized',
    );
  });
});
