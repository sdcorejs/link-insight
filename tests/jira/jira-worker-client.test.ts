import { describe, expect, it, vi } from 'vitest';

import { JiraWorkerClient, type WorkerFetch } from '../../src/jira/jira-worker-client';

const CONNECTION = {
  connected: true,
  reauthorizationRequired: false,
  sites: [{ host: 'acme.atlassian.net', displayName: 'Acme Jira' }],
};

describe('JiraWorkerClient', () => {
  it('uses only fixed endpoints and puts the installation token in a header, never the URL', async () => {
    const fetcher = vi.fn<WorkerFetch>(
      async () =>
        new Response(JSON.stringify(CONNECTION), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    const client = new JiraWorkerClient({
      origin: 'https://worker.example',
      fetcher,
    });

    await expect(client.getConnection('opaque-installation-session')).resolves.toEqual(CONNECTION);

    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe('https://worker.example/v1/connection');
    expect(String(url)).not.toContain('opaque-installation-session');
    expect(new Headers(init?.headers).get('Authorization')).toBe(
      'Bearer opaque-installation-session',
    );
  });

  it('constructs exact Jira request bodies and does not retry writes', async () => {
    const fetcher = vi.fn<WorkerFetch>(
      async () =>
        new Response(
          JSON.stringify({
            issueKey: 'CORE-1',
            oldStatus: 'Open',
            newStatus: 'Done',
            applied: true,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
    );
    const client = new JiraWorkerClient({ origin: 'https://worker.example', fetcher });
    const request = {
      siteHost: 'acme.atlassian.net',
      issueKey: 'CORE-1',
      transitionId: '31',
      idempotencyKey: '00000000-0000-4000-8000-000000000001',
      values: { resolution: '1' },
      comment: 'Ready',
    };

    await expect(client.executeTransition('session-token-value', request)).resolves.toMatchObject({
      applied: true,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]![0]).toBe('https://worker.example/v1/jira/transitions/execute');
    expect(JSON.parse(String(fetcher.mock.calls[0]![1]?.body))).toEqual(request);
  });

  it('rejects an OAuth authorization response whose callback leaves the configured Worker origin', async () => {
    const authorizationUrl = new URL('https://auth.atlassian.com/authorize');
    authorizationUrl.searchParams.set('audience', 'api.atlassian.com');
    authorizationUrl.searchParams.set('client_id', 'unit-test-client');
    authorizationUrl.searchParams.set('scope', 'offline_access read:jira-work write:jira-work');
    authorizationUrl.searchParams.set('redirect_uri', 'https://attacker.example/oauth/callback');
    authorizationUrl.searchParams.set(
      'state',
      'state-value-that-is-at-least-thirty-two-characters',
    );
    authorizationUrl.searchParams.set('response_type', 'code');
    authorizationUrl.searchParams.set('prompt', 'consent');
    const client = new JiraWorkerClient({
      origin: 'https://worker.example',
      fetcher: vi.fn<WorkerFetch>(
        async () => new Response(JSON.stringify({ authorizationUrl }), { status: 200 }),
      ),
    });

    await expect(
      client.startOAuth({
        redirectUri: 'https://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.chromiumapp.org/jira-oauth',
        codeChallenge: 'a'.repeat(43),
      }),
    ).rejects.toMatchObject({ code: 'WORKER_INVALID_RESPONSE' });
  });

  it('runtime-validates responses and maps normalized Worker errors without raw details', async () => {
    const invalidClient = new JiraWorkerClient({
      origin: 'https://worker.example',
      fetcher: vi.fn<WorkerFetch>(
        async () => new Response(JSON.stringify({ connected: 'yes' }), { status: 200 }),
      ),
    });
    await expect(invalidClient.getConnection('session-token-value')).rejects.toMatchObject({
      code: 'WORKER_INVALID_RESPONSE',
    });

    const errorClient = new JiraWorkerClient({
      origin: 'https://worker.example',
      fetcher: vi.fn<WorkerFetch>(
        async () =>
          new Response(
            JSON.stringify({
              error: { code: 'JIRA_RATE_LIMIT', message: 'Try again later.' },
            }),
            { status: 429, headers: { 'X-Upstream-Debug': 'protected upstream body' } },
          ),
      ),
    });
    const error = await errorClient
      .getConnection('session-token-value')
      .catch((value: unknown) => value);
    expect(error).toMatchObject({ code: 'JIRA_RATE_LIMIT', message: 'Try again later.' });
    expect(JSON.stringify(error)).not.toContain('protected upstream body');
  });
});
