import { describe, expect, it } from 'vitest';

import { AtlassianLinkProvider } from '../../src/link-providers/atlassian-link-provider';
import { LinkProviderRegistry } from '../../src/link-providers/link-provider-registry';

describe('AtlassianLinkProvider', () => {
  const provider = new AtlassianLinkProvider();

  it('resolves a Jira browse URL', () => {
    expect(provider.resolve('https://acme.atlassian.net/browse/CORE-123')).toEqual({
      providerId: 'atlassian',
      resourceType: 'jira-issue',
      canonicalUrl: 'https://acme.atlassian.net/browse/CORE-123',
      tenant: 'acme',
      identifier: 'CORE-123',
      metadata: {
        issueKey: 'CORE-123',
      },
    });
  });

  it('removes Jira query parameters and fragments from the canonical URL', () => {
    const resource = provider.resolve(
      'https://Acme.atlassian.net/browse/core-123?focusedCommentId=99#comment-99',
    );

    expect(resource?.identifier).toBe('CORE-123');
    expect(resource?.canonicalUrl).toBe('https://acme.atlassian.net/browse/CORE-123');
  });

  it('resolves a Confluence page and extracts its numeric page identifier', () => {
    expect(
      provider.resolve(
        'https://acme.atlassian.net/wiki/spaces/ENG/pages/123456/Architecture+Guide?preview=/1#section',
      ),
    ).toEqual({
      providerId: 'atlassian',
      resourceType: 'confluence-page',
      canonicalUrl: 'https://acme.atlassian.net/wiki/spaces/ENG/pages/123456',
      tenant: 'acme',
      identifier: '123456',
      metadata: {
        pageId: '123456',
        spaceKey: 'ENG',
        slug: 'Architecture+Guide',
      },
    });
  });

  it('resolves a generic Confluence /wiki/ path with a stable canonical URL', () => {
    const resource = provider.resolve(
      'https://acme.atlassian.net/wiki/display/ENG/Release%20Notes?src=chat#latest',
    );

    expect(resource?.resourceType).toBe('confluence-page');
    expect(resource?.identifier).toBe('Release Notes');
    expect(resource?.canonicalUrl).toBe(
      'https://acme.atlassian.net/wiki/display/ENG/Release%20Notes',
    );
  });

  it.each([
    'http://acme.atlassian.net/browse/CORE-123',
    'https://atlassian.net.evil.example/browse/CORE-123',
    'https://evil-atlassian.net/browse/CORE-123',
    'https://sub.acme.atlassian.net/browse/CORE-123',
    'https://acme.atlassian.net:8443/browse/CORE-123',
    'https://user:password@acme.atlassian.net/browse/CORE-123',
  ])('rejects an unsafe or non-tenant URL: %s', (url) => {
    expect(provider.resolve(url)).toBeNull();
  });

  it.each([
    'https://acme.atlassian.net/',
    'https://acme.atlassian.net/browse/',
    'https://acme.atlassian.net/browse/not-an-issue',
    'https://acme.atlassian.net/projects/CORE',
    'https://acme.atlassian.net/wiki/',
  ])('rejects an unsupported Atlassian path: %s', (url) => {
    expect(provider.resolve(url)).toBeNull();
  });

  it('returns null for malformed input instead of throwing', () => {
    expect(provider.resolve('not a URL')).toBeNull();
  });
});

describe('LinkProviderRegistry', () => {
  it('resolves links through registered providers without provider-specific branching', () => {
    const registry = new LinkProviderRegistry([new AtlassianLinkProvider()]);

    expect(registry.resolve('https://acme.atlassian.net/browse/CORE-7')?.identifier).toBe('CORE-7');
    expect(registry.resolve('https://example.com/browse/CORE-7')).toBeNull();
  });
});
