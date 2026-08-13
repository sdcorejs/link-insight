import { isJiraSiteHost } from '../core/worker-api-contracts';
import type { StorageAreaLike } from './storage-area';

export const JIRA_SESSION_STORAGE_KEY = 'jiraInstallationSession';
export const JIRA_AI_CONSENT_STORAGE_KEY = 'jiraGeminiConsent';
export const JIRA_SELECTED_SITES_STORAGE_KEY = 'jiraSelectedSiteHosts';

export class JiraSettingsStore {
  constructor(private readonly storage: StorageAreaLike) {}

  async saveSessionToken(value: string): Promise<void> {
    const token = value.trim();
    if (token === '') {
      throw new TypeError('A Jira installation session is required.');
    }
    await this.storage.set({ [JIRA_SESSION_STORAGE_KEY]: token });
  }

  async loadSessionToken(): Promise<string | null> {
    const stored = await this.storage.get(JIRA_SESSION_STORAGE_KEY);
    const value = stored[JIRA_SESSION_STORAGE_KEY];
    return typeof value === 'string' && value.trim() !== '' ? value : null;
  }

  async saveSelectedSiteHosts(hosts: readonly string[]): Promise<void> {
    if (hosts.some((host) => !isJiraSiteHost(host))) {
      throw new TypeError('A selected Jira site is invalid.');
    }
    await this.storage.set({
      [JIRA_SELECTED_SITES_STORAGE_KEY]: [...new Set(hosts)].sort(),
    });
  }

  async loadSelectedSiteHosts(): Promise<readonly string[]> {
    const stored = await this.storage.get(JIRA_SELECTED_SITES_STORAGE_KEY);
    const value = stored[JIRA_SELECTED_SITES_STORAGE_KEY];
    return Array.isArray(value) && value.every((host) => isJiraSiteHost(host))
      ? [...new Set(value)].sort()
      : [];
  }

  async saveAiConsent(enabled: boolean): Promise<void> {
    await this.storage.set({ [JIRA_AI_CONSENT_STORAGE_KEY]: enabled });
  }

  async loadAiConsent(): Promise<boolean> {
    const stored = await this.storage.get(JIRA_AI_CONSENT_STORAGE_KEY);
    return stored[JIRA_AI_CONSENT_STORAGE_KEY] === true;
  }

  async clearConnection(): Promise<void> {
    await this.storage.remove([JIRA_SESSION_STORAGE_KEY, JIRA_SELECTED_SITES_STORAGE_KEY]);
  }
}
