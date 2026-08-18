import type { LinkResource, NormalizedLinkContent } from '../core/contracts';
import { LinkInsightError } from '../core/errors';
import type { ContentFetcher } from './content-fetcher';

interface MockFetcherOptions {
  readonly delayMs?: number;
}

const MOCK_PEOPLE = ['Alex Nguyen', 'Jamie Tran', 'Morgan Lee', 'Sam Patel'] as const;

export class MockAtlassianContentFetcher implements ContentFetcher {
  private readonly delayMs: number;

  constructor(options: MockFetcherOptions = {}) {
    this.delayMs = options.delayMs ?? 80;
  }

  supports(resource: LinkResource): boolean {
    return resource.providerId === 'atlassian' && resource.resourceType === 'confluence-page';
  }

  async fetch(resource: LinkResource): Promise<NormalizedLinkContent> {
    if (!this.supports(resource)) {
      throw new LinkInsightError(
        'CONTENT_FETCH_FAILED',
        'Content is not available for this supported link.',
      );
    }

    if (this.delayMs > 0) {
      await delay(this.delayMs);
    }

    return createConfluenceContent(resource);
  }
}

function createConfluenceContent(resource: LinkResource): NormalizedLinkContent {
  const seed = stableSeed(resource.identifier);
  const rawSlug = resource.metadata.slug?.trim();
  const title = rawSlug === undefined || rawSlug === '' ? `Page ${resource.identifier}` : rawSlug;
  const updatedDay = String((seed % 27) + 1).padStart(2, '0');

  return {
    providerId: resource.providerId,
    resourceType: resource.resourceType,
    identifier: resource.identifier,
    title: `${title} — team reference`,
    body: 'This page documents the current architecture, key operating decisions, known constraints, and the verification steps teams should follow when changing the workflow.',
    attributes: {
      space: resource.metadata.spaceKey ?? 'TEAM',
      author: select(MOCK_PEOPLE, seed),
      updatedAt: `2026-07-${updatedDay}`,
    },
  };
}

function stableSeed(value: string): number {
  let seed = 0;
  for (const character of value) {
    seed = (seed * 31 + character.codePointAt(0)!) >>> 0;
  }
  return seed;
}

function select<T>(values: readonly T[], seed: number): T {
  return values[seed % values.length]!;
}

async function delay(milliseconds: number): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}
