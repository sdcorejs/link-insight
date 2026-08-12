import { registerBackgroundLifecycle } from '../src/background/background-lifecycle';
import { createSummaryMessageListener } from '../src/background/summary-message-handler';
import { ContentFetcherRegistry } from '../src/content-fetchers/content-fetcher-registry';
import { MockAtlassianContentFetcher } from '../src/content-fetchers/mock-atlassian-content-fetcher';
import { AtlassianLinkProvider } from '../src/link-providers/atlassian-link-provider';
import { LinkProviderRegistry } from '../src/link-providers/link-provider-registry';
import { SettingsStore, configureTrustedStorageAccess } from '../src/storage/settings-store';
import { SummaryCache } from '../src/storage/summary-cache';
import { SummaryRequestCoordinator } from '../src/storage/summary-request-coordinator';
import { GeminiSummarizer } from '../src/summarizers/gemini-summarizer';

export default defineBackground(() => {
  const settings = new SettingsStore(chrome.storage.local);
  const messageListener = createSummaryMessageListener({
    extensionId: chrome.runtime.id,
    providers: new LinkProviderRegistry([new AtlassianLinkProvider()]),
    settings,
    contentFetchers: new ContentFetcherRegistry([new MockAtlassianContentFetcher()]),
    summarizer: new GeminiSummarizer(),
    coordinator: new SummaryRequestCoordinator(new SummaryCache(chrome.storage.session)),
  });

  const protectLocalStorage = async (): Promise<void> => {
    await configureTrustedStorageAccess(chrome.storage.local);
  };

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) =>
    messageListener(
      message,
      {
        ...(sender.id === undefined ? {} : { id: sender.id }),
        ...(sender.tab?.url === undefined ? {} : { tabUrl: sender.tab.url }),
        ...(sender.frameId === undefined ? {} : { frameId: sender.frameId }),
      },
      sendResponse,
    ),
  );

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
