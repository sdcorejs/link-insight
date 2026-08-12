import type { LinkResource } from '../core/contracts';
import type { LinkProvider } from './link-provider';

export class LinkProviderRegistry {
  constructor(private readonly providers: readonly LinkProvider[]) {}

  resolve(url: string | URL): LinkResource | null {
    for (const provider of this.providers) {
      const resource = provider.resolve(url);
      if (resource !== null) {
        return resource;
      }
    }

    return null;
  }
}
