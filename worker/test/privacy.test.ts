import { describe, expect, it } from 'vitest';

import { createHealthResponse, createPrivacyResponse } from '../src/privacy';

describe('public Worker responses', () => {
  it('returns a non-sensitive health response with no-store headers', async () => {
    const response = createHealthResponse();
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({ status: 'ok' });
  });

  it('discloses D1, Atlassian, Gemini, retention, and disconnect controls', async () => {
    const response = createPrivacyResponse();
    const text = await response.text();
    expect(response.headers.get('Content-Security-Policy')).toContain("default-src 'none'");
    expect(text).toContain('Cloudflare D1');
    expect(text).toContain('Atlassian OAuth');
    expect(text).toContain('Google Gemini');
    expect(text).toContain('30 days');
    expect(text).toContain('Disconnect Jira');
    expect(text).not.toContain('<script');
  });
});
