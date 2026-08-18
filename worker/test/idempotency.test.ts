import { describe, expect, it, vi } from 'vitest';

import { WorkerHttpError } from '../src/http';
import { executeJiraWriteWithIdempotency } from '../src/idempotency';

describe('Jira write idempotency finalization', () => {
  it('never abandons a claim after Jira succeeds when applied-state persistence fails', async () => {
    const abandon = vi.fn(async () => undefined);

    await expect(
      executeJiraWriteWithIdempotency({
        execute: vi.fn(async () => undefined),
        complete: vi.fn(async () => false),
        abandon,
      }),
    ).rejects.toMatchObject({ code: 'AMBIGUOUS_WRITE_OUTCOME' });
    expect(abandon).not.toHaveBeenCalled();
  });

  it('abandons the claim only when Jira deterministically rejects the write', async () => {
    const rejection = new WorkerHttpError(
      422,
      'JIRA_FIELD_VALIDATION',
      'The transition values are invalid.',
    );
    const abandon = vi.fn(async () => undefined);

    await expect(
      executeJiraWriteWithIdempotency({
        execute: vi.fn(async () => {
          throw rejection;
        }),
        complete: vi.fn(async () => true),
        abandon,
      }),
    ).rejects.toBe(rejection);
    expect(abandon).toHaveBeenCalledTimes(1);
  });

  it('keeps the claim pending for an unexpected write failure', async () => {
    const unexpected = new Error('unexpected runtime failure');
    const abandon = vi.fn(async () => undefined);

    await expect(
      executeJiraWriteWithIdempotency({
        execute: vi.fn(async () => {
          throw unexpected;
        }),
        complete: vi.fn(async () => true),
        abandon,
      }),
    ).rejects.toMatchObject({ code: 'AMBIGUOUS_WRITE_OUTCOME' });
    expect(abandon).not.toHaveBeenCalled();
  });
});
