import { describe, expect, it, vi } from 'vitest';

import type { AiSummary, NormalizedLinkContent } from '../../src/core/contracts';
import type { LinkSummaryRequest, LinkSummaryResponse } from '../../src/core/message-contracts';
import { createSummaryMessageListener } from '../../src/background/summary-message-handler';
import { AtlassianLinkProvider } from '../../src/link-providers/atlassian-link-provider';
import { LinkProviderRegistry } from '../../src/link-providers/link-provider-registry';

const REQUEST: LinkSummaryRequest = {
  type: 'LINK_SUMMARY_REQUEST',
  requestId: 'request-123',
  url: 'https://acme.atlassian.net/browse/CORE-123',
};

const CONTENT: NormalizedLinkContent = {
  providerId: 'atlassian',
  resourceType: 'jira-issue',
  identifier: 'CORE-123',
  title: 'Mock title',
  body: 'Mock content',
  attributes: { status: 'Open' },
};

const SUMMARY: AiSummary = {
  bullets: ['First point', 'Second point', 'Third point'],
};

describe('createSummaryMessageListener', () => {
  it('rejects an invalid message without claiming the channel', async () => {
    const { listener } = setup();
    const sendResponse = vi.fn();

    const keepChannelOpen = listener(
      { type: 'LINK_SUMMARY_REQUEST', url: REQUEST.url },
      supportedSender(),
      sendResponse,
    );
    await flushMicrotasks();

    expect(keepChannelOpen).toBe(false);
    expect(sendResponse).not.toHaveBeenCalled();
  });

  it.each([
    [{ ...supportedSender(), id: 'another-extension' }, 'different extension id'],
    [{ ...supportedSender(), tabUrl: 'https://example.com/chat/room' }, 'different host'],
    [{ ...supportedSender(), tabUrl: 'https://mail.google.com/mail/u/0/' }, 'non-chat Gmail path'],
    [{ ...supportedSender(), tabUrl: 'https://chat.google.com.evil.example/room' }, 'fake host'],
    [{ ...supportedSender(), frameId: 2 }, 'non-top frame'],
  ])('rejects an unsupported sender: %s', async (sender) => {
    const { listener, fetchContent, summarize } = setup();

    const { keepChannelOpen, response } = invoke(listener, REQUEST, sender);

    expect(keepChannelOpen).toBe(true);
    await expect(response).resolves.toEqual({
      type: 'LINK_SUMMARY_ERROR',
      requestId: REQUEST.requestId,
      error: {
        code: 'UNAUTHORIZED_SENDER',
        message: 'Summary requests are only accepted from Google Chat.',
      },
    });
    expect(fetchContent).not.toHaveBeenCalled();
    expect(summarize).not.toHaveBeenCalled();
  });

  it('validates the URL again in the background', async () => {
    const { listener, fetchContent } = setup();
    const unsafeRequest = {
      ...REQUEST,
      url: 'https://atlassian.net.evil.example/browse/CORE-123',
    };

    const { response } = invoke(listener, unsafeRequest, supportedSender());

    await expect(response).resolves.toMatchObject({
      type: 'LINK_SUMMARY_ERROR',
      requestId: REQUEST.requestId,
      error: { code: 'UNSUPPORTED_LINK' },
    });
    expect(fetchContent).not.toHaveBeenCalled();
  });

  it('returns the exact missing-key error before fetching content', async () => {
    const { listener, fetchContent, summarize } = setup({ apiKey: null });

    const { response } = invoke(listener, REQUEST, supportedSender());

    await expect(response).resolves.toEqual({
      type: 'LINK_SUMMARY_ERROR',
      requestId: REQUEST.requestId,
      error: {
        code: 'MISSING_API_KEY',
        message: 'Set your Gemini API key in the extension options.',
      },
    });
    expect(fetchContent).not.toHaveBeenCalled();
    expect(summarize).not.toHaveBeenCalled();
  });

  it('keeps the async response channel open and echoes requestId on success', async () => {
    const { listener, summarize } = setup();

    const { keepChannelOpen, response } = invoke(listener, REQUEST, supportedSender());

    expect(keepChannelOpen).toBe(true);
    await expect(response).resolves.toEqual({
      type: 'LINK_SUMMARY_SUCCESS',
      requestId: REQUEST.requestId,
      summary: SUMMARY,
    });
    expect(summarize).toHaveBeenCalledWith(CONTENT, { apiKey: 'stored-local-credential' });
  });

  it('canonicalizes the URL before cache coordination and content retrieval', async () => {
    const { listener, getOrCreate, fetchContent } = setup();
    const request = {
      ...REQUEST,
      url: `${REQUEST.url}?focusedCommentId=7#comment-7`,
    };

    await invoke(listener, request, supportedSender()).response;

    expect(getOrCreate).toHaveBeenCalledWith(
      'https://acme.atlassian.net/browse/CORE-123',
      expect.any(Function),
    );
    expect(fetchContent).toHaveBeenCalledWith(
      expect.objectContaining({
        canonicalUrl: 'https://acme.atlassian.net/browse/CORE-123',
        identifier: 'CORE-123',
      }),
    );
  });

  it('does not expose unexpected internal errors to the content script', async () => {
    const { listener, summarize } = setup();
    summarize.mockRejectedValueOnce(new Error('internal sensitive details'));

    const { response } = invoke(listener, REQUEST, supportedSender());

    const result = await response;
    expect(result).toEqual({
      type: 'LINK_SUMMARY_ERROR',
      requestId: REQUEST.requestId,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Unable to create a summary right now.',
      },
    });
    expect(JSON.stringify(result)).not.toContain('internal sensitive details');
  });
});

function setup(options: { apiKey?: string | null } = {}) {
  const apiKey = options.apiKey === undefined ? 'stored-local-credential' : options.apiKey;
  const fetchContent = vi.fn(async () => CONTENT);
  const summarize = vi.fn(async () => SUMMARY);
  const getOrCreate = vi.fn(async (_url: string, loader: () => Promise<AiSummary>) => loader());
  const listener = createSummaryMessageListener({
    extensionId: 'extension-id',
    providers: new LinkProviderRegistry([new AtlassianLinkProvider()]),
    settings: { loadApiKey: vi.fn(async () => apiKey) },
    contentFetchers: { fetch: fetchContent },
    summarizer: { summarize },
    coordinator: { getOrCreate },
  });

  return { listener, fetchContent, summarize, getOrCreate };
}

function supportedSender() {
  return {
    id: 'extension-id',
    tabUrl: 'https://chat.google.com/u/0/room/AAAA',
    frameId: 0,
  };
}

function invoke(
  listener: ReturnType<typeof createSummaryMessageListener>,
  request: unknown,
  sender: ReturnType<typeof supportedSender>,
): { keepChannelOpen: boolean; response: Promise<LinkSummaryResponse> } {
  let resolveResponse: ((response: LinkSummaryResponse) => void) | undefined;
  const response = new Promise<LinkSummaryResponse>((resolve) => {
    resolveResponse = resolve;
  });
  const keepChannelOpen = listener(request, sender, (value) => resolveResponse?.(value));
  return { keepChannelOpen, response };
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}
