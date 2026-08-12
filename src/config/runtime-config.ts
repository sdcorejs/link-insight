export const RUNTIME_CONFIG = Object.freeze({
  gemini: Object.freeze({
    baseUrl: 'https://generativelanguage.googleapis.com',
    apiVersion: 'v1',
    endpointPath: '/interactions',
    model: 'gemini-3.6-flash',
    timeoutMs: 15_000,
    maxOutputTokens: 220,
    thinkingLevel: 'low',
  }),
  summaryCacheTtlMs: 5 * 60 * 1_000,
  hoverDwellMs: 500,
});
