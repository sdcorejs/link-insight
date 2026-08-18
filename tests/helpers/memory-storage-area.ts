import type { StorageAreaLike } from '../../src/storage/storage-area';

export class MemoryStorageArea implements StorageAreaLike {
  readonly values = new Map<string, unknown>();

  async get(keys: string | readonly string[]): Promise<Record<string, unknown>> {
    const selectedKeys = typeof keys === 'string' ? [keys] : keys;
    return Object.fromEntries(
      selectedKeys.filter((key) => this.values.has(key)).map((key) => [key, this.values.get(key)]),
    );
  }

  async set(items: Readonly<Record<string, unknown>>): Promise<void> {
    for (const [key, value] of Object.entries(items)) {
      this.values.set(key, structuredClone(value));
    }
  }

  async remove(keys: string | readonly string[]): Promise<void> {
    const selectedKeys = typeof keys === 'string' ? [keys] : keys;
    for (const key of selectedKeys) {
      this.values.delete(key);
    }
  }
}
