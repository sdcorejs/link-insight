import { describe, expect, it } from 'vitest';

import {
  parseJiraContextRequest,
  parseJiraTransitionExecuteRequest,
} from '../../src/core/worker-api-contracts';

describe('Worker-side shared contracts', () => {
  it('rejects HTTP, credentials, dotted tenants, and proxy-shaped requests', () => {
    expect(
      parseJiraContextRequest({ siteHost: 'acme.atlassian.net', issueKey: 'CORE-8' }),
    ).not.toBeNull();
    expect(
      parseJiraContextRequest({ siteHost: 'https://acme.atlassian.net', issueKey: 'CORE-8' }),
    ).toBeNull();
    expect(
      parseJiraContextRequest({ siteHost: 'one.two.atlassian.net', issueKey: 'CORE-8' }),
    ).toBeNull();
    expect(
      parseJiraContextRequest({ siteHost: 'evil-atlassian.net', issueKey: 'CORE-8' }),
    ).toBeNull();
    expect(
      parseJiraContextRequest({
        siteHost: 'acme.atlassian.net',
        issueKey: 'CORE-8',
        method: 'DELETE',
      }),
    ).toBeNull();
  });

  it('rejects fields that cannot be represented by the normalized write contract', () => {
    expect(
      parseJiraTransitionExecuteRequest({
        siteHost: 'acme.atlassian.net',
        issueKey: 'CORE-8',
        transitionId: '31',
        idempotencyKey: '9d2d30b6-cf23-4ce1-8127-f2c24aa139f8',
        values: { nested: { arbitrary: true } },
      }),
    ).toBeNull();
  });
});
