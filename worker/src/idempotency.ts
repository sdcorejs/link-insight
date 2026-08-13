import { WorkerHttpError } from './http';

interface JiraWriteIdempotencyCallbacks {
  readonly execute: () => Promise<void>;
  readonly complete: (outcome: 'applied' | 'ambiguous') => Promise<boolean>;
  readonly abandon: () => Promise<void>;
}

export async function executeJiraWriteWithIdempotency(
  callbacks: JiraWriteIdempotencyCallbacks,
): Promise<void> {
  try {
    await callbacks.execute();
  } catch (error) {
    if (error instanceof WorkerHttpError && error.code === 'AMBIGUOUS_WRITE_OUTCOME') {
      await callbacks.complete('ambiguous').catch(() => false);
      throw error;
    }
    if (isDeterministicRejection(error)) {
      await callbacks.abandon().catch(() => undefined);
      throw error;
    }
    throw new WorkerHttpError(
      502,
      'AMBIGUOUS_WRITE_OUTCOME',
      'Jira may have applied the transition. Refresh before trying again.',
    );
  }

  const completed = await callbacks.complete('applied').catch(() => false);
  if (!completed) {
    throw new WorkerHttpError(
      409,
      'AMBIGUOUS_WRITE_OUTCOME',
      'Jira applied the transition, but confirmation could not be persisted. Refresh before trying again.',
    );
  }
}

function isDeterministicRejection(error: unknown): error is WorkerHttpError {
  return (
    error instanceof WorkerHttpError &&
    [
      'SESSION_EXPIRED',
      'JIRA_FORBIDDEN',
      'JIRA_NOT_FOUND',
      'JIRA_TRANSITION_STALE',
      'JIRA_FIELD_VALIDATION',
      'JIRA_RATE_LIMIT',
    ].includes(error.code)
  );
}
