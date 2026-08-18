import { env } from 'cloudflare:workers';
import { describe, expect, it, vi } from 'vitest';

import worker from '../src/index';
import { encryptToken, hashOpaqueToken } from '../src/token-crypto';

const ORIGIN = 'chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const SESSION_TOKEN = 'unit-test-installation-session-token-value';

describe('Jira transition route idempotency', () => {
  it('returns an applied replay without consulting mutable Jira state or writing twice', async () => {
    await seedInstallation();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          access_token: 'access-token-value-long-enough',
          refresh_token: 'rotated-refresh-token-long-enough',
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          key: 'CORE-1',
          fields: {
            summary: 'Release safely',
            description: null,
            issuetype: { name: 'Task' },
            status: { name: 'Open' },
            priority: null,
            assignee: null,
            labels: [],
            comment: { comments: [] },
          },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          transitions: [
            {
              id: '31',
              name: 'Done',
              to: { name: 'Done' },
              fields: {},
            },
          ],
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetcher);
    const requestBody = {
      siteHost: 'acme.atlassian.net',
      issueKey: 'CORE-1',
      transitionId: '31',
      idempotencyKey: '00000000-0000-4000-8000-000000000001',
      values: {},
    };

    const first = await worker.fetch(createRequest(requestBody), env);
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ applied: true, newStatus: 'Done' });

    const replay = await worker.fetch(createRequest(requestBody), env);
    expect(replay.status).toBe(200);
    expect(await replay.json()).toEqual({ issueKey: 'CORE-1', applied: false });
    expect(fetcher).toHaveBeenCalledTimes(4);
  });
});

function createRequest(body: unknown): Request {
  return new Request('https://link-insight.invalid/v1/jira/transitions/execute', {
    method: 'POST',
    headers: {
      Origin: ORIGIN,
      Authorization: `Bearer ${SESSION_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

async function seedInstallation(): Promise<void> {
  const now = Math.floor(Date.now() / 1_000);
  const encrypted = await encryptToken(
    'initial-refresh-token-long-enough',
    env.TOKEN_ENCRYPTION_KEY,
  );
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO installations
          (installation_id, session_token_hash, created_at, last_activity_at, expires_at)
         VALUES (?, ?, ?, ?, ?)`,
    ).bind(
      'installation-route-test',
      await hashOpaqueToken(SESSION_TOKEN, env.SESSION_HMAC_KEY),
      now,
      now,
      now + 3_600,
    ),
    env.DB.prepare(
      `INSERT INTO grants
          (installation_id, refresh_token_ciphertext, refresh_token_iv, key_version, scopes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      'installation-route-test',
      encrypted.ciphertext,
      encrypted.iv,
      encrypted.keyVersion,
      'offline_access read:jira-work write:jira-work',
      now,
      now,
    ),
    env.DB.prepare(
      `INSERT INTO jira_sites
          (installation_id, cloud_id, host, display_name, created_at)
         VALUES (?, ?, ?, ?, ?)`,
    ).bind('installation-route-test', 'cloud-1', 'acme.atlassian.net', 'Acme Jira', now),
  ]);
}
