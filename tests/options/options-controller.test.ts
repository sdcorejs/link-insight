// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { initializeOptionsPage } from '../../src/options/options-controller';
import { SettingsStore } from '../../src/storage/settings-store';
import { MemoryStorageArea } from '../helpers/memory-storage-area';

beforeEach(() => {
  document.body.innerHTML = `
    <form id="api-key-form">
      <label for="gemini-api-key">Gemini API key</label>
      <input id="gemini-api-key" type="password" />
      <button type="submit">Save</button>
      <button id="clear-key" type="button">Clear key</button>
    </form>
    <p id="save-status" aria-live="polite"></p>
  `;
});

describe('initializeOptionsPage', () => {
  it('loads saved-key state without putting the key in the input', async () => {
    const storage = new MemoryStorageArea();
    const store = new SettingsStore(storage);
    await store.saveApiKey('stored-local-credential');

    await initializeOptionsPage(document, store);

    const input = getInput();
    expect(input.type).toBe('password');
    expect(input.value).toBe('');
    expect(input.placeholder).toBe('A key is currently saved');
    expect(getStatus().textContent).toBe('A Gemini API key is saved locally on this device.');
  });

  it('saves a trimmed key and reports the exact success message', async () => {
    const storage = new MemoryStorageArea();
    const store = new SettingsStore(storage);
    await initializeOptionsPage(document, store);
    getInput().value = '  newly-entered-credential  ';

    getForm().dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await vi.waitFor(() => expect(getStatus().textContent).toBe('Saved locally on this device.'));
    await expect(store.loadApiKey()).resolves.toBe('newly-entered-credential');
    expect(getInput().value).toBe('');
    expect(getStatus().dataset.state).toBe('success');
  });

  it('rejects an empty key without removing an existing key', async () => {
    const storage = new MemoryStorageArea();
    const store = new SettingsStore(storage);
    await store.saveApiKey('stored-local-credential');
    await initializeOptionsPage(document, store);
    getInput().value = '   ';

    getForm().dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await vi.waitFor(() =>
      expect(getStatus().textContent).toBe('Enter a Gemini API key before saving.'),
    );
    await expect(store.loadApiKey()).resolves.toBe('stored-local-credential');
    expect(getStatus().dataset.state).toBe('error');
  });

  it('clears the key and saved-state placeholder', async () => {
    const storage = new MemoryStorageArea();
    const store = new SettingsStore(storage);
    await store.saveApiKey('stored-local-credential');
    await initializeOptionsPage(document, store);

    getClearButton().click();

    await vi.waitFor(() => expect(getStatus().textContent).toBe('Key cleared from this device.'));
    await expect(store.loadApiKey()).resolves.toBeNull();
    expect(getInput().placeholder).toBe('Enter your Gemini API key');
    expect(getStatus().dataset.state).toBe('success');
  });

  it('reports storage failures without echoing the input value', async () => {
    const store = {
      hasApiKey: vi.fn(async () => false),
      saveApiKey: vi.fn(async () => Promise.reject(new Error('storage details'))),
      clearApiKey: vi.fn(async () => undefined),
    };
    await initializeOptionsPage(document, store);
    getInput().value = 'do-not-echo-this-value';

    getForm().dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await vi.waitFor(() =>
      expect(getStatus().textContent).toBe('Could not save the key. Try again.'),
    );
    expect(getStatus().textContent).not.toContain('do-not-echo-this-value');
    expect(getStatus().dataset.state).toBe('error');
  });
});

function getForm(): HTMLFormElement {
  return document.querySelector<HTMLFormElement>('#api-key-form')!;
}

function getInput(): HTMLInputElement {
  return document.querySelector<HTMLInputElement>('#gemini-api-key')!;
}

function getClearButton(): HTMLButtonElement {
  return document.querySelector<HTMLButtonElement>('#clear-key')!;
}

function getStatus(): HTMLParagraphElement {
  return document.querySelector<HTMLParagraphElement>('#save-status')!;
}
