import type { AiSummary } from './contracts';

export function parseAiSummary(value: unknown): AiSummary | null {
  if (!isRecord(value) || hasUnexpectedKeys(value, ['bullets']) || !Array.isArray(value.bullets)) {
    return null;
  }

  if (value.bullets.length !== 3) {
    return null;
  }

  const [first, second, third] = value.bullets;
  if (!isNonEmptyString(first) || !isNonEmptyString(second) || !isNonEmptyString(third)) {
    return null;
  }

  return {
    bullets: [first.trim(), second.trim(), third.trim()],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasUnexpectedKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
): boolean {
  return Object.keys(value).some((key) => !allowedKeys.includes(key));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}
