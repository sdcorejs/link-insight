import { describe, expect, it, vi } from 'vitest';

import type { LinkResource } from '../../src/core/contracts';
import { JiraContentFetcher } from '../../src/content-fetchers/jira-content-fetcher';

const RESOURCE: LinkResource = {
  providerId: 'atlassian',
  resourceType: 'jira-issue',
  canonicalUrl: 'https://acme.atlassian.net/browse/CORE-123',
  tenant: 'acme',
  identifier: 'CORE-123',
  metadata: { issueKey: 'CORE-123' },
};

const CONTEXT = {
  issueKey: 'CORE-123',
  title: 'Release safely',
  description: 'Prepare the production rollout.',
  issueType: 'Task',
  status: 'In Progress',
  priority: 'High',
  assignee: 'Ada Lovelace',
  labels: ['release'],
  comments: ['QA approved', 'Runbook updated', 'Rollback ready'],
};

describe('JiraContentFetcher', () => {
  it('supports only Jira issue resources', () => {
    const { fetcher } = setup();
    expect(fetcher.supports(RESOURCE)).toBe(true);
    expect(fetcher.supports({ ...RESOURCE, resourceType: 'confluence-page' })).toBe(false);
  });

  it.each([
    [{ session: null }, 'JIRA_NOT_CONNECTED'],
    [{ sites: [] }, 'JIRA_SITE_NOT_AUTHORIZED'],
    [{ apiKey: null }, 'MISSING_API_KEY'],
    [{ consent: false }, 'JIRA_AI_CONSENT_REQUIRED'],
  ] as const)(
    'enforces connection, site, key, and default-off consent: %s',
    async (overrides, code) => {
      const { fetcher, getContext } = setup(overrides);
      await expect(fetcher.fetch(RESOURCE)).rejects.toMatchObject({ code });
      expect(getContext).not.toHaveBeenCalled();
    },
  );

  it('retrieves only normalized real Jira content and minimizes comment transfer', async () => {
    const { fetcher, getContext } = setup();

    await expect(fetcher.fetch(RESOURCE)).resolves.toEqual({
      providerId: 'atlassian',
      resourceType: 'jira-issue',
      identifier: 'CORE-123',
      title: 'Release safely',
      body: 'Prepare the production rollout.\n\nRecent comments:\n- QA approved\n- Runbook updated\n- Rollback ready',
      attributes: {
        issueType: 'Task',
        status: 'In Progress',
        priority: 'High',
        assignee: 'Ada Lovelace',
        labels: 'release',
      },
    });
    expect(getContext).toHaveBeenCalledWith('stored-session', {
      siteHost: 'acme.atlassian.net',
      issueKey: 'CORE-123',
    });
    expect(JSON.stringify(getContext.mock.calls)).not.toContain(RESOURCE.canonicalUrl);
  });
});

function setup(
  overrides: {
    readonly session?: string | null;
    readonly sites?: readonly string[];
    readonly apiKey?: string | null;
    readonly consent?: boolean;
  } = {},
) {
  const getContext = vi.fn(async () => CONTEXT);
  const fetcher = new JiraContentFetcher({
    settings: {
      loadSessionToken: vi.fn(async () =>
        overrides.session === undefined ? 'stored-session' : overrides.session,
      ),
      loadSelectedSiteHosts: vi.fn(async () => overrides.sites ?? ['acme.atlassian.net']),
      loadAiConsent: vi.fn(async () => overrides.consent ?? true),
      loadApiKey: vi.fn(async () =>
        overrides.apiKey === undefined ? 'gemini-key-present' : overrides.apiKey,
      ),
    },
    worker: { getContext },
  });
  return { fetcher, getContext };
}
