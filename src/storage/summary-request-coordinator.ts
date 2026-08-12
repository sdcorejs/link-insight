import type { AiSummary } from '../core/contracts';
import type { SummaryCache } from './summary-cache';

export class SummaryRequestCoordinator {
  private readonly inFlight = new Map<string, Promise<AiSummary>>();

  constructor(private readonly cache: SummaryCache) {}

  getOrCreate(canonicalUrl: string, loader: () => Promise<AiSummary>): Promise<AiSummary> {
    const existing = this.inFlight.get(canonicalUrl);
    if (existing !== undefined) {
      return existing;
    }

    const request = this.load(canonicalUrl, loader);
    this.inFlight.set(canonicalUrl, request);
    const removeInFlight = (): void => {
      if (this.inFlight.get(canonicalUrl) === request) {
        this.inFlight.delete(canonicalUrl);
      }
    };
    void request.then(removeInFlight, removeInFlight);
    return request;
  }

  private async load(canonicalUrl: string, loader: () => Promise<AiSummary>): Promise<AiSummary> {
    const cached = await this.cache.get(canonicalUrl);
    if (cached !== null) {
      return cached;
    }

    const summary = await loader();
    await this.cache.set(canonicalUrl, summary);
    return summary;
  }
}
