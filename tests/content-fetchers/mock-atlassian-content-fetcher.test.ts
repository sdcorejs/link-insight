import { describe, expect, it } from 'vitest';

import type { LinkResource } from '../../src/core/contracts';
import { LinkInsightError } from '../../src/core/errors';
import { ContentFetcherRegistry } from '../../src/content-fetchers/content-fetcher-registry';
import { MockAtlassianContentFetcher } from '../../src/content-fetchers/mock-atlassian-content-fetcher';

const JIRA_RESOURCE: LinkResource = {
  providerId: 'atlassian',
  resourceType: 'jira-issue',
  canonicalUrl: 'https://acme.atlassian.net/browse/CORE-123',
  tenant: 'acme',
  identifier: 'CORE-123',
  metadata: { issueKey: 'CORE-123' },
};

const CONFLUENCE_RESOURCE: LinkResource = {
  providerId: 'atlassian',
  resourceType: 'confluence-page',
  canonicalUrl: 'https://acme.atlassian.net/wiki/spaces/ENG/pages/123456',
  tenant: 'acme',
  identifier: '123456',
  metadata: { pageId: '123456', spaceKey: 'ENG', slug: 'Architecture' },
};

describe('MockAtlassianContentFetcher', () => {
  const fetcher = new MockAtlassianContentFetcher({ delayMs: 0 });

  it('returns deterministic normalized Jira content', async () => {
    const first = await fetcher.fetch(JIRA_RESOURCE);
    const second = await fetcher.fetch(JIRA_RESOURCE);

    expect(first).toEqual(second);
    expect(first.providerId).toBe('atlassian');
    expect(first.resourceType).toBe('jira-issue');
    expect(first.identifier).toBe('CORE-123');
    expect(first.title).toContain('CORE-123');
    expect(first.attributes).toMatchObject({
      status: expect.any(String),
      priority: expect.any(String),
      assignee: expect.any(String),
    });
    expect(first.attributes).not.toHaveProperty('tenant');
  });

  it('returns deterministic normalized Confluence content', async () => {
    const content = await fetcher.fetch(CONFLUENCE_RESOURCE);

    expect(content.providerId).toBe('atlassian');
    expect(content.resourceType).toBe('confluence-page');
    expect(content.identifier).toBe('123456');
    expect(content.title).toContain('Architecture');
    expect(content.body.length).toBeGreaterThan(20);
    expect(content.attributes).toMatchObject({
      space: 'ENG',
      author: expect.any(String),
      updatedAt: expect.any(String),
    });
    expect(content.attributes).not.toHaveProperty('tenant');
  });

  it('rejects unsupported resource types', async () => {
    const unsupported = { ...JIRA_RESOURCE, resourceType: 'gitlab-issue' };

    await expect(fetcher.fetch(unsupported)).rejects.toMatchObject({
      code: 'CONTENT_FETCH_FAILED',
    });
  });
});

describe('ContentFetcherRegistry', () => {
  it('routes a resource to the registered fetcher', async () => {
    const registry = new ContentFetcherRegistry([new MockAtlassianContentFetcher({ delayMs: 0 })]);

    await expect(registry.fetch(JIRA_RESOURCE)).resolves.toMatchObject({
      identifier: 'CORE-123',
    });
  });

  it('returns a structured error when no fetcher supports the resource', async () => {
    const registry = new ContentFetcherRegistry([]);

    const error = await captureError(registry.fetch(JIRA_RESOURCE));

    expect(error).toBeInstanceOf(LinkInsightError);
    expect((error as LinkInsightError).code).toBe('CONTENT_FETCH_FAILED');
  });
});

async function captureError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
    throw new Error('Expected the promise to reject');
  } catch (error) {
    return error;
  }
}
