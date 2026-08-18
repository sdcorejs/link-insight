import type { StorageAreaLike, TrustedStorageAccessLike } from './storage-area';

export const GEMINI_API_KEY_STORAGE_KEY = 'geminiApiKey';

export class SettingsStore {
  constructor(private readonly storage: StorageAreaLike) {}

  async saveApiKey(value: string): Promise<void> {
    const apiKey = value.trim();
    if (apiKey === '') {
      throw new Error('Enter a Gemini API key before saving.');
    }

    await this.storage.set({ [GEMINI_API_KEY_STORAGE_KEY]: apiKey });
  }

  async loadApiKey(): Promise<string | null> {
    const stored = await this.storage.get(GEMINI_API_KEY_STORAGE_KEY);
    const value = stored[GEMINI_API_KEY_STORAGE_KEY];
    return typeof value === 'string' && value.trim() !== '' ? value : null;
  }

  async hasApiKey(): Promise<boolean> {
    return (await this.loadApiKey()) !== null;
  }

  async clearApiKey(): Promise<void> {
    await this.storage.remove(GEMINI_API_KEY_STORAGE_KEY);
  }
}

export async function configureTrustedStorageAccess(
  storage: TrustedStorageAccessLike,
): Promise<void> {
  await storage.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
}
