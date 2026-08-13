import { RUNTIME_CONFIG } from '../config/runtime-config';
import type { AiSummary } from '../core/contracts';
import { parseAiSummary } from '../core/summary-validation';
import type { StorageAreaLike } from './storage-area';

const CACHE_KEY_PREFIX = 'sdcorejs-link-insight:summary:';

interface CacheOptions {
  readonly ttlMs?: number;
  readonly now?: () => number;
}

export class SummaryCache {
  private readonly ttlMs: number;
  private readonly now: () => number;

  constructor(
    private readonly storage: StorageAreaLike,
    options: CacheOptions = {},
  ) {
    this.ttlMs = options.ttlMs ?? RUNTIME_CONFIG.summaryCacheTtlMs;
    this.now = options.now ?? Date.now;
  }

  async get(canonicalUrl: string): Promise<AiSummary | null> {
    const key = cacheKey(canonicalUrl);
    const result = await this.storage.get(key);
    const entry = parseCacheEntry(result[key]);

    if (entry === null || entry.expiresAt <= this.now()) {
      if (result[key] !== undefined) {
        await this.storage.remove(key);
      }
      return null;
    }

    return entry.summary;
  }

  async set(canonicalUrl: string, summary: AiSummary): Promise<void> {
    const validatedSummary = parseAiSummary(summary);
    if (validatedSummary === null) {
      throw new TypeError('Only validated three-bullet summaries can be cached.');
    }

    await this.storage.set({
      [cacheKey(canonicalUrl)]: {
        summary: validatedSummary,
        expiresAt: this.now() + this.ttlMs,
      },
    });
  }

  async invalidate(canonicalUrl: string): Promise<void> {
    await this.storage.remove(cacheKey(canonicalUrl));
  }
}

function cacheKey(canonicalUrl: string): string {
  return `${CACHE_KEY_PREFIX}${canonicalUrl}`;
}

function parseCacheEntry(value: unknown): { summary: AiSummary; expiresAt: number } | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const summary = parseAiSummary(candidate.summary);
  if (summary === null || typeof candidate.expiresAt !== 'number') {
    return null;
  }

  return { summary, expiresAt: candidate.expiresAt };
}
