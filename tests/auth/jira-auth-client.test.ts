import { describe, expect, it, vi } from 'vitest';

import { JiraAuthClient } from '../../src/auth/jira-auth-client';

const REDIRECT = 'https://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.chromiumapp.org/jira-oauth';

describe('JiraAuthClient', () => {
  it('starts interactive OAuth with PKCE and persists only the exchanged installation session', async () => {
    const saveSessionToken = vi.fn(async () => undefined);
    const saveSelectedSiteHosts = vi.fn(async () => undefined);
    const startOAuth = vi.fn(async ({ redirectUri, codeChallenge }) => {
      expect(redirectUri).toBe(REDIRECT);
      expect(codeChallenge).toMatch(/^[A-Za-z0-9_-]{43}$/u);
      return { authorizationUrl: 'https://auth.atlassian.com/authorize?unit=test' };
    });
    const exchangeOAuth = vi.fn(async ({ exchangeCode, verifier, redirectUri }) => {
      expect(exchangeCode).toBe('exchange-code-that-is-long-enough-1234');
      expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/u);
      expect(redirectUri).toBe(REDIRECT);
      return {
        sessionToken: 'opaque-session-token-that-is-long-enough',
        connection: {
          connected: true,
          reauthorizationRequired: false,
          sites: [{ host: 'acme.atlassian.net', displayName: 'Acme Jira' }],
        },
      };
    });
    const launchWebAuthFlow = vi.fn(
      async () => `${REDIRECT}?exchange_code=exchange-code-that-is-long-enough-1234`,
    );
    const client = new JiraAuthClient({
      identity: {
        getRedirectURL: () => REDIRECT,
        launchWebAuthFlow,
      },
      worker: { startOAuth, exchangeOAuth },
      settings: { saveSessionToken, saveSelectedSiteHosts },
    });

    await expect(client.connect()).resolves.toMatchObject({ connected: true });
    expect(launchWebAuthFlow).toHaveBeenCalledWith({
      url: 'https://auth.atlassian.com/authorize?unit=test',
      interactive: true,
    });
    expect(saveSessionToken).toHaveBeenCalledWith('opaque-session-token-that-is-long-enough');
    expect(saveSelectedSiteHosts).toHaveBeenCalledWith(['acme.atlassian.net']);
  });

  it('rejects a mismatched callback and never exchanges or stores it', async () => {
    const exchangeOAuth = vi.fn();
    const saveSessionToken = vi.fn();
    const client = new JiraAuthClient({
      identity: {
        getRedirectURL: () => REDIRECT,
        launchWebAuthFlow: vi.fn(
          async () =>
            'https://evil.example/jira-oauth?exchange_code=exchange-code-that-is-long-enough-1234',
        ),
      },
      worker: {
        startOAuth: vi.fn(async () => ({
          authorizationUrl: 'https://auth.atlassian.com/authorize',
        })),
        exchangeOAuth,
      },
      settings: { saveSessionToken, saveSelectedSiteHosts: vi.fn() },
    });

    await expect(client.connect()).rejects.toMatchObject({ code: 'OAUTH_STATE_INVALID' });
    expect(exchangeOAuth).not.toHaveBeenCalled();
    expect(saveSessionToken).not.toHaveBeenCalled();
  });

  it('normalizes user cancellation without exposing callback parameters', async () => {
    const client = new JiraAuthClient({
      identity: {
        getRedirectURL: () => REDIRECT,
        launchWebAuthFlow: vi.fn(async () => `${REDIRECT}?error=authorization_cancelled&secret=x`),
      },
      worker: {
        startOAuth: vi.fn(async () => ({
          authorizationUrl: 'https://auth.atlassian.com/authorize',
        })),
        exchangeOAuth: vi.fn(),
      },
      settings: { saveSessionToken: vi.fn(), saveSelectedSiteHosts: vi.fn() },
    });
    await expect(client.connect()).rejects.toMatchObject({
      code: 'OAUTH_CANCELLED',
      message: 'Jira connection was cancelled.',
    });
  });
});
