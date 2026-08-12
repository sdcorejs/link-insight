import type { LinkResource } from '../core/contracts';

export interface LinkProvider {
  readonly id: string;

  resolve(url: string | URL): LinkResource | null;
}
