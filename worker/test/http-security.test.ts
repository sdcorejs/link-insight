import { describe, expect, it } from 'vitest';

import { buildCorsHeaders, isAllowedExtensionOrigin, readJsonBody } from '../src/http';

const ALLOWED = new Set(['aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa']);

describe('Worker HTTP boundary', () => {
  it('allows only exact configured Chrome extension origins', () => {
    expect(
      isAllowedExtensionOrigin('chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', ALLOWED),
    ).toBe(true);
    expect(
      isAllowedExtensionOrigin('https://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.example', ALLOWED),
    ).toBe(false);
    expect(
      isAllowedExtensionOrigin('chrome-extension://bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', ALLOWED),
    ).toBe(false);
    expect(isAllowedExtensionOrigin('null', ALLOWED)).toBe(false);
  });

  it('emits credentialed CORS only for an approved origin', () => {
    const headers = buildCorsHeaders(
      'chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      ALLOWED,
    );
    expect(headers.get('Access-Control-Allow-Origin')).toBe(
      'chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    );
    expect(headers.get('Vary')).toBe('Origin');
    expect(
      buildCorsHeaders('https://evil.example', ALLOWED).has('Access-Control-Allow-Origin'),
    ).toBe(false);
  });

  it('requires JSON and rejects oversized or malformed bodies', async () => {
    await expect(
      readJsonBody(
        new Request('https://link-insight.invalid/v1/jira/context', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ issueKey: 'CORE-1' }),
        }),
        1_024,
      ),
    ).resolves.toEqual({ issueKey: 'CORE-1' });

    await expect(
      readJsonBody(
        new Request('https://link-insight.invalid/v1/jira/context', {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: '{}',
        }),
        1_024,
      ),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    await expect(
      readJsonBody(
        new Request('https://link-insight.invalid/v1/jira/context', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: 'x'.repeat(100) }),
        }),
        32,
      ),
    ).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
  });
});
