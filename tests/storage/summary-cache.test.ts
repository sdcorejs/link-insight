import { describe, expect, it, vi } from 'vitest';

import type { AiSummary } from '../../src/core/contracts';
import { SummaryCache } from '../../src/storage/summary-cache';
import { SummaryRequestCoordinator } from '../../src/storage/summary-request-coordinator';
import { MemoryStorageArea } from '../helpers/memory-storage-area';

const URL = 'https://acme.atlassian.net/browse/CORE-123';
const SUMMARY: AiSummary = {
  bullets: ['First point', 'Second point', 'Third point'],
};

describe('SummaryCache', () => {
  it('returns a validated summary before its TTL expires', async () => {
    const storage = new MemoryStorageArea();
    let now = 1_000;
    const cache = new SummaryCache(storage, { ttlMs: 300_000, now: () => now });
    await cache.set(URL, SUMMARY);

    now += 299_999;

    await expect(cache.get(URL)).resolves.toEqual(SUMMARY);
  });

  it('removes and misses an expired summary', async () => {
    const storage = new MemoryStorageArea();
    let now = 1_000;
    const cache = new SummaryCache(storage, { ttlMs: 100, now: () => now });
    await cache.set(URL, SUMMARY);

    now += 101;

    await expect(cache.get(URL)).resolves.toBeNull();
    expect(storage.values.size).toBe(0);
  });

  it('rejects corrupted cache entries', async () => {
    const storage = new MemoryStorageArea();
    storage.values.set(`sdcorejs-link-insight:summary:${URL}`, {
      summary: { bullets: ['only one'] },
      expiresAt: Date.now() + 1_000,
    });

    await expect(new SummaryCache(storage).get(URL)).resolves.toBeNull();
    expect(storage.values.size).toBe(0);
  });
});

describe('SummaryRequestCoordinator', () => {
  it('uses a cache hit without invoking the loader', async () => {
    const storage = new MemoryStorageArea();
    const cache = new SummaryCache(storage);
    await cache.set(URL, SUMMARY);
    const loader = vi.fn<() => Promise<AiSummary>>();

    const result = await new SummaryRequestCoordinator(cache).getOrCreate(URL, loader);

    expect(result).toEqual(SUMMARY);
    expect(loader).not.toHaveBeenCalled();
  });

  it('deduplicates concurrent requests for the same canonical URL', async () => {
    const cache = new SummaryCache(new MemoryStorageArea());
    const coordinator = new SummaryRequestCoordinator(cache);
    let resolveLoader: ((summary: AiSummary) => void) | undefined;
    const loader = vi.fn(
      () =>
        new Promise<AiSummary>((resolve) => {
          resolveLoader = resolve;
        }),
    );

    const first = coordinator.getOrCreate(URL, loader);
    const second = coordinator.getOrCreate(URL, loader);
    await vi.waitFor(() => expect(loader).toHaveBeenCalledOnce());
    resolveLoader?.(SUMMARY);

    await expect(Promise.all([first, second])).resolves.toEqual([SUMMARY, SUMMARY]);
    expect(loader).toHaveBeenCalledOnce();
  });

  it('does not cache loader errors as successful summaries', async () => {
    const cache = new SummaryCache(new MemoryStorageArea());
    const coordinator = new SummaryRequestCoordinator(cache);
    const loader = vi
      .fn<() => Promise<AiSummary>>()
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValueOnce(SUMMARY);

    await expect(coordinator.getOrCreate(URL, loader)).rejects.toThrow('temporary failure');
    await expect(coordinator.getOrCreate(URL, loader)).resolves.toEqual(SUMMARY);
    expect(loader).toHaveBeenCalledTimes(2);
  });
});
