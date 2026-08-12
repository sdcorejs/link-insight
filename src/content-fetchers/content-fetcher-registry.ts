import type { LinkResource, NormalizedLinkContent } from '../core/contracts';
import { LinkInsightError } from '../core/errors';
import type { ContentFetcher } from './content-fetcher';

export class ContentFetcherRegistry {
  constructor(private readonly fetchers: readonly ContentFetcher[]) {}

  async fetch(resource: LinkResource): Promise<NormalizedLinkContent> {
    const fetcher = this.fetchers.find((candidate) => candidate.supports(resource));
    if (fetcher === undefined) {
      throw new LinkInsightError(
        'CONTENT_FETCH_FAILED',
        'Content is not available for this supported link.',
      );
    }

    return fetcher.fetch(resource);
  }
}
