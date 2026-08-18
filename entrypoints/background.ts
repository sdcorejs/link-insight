import { registerBackgroundLifecycle } from '../src/background/background-lifecycle';
import { createJiraMessageListener } from '../src/background/jira-message-handler';
import { createSummaryMessageListener } from '../src/background/summary-message-handler';
import { JiraAuthClient } from '../src/auth/jira-auth-client';
import { RUNTIME_CONFIG } from '../src/config/runtime-config';
import { ContentFetcherRegistry } from '../src/content-fetchers/content-fetcher-registry';
import { JiraContentFetcher } from '../src/content-fetchers/jira-content-fetcher';
import { MockAtlassianContentFetcher } from '../src/content-fetchers/mock-atlassian-content-fetcher';
import { AtlassianLinkProvider } from '../src/link-providers/atlassian-link-provider';
import { LinkProviderRegistry } from '../src/link-providers/link-provider-registry';
import { JiraWorkerClient } from '../src/jira/jira-worker-client';
import { JiraSettingsStore } from '../src/storage/jira-settings-store';
import { SettingsStore, configureTrustedStorageAccess } from '../src/storage/settings-store';
import { SummaryCache } from '../src/storage/summary-cache';
import { SummaryRequestCoordinator } from '../src/storage/summary-request-coordinator';
import { GeminiSummarizer } from '../src/summarizers/gemini-summarizer';

export default defineBackground(() => {
  const settings = new SettingsStore(chrome.storage.local);
  const jiraSettings = new JiraSettingsStore(chrome.storage.local);
  const providers = new LinkProviderRegistry([new AtlassianLinkProvider()]);
  const coordinator = new SummaryRequestCoordinator(new SummaryCache(chrome.storage.session));
  const jiraWorker = new JiraWorkerClient({ origin: RUNTIME_CONFIG.worker.origin });
  const jiraAuth = new JiraAuthClient({
    identity: {
      getRedirectURL: (path) => chrome.identity.getRedirectURL(path),
      launchWebAuthFlow: async (details) => {
        const callback = await chrome.identity.launchWebAuthFlow(details);
        if (callback === undefined) {
          throw new Error('OAuth flow did not return a callback.');
        }
        return callback;
      },
    },
    worker: jiraWorker,
    settings: jiraSettings,
  });
  const messageListener = createSummaryMessageListener({
    extensionId: chrome.runtime.id,
    providers,
    settings,
    contentFetchers: new ContentFetcherRegistry([
      new JiraContentFetcher({
        settings: {
          loadSessionToken: () => jiraSettings.loadSessionToken(),
          loadSelectedSiteHosts: () => jiraSettings.loadSelectedSiteHosts(),
          loadAiConsent: () => jiraSettings.loadAiConsent(),
          loadApiKey: () => settings.loadApiKey(),
        },
        worker: jiraWorker,
      }),
      new MockAtlassianContentFetcher(),
    ]),
    summarizer: new GeminiSummarizer(),
    coordinator,
  });
  const jiraMessageListener = createJiraMessageListener({
    extensionId: chrome.runtime.id,
    auth: jiraAuth,
    worker: jiraWorker,
    settings: jiraSettings,
    providers,
    invalidateSummary: (canonicalUrl) => coordinator.invalidate(canonicalUrl),
  });

  const protectLocalStorage = async (): Promise<void> => {
    await configureTrustedStorageAccess(chrome.storage.local);
  };

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const normalizedSender = {
      ...(sender.id === undefined ? {} : { id: sender.id }),
      ...(sender.tab?.url === undefined ? {} : { tabUrl: sender.tab.url }),
      ...(sender.url === undefined ? {} : { documentUrl: sender.url }),
      ...(sender.frameId === undefined ? {} : { frameId: sender.frameId }),
    };
    if (messageListener(message, normalizedSender, sendResponse)) {
      return true;
    }
    return jiraMessageListener(message, normalizedSender, sendResponse);
  });

  registerBackgroundLifecycle({
    protectStorage: protectLocalStorage,
    openOptionsPage: () => chrome.runtime.openOptionsPage(),
    onInstalled: {
      addListener: (listener) => chrome.runtime.onInstalled.addListener(listener),
    },
    onActionClicked: {
      addListener: (listener) => chrome.action.onClicked.addListener(listener),
    },
  });
});
