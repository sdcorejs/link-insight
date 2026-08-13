import type { AiSummary } from '../core/contracts';
import type { SummaryCache } from './summary-cache';

export class SummaryRequestCoordinator {
  private readonly inFlight = new Map<string, Promise<AiSummary>>();
  private readonly generations = new Map<string, number>();

  constructor(private readonly cache: SummaryCache) {}

  getOrCreate(canonicalUrl: string, loader: () => Promise<AiSummary>): Promise<AiSummary> {
    const existing = this.inFlight.get(canonicalUrl);
    if (existing !== undefined) {
      return existing;
    }

    const generation = this.generations.get(canonicalUrl) ?? 0;
    const request = this.load(canonicalUrl, generation, loader);
    this.inFlight.set(canonicalUrl, request);
    const removeInFlight = (): void => {
      if (this.inFlight.get(canonicalUrl) === request) {
        this.inFlight.delete(canonicalUrl);
      }
    };
    void request.then(removeInFlight, removeInFlight);
    return request;
  }

  async invalidate(canonicalUrl: string): Promise<void> {
    this.generations.set(canonicalUrl, (this.generations.get(canonicalUrl) ?? 0) + 1);
    this.inFlight.delete(canonicalUrl);
    await this.cache.invalidate(canonicalUrl);
  }

  private async load(
    canonicalUrl: string,
    generation: number,
    loader: () => Promise<AiSummary>,
  ): Promise<AiSummary> {
    const cached = await this.cache.get(canonicalUrl);
    if (cached !== null) {
      return cached;
    }

    const summary = await loader();
    if ((this.generations.get(canonicalUrl) ?? 0) === generation) {
      await this.cache.set(canonicalUrl, summary);
    }
    return summary;
  }
}
