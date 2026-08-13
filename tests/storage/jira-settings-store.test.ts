import { describe, expect, it } from 'vitest';

import {
  JIRA_AI_CONSENT_STORAGE_KEY,
  JIRA_SELECTED_SITES_STORAGE_KEY,
  JIRA_SESSION_STORAGE_KEY,
  JiraSettingsStore,
} from '../../src/storage/jira-settings-store';
import { MemoryStorageArea } from '../helpers/memory-storage-area';

describe('JiraSettingsStore', () => {
  it('stores a trimmed installation session locally and can clear all connection state', async () => {
    const storage = new MemoryStorageArea();
    const store = new JiraSettingsStore(storage);

    await store.saveSessionToken('  opaque-session-token  ');
    await store.saveSelectedSiteHosts(['acme.atlassian.net']);

    expect(await store.loadSessionToken()).toBe('opaque-session-token');
    expect(storage.values.get(JIRA_SESSION_STORAGE_KEY)).toBe('opaque-session-token');
    await store.clearConnection();
    expect(await store.loadSessionToken()).toBeNull();
    expect(storage.values.has(JIRA_SELECTED_SITES_STORAGE_KEY)).toBe(false);
  });

  it('rejects empty sessions and invalid site hosts', async () => {
    const store = new JiraSettingsStore(new MemoryStorageArea());
    await expect(store.saveSessionToken('  ')).rejects.toThrow('session');
    await expect(store.saveSelectedSiteHosts(['acme.atlassian.net.evil.example'])).rejects.toThrow(
      'site',
    );
  });

  it('keeps AI sharing consent independent and default-off', async () => {
    const storage = new MemoryStorageArea();
    const store = new JiraSettingsStore(storage);

    expect(JIRA_AI_CONSENT_STORAGE_KEY).toBe('jiraGeminiConsent');
    expect(await store.loadAiConsent()).toBe(false);
    await store.saveAiConsent(true);
    expect(await store.loadAiConsent()).toBe(true);
    expect(storage.values.get(JIRA_AI_CONSENT_STORAGE_KEY)).toBe(true);
    await store.clearConnection();
    expect(await store.loadAiConsent()).toBe(true);
  });
});
