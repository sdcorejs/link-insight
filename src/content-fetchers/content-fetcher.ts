import type { LinkResource, NormalizedLinkContent } from '../core/contracts';

export interface ContentFetcher {
  supports(resource: LinkResource): boolean;
  fetch(resource: LinkResource): Promise<NormalizedLinkContent>;
}
