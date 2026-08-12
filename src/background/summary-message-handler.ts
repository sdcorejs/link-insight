import type { AiSummary, LinkResource, NormalizedLinkContent } from '../core/contracts';
import { isLinkInsightError, LinkInsightError } from '../core/errors';
import type { LinkSummaryErrorResponse, LinkSummaryResponse } from '../core/message-contracts';
import { isLinkSummaryRequest } from '../core/message-contracts';
import type { LinkProviderRegistry } from '../link-providers/link-provider-registry';
import type { SummarizationCredentials } from '../summarizers/summarizer';

export interface MessageSenderLike {
  readonly id?: string;
  readonly tabUrl?: string;
  readonly frameId?: number;
}

interface SettingsReader {
  loadApiKey(): Promise<string | null>;
}

interface ContentFetcherGateway {
  fetch(resource: LinkResource): Promise<NormalizedLinkContent>;
}

interface SummarizerGateway {
  summarize(
    content: NormalizedLinkContent,
    credentials: SummarizationCredentials,
  ): Promise<AiSummary>;
}

interface SummaryCoordinatorGateway {
  getOrCreate(canonicalUrl: string, loader: () => Promise<AiSummary>): Promise<AiSummary>;
}

interface SummaryMessageDependencies {
  readonly extensionId: string;
  readonly providers: LinkProviderRegistry;
  readonly settings: SettingsReader;
  readonly contentFetchers: ContentFetcherGateway;
  readonly summarizer: SummarizerGateway;
  readonly coordinator: SummaryCoordinatorGateway;
}

export type SummaryMessageListener = (
  message: unknown,
  sender: MessageSenderLike,
  sendResponse: (response: LinkSummaryResponse) => void,
) => boolean;

export function createSummaryMessageListener(
  dependencies: SummaryMessageDependencies,
): SummaryMessageListener {
  return (message, sender, sendResponse): boolean => {
    if (!isLinkSummaryRequest(message)) {
      return false;
    }

    void processSummaryRequest(message, sender, dependencies).then(sendResponse);
    return true;
  };
}

async function processSummaryRequest(
  request: { readonly requestId: string; readonly url: string },
  sender: MessageSenderLike,
  dependencies: SummaryMessageDependencies,
): Promise<LinkSummaryResponse> {
  try {
    if (!isAllowedSender(sender, dependencies.extensionId)) {
      throw new LinkInsightError(
        'UNAUTHORIZED_SENDER',
        'Summary requests are only accepted from Google Chat.',
      );
    }

    const resource = dependencies.providers.resolve(request.url);
    if (resource === null) {
      throw new LinkInsightError('UNSUPPORTED_LINK', 'This link is not supported.');
    }

    const apiKey = await dependencies.settings.loadApiKey();
    if (apiKey === null || apiKey.trim() === '') {
      throw new LinkInsightError(
        'MISSING_API_KEY',
        'Set your Gemini API key in the extension options.',
      );
    }

    const summary = await dependencies.coordinator.getOrCreate(resource.canonicalUrl, async () => {
      const content = await dependencies.contentFetchers.fetch(resource);
      return dependencies.summarizer.summarize(content, { apiKey });
    });

    return {
      type: 'LINK_SUMMARY_SUCCESS',
      requestId: request.requestId,
      summary,
    };
  } catch (error) {
    return toErrorResponse(request.requestId, error);
  }
}

function isAllowedSender(sender: MessageSenderLike, extensionId: string): boolean {
  if (sender.id !== extensionId || sender.tabUrl === undefined) {
    return false;
  }
  if (sender.frameId !== undefined && sender.frameId !== 0) {
    return false;
  }

  let tabUrl: URL;
  try {
    tabUrl = new URL(sender.tabUrl);
  } catch {
    return false;
  }

  if (tabUrl.protocol !== 'https:') {
    return false;
  }
  if (tabUrl.hostname === 'chat.google.com') {
    return true;
  }
  return tabUrl.hostname === 'mail.google.com' && tabUrl.pathname.startsWith('/chat/');
}

function toErrorResponse(requestId: string, error: unknown): LinkSummaryErrorResponse {
  if (isLinkInsightError(error)) {
    return {
      type: 'LINK_SUMMARY_ERROR',
      requestId,
      error: {
        code: error.code,
        message: error.message,
      },
    };
  }

  return {
    type: 'LINK_SUMMARY_ERROR',
    requestId,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Unable to create a summary right now.',
    },
  };
}
