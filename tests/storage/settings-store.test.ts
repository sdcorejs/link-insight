import { describe, expect, it, vi } from 'vitest';

import {
  GEMINI_API_KEY_STORAGE_KEY,
  SettingsStore,
  configureTrustedStorageAccess,
} from '../../src/storage/settings-store';
import { MemoryStorageArea } from '../helpers/memory-storage-area';

describe('SettingsStore', () => {
  it('saves and loads a trimmed key from local storage', async () => {
    const storage = new MemoryStorageArea();
    const store = new SettingsStore(storage);

    await store.saveApiKey('  local-test-credential  ');

    expect(storage.values.get(GEMINI_API_KEY_STORAGE_KEY)).toBe('local-test-credential');
    await expect(store.loadApiKey()).resolves.toBe('local-test-credential');
    await expect(store.hasApiKey()).resolves.toBe(true);
  });

  it('does not store an empty key', async () => {
    const storage = new MemoryStorageArea();
    const store = new SettingsStore(storage);

    await expect(store.saveApiKey('   ')).rejects.toThrow('Enter a Gemini API key before saving.');
    expect(storage.values.has(GEMINI_API_KEY_STORAGE_KEY)).toBe(false);
  });

  it('clears a saved key', async () => {
    const storage = new MemoryStorageArea();
    const store = new SettingsStore(storage);
    await store.saveApiKey('local-test-credential');

    await store.clearApiKey();

    await expect(store.loadApiKey()).resolves.toBeNull();
    await expect(store.hasApiKey()).resolves.toBe(false);
  });

  it('treats malformed stored values as missing', async () => {
    const storage = new MemoryStorageArea();
    storage.values.set(GEMINI_API_KEY_STORAGE_KEY, 123);

    await expect(new SettingsStore(storage).loadApiKey()).resolves.toBeNull();
  });
});

describe('configureTrustedStorageAccess', () => {
  it('restricts local storage to trusted extension contexts', async () => {
    const setAccessLevel = vi.fn().mockResolvedValue(undefined);

    await configureTrustedStorageAccess({ setAccessLevel });

    expect(setAccessLevel).toHaveBeenCalledOnce();
    expect(setAccessLevel).toHaveBeenCalledWith({ accessLevel: 'TRUSTED_CONTEXTS' });
  });
});
