export const TEST_WORKER_ORIGIN = 'https://link-insight.invalid';

export const RUNTIME_CONFIG = Object.freeze({
  gemini: Object.freeze({
    baseUrl: 'https://generativelanguage.googleapis.com',
    apiVersion: 'v1beta',
    endpointPath: '/interactions',
    model: 'gemini-3.6-flash',
    timeoutMs: 15_000,
    maxOutputTokens: 220,
    thinkingLevel: 'low',
  }),
  summaryCacheTtlMs: 5 * 60 * 1_000,
  hoverDwellMs: 500,
  worker: Object.freeze({
    origin: parseWorkerOrigin(import.meta.env.WXT_WORKER_ORIGIN ?? TEST_WORKER_ORIGIN),
    timeoutMs: 12_000,
    contextTotalCharacterLimit: 16_000,
    commentLimit: 3,
    commentCharacterLimit: 1_000,
  }),
});

export function parseWorkerOrigin(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError('WXT_WORKER_ORIGIN must be an absolute HTTPS origin.');
  }
  if (
    url.protocol !== 'https:' ||
    url.username !== '' ||
    url.password !== '' ||
    url.port !== '' ||
    url.pathname !== '/' ||
    url.search !== '' ||
    url.hash !== ''
  ) {
    throw new TypeError(
      'WXT_WORKER_ORIGIN must be an exact HTTPS origin without credentials or a path.',
    );
  }
  return url.origin;
}
