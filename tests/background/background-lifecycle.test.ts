import { describe, expect, it, vi } from 'vitest';

import { registerBackgroundLifecycle } from '../../src/background/background-lifecycle';

describe('registerBackgroundLifecycle', () => {
  it('protects storage and opens options only on first install or toolbar click', async () => {
    let installedListener: ((details: { reason: string }) => void) | undefined;
    let actionListener: (() => void) | undefined;
    const protectStorage = vi.fn(async () => undefined);
    const openOptionsPage = vi.fn(async () => undefined);

    registerBackgroundLifecycle({
      protectStorage,
      openOptionsPage,
      onInstalled: {
        addListener: (listener) => {
          installedListener = listener;
        },
      },
      onActionClicked: {
        addListener: (listener) => {
          actionListener = listener;
        },
      },
    });

    expect(protectStorage).toHaveBeenCalledOnce();
    expect(installedListener).toBeTypeOf('function');
    expect(actionListener).toBeTypeOf('function');

    installedListener?.({ reason: 'install' });
    await flushMicrotasks();
    expect(protectStorage).toHaveBeenCalledTimes(2);
    expect(openOptionsPage).toHaveBeenCalledOnce();

    installedListener?.({ reason: 'update' });
    await flushMicrotasks();
    expect(protectStorage).toHaveBeenCalledTimes(3);
    expect(openOptionsPage).toHaveBeenCalledOnce();

    actionListener?.();
    await flushMicrotasks();
    expect(openOptionsPage).toHaveBeenCalledTimes(2);
  });
});

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}
