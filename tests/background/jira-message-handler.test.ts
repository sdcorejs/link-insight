import { describe, expect, it, vi } from 'vitest';

import { createJiraMessageListener } from '../../src/background/jira-message-handler';
import type { JiraRuntimeResponse } from '../../src/core/message-contracts';
import { AtlassianLinkProvider } from '../../src/link-providers/atlassian-link-provider';
import { LinkProviderRegistry } from '../../src/link-providers/link-provider-registry';

describe('Jira background message handler', () => {
  it('rejects invalid messages without claiming the async channel', () => {
    const { listener } = setup();
    expect(listener({ type: 'JIRA_CONNECT_REQUEST' }, optionsSender(), vi.fn())).toBe(false);
  });

  it('allows connect only from a trusted extension page and keeps the response channel open', async () => {
    const { listener, auth } = setup();
    const request = { type: 'JIRA_CONNECT_REQUEST', requestId: 'connect-1' } as const;

    await expect(invoke(listener, request, contentSender()).response).resolves.toMatchObject({
      type: 'JIRA_OPERATION_ERROR',
      error: { code: 'UNAUTHORIZED_SENDER' },
    });
    const trusted = invoke(listener, request, optionsSender());
    expect(trusted.keepChannelOpen).toBe(true);
    await expect(trusted.response).resolves.toMatchObject({
      type: 'JIRA_CONNECTION_SUCCESS',
      requestId: 'connect-1',
      connection: { connected: true },
    });
    expect(auth.connect).toHaveBeenCalledTimes(1);
  });

  it('revalidates Jira URLs and selected sites before querying transitions', async () => {
    const { listener, worker } = setup();
    const unsafe = invoke(
      listener,
      {
        type: 'JIRA_TRANSITIONS_REQUEST',
        requestId: 'transition-1',
        url: 'https://acme.atlassian.net.evil.example/browse/CORE-1',
      },
      contentSender(),
    );
    await expect(unsafe.response).resolves.toMatchObject({
      type: 'JIRA_OPERATION_ERROR',
      error: { code: 'UNSUPPORTED_LINK' },
    });
    expect(worker.getTransitions).not.toHaveBeenCalled();

    await invoke(
      listener,
      {
        type: 'JIRA_TRANSITIONS_REQUEST',
        requestId: 'transition-2',
        url: 'https://acme.atlassian.net/browse/CORE-1',
      },
      contentSender(),
    ).response;
    expect(worker.getTransitions).toHaveBeenCalledWith('stored-session', {
      siteHost: 'acme.atlassian.net',
      issueKey: 'CORE-1',
    });
  });

  it('never retries a write, echoes requestId, and invalidates only after success', async () => {
    const { listener, worker, invalidate } = setup();
    const request = {
      type: 'JIRA_TRANSITION_EXECUTE_REQUEST',
      requestId: 'execute-1',
      url: 'https://acme.atlassian.net/browse/CORE-1?ignored=yes',
      transitionId: '31',
      idempotencyKey: '00000000-0000-4000-8000-000000000001',
      values: { resolution: '1' },
    } as const;

    await expect(invoke(listener, request, contentSender()).response).resolves.toMatchObject({
      type: 'JIRA_TRANSITION_EXECUTE_SUCCESS',
      requestId: 'execute-1',
      result: { applied: true },
    });
    expect(worker.executeTransition).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith('https://acme.atlassian.net/browse/CORE-1');
  });

  it('always clears the local session when remote disconnect cannot be confirmed', async () => {
    const { listener, worker, settings } = setup();
    worker.disconnect.mockRejectedValueOnce(new Error('network details must not escape'));

    await expect(
      invoke(
        listener,
        { type: 'JIRA_DISCONNECT_REQUEST', requestId: 'disconnect-1' },
        optionsSender(),
      ).response,
    ).resolves.toEqual({
      type: 'JIRA_DISCONNECT_SUCCESS',
      requestId: 'disconnect-1',
      remoteRevocationConfirmed: false,
    });
    expect(settings.clearConnection).toHaveBeenCalledTimes(1);
  });
});

function setup() {
  const connection = {
    connected: true,
    reauthorizationRequired: false,
    sites: [{ host: 'acme.atlassian.net', displayName: 'Acme Jira' }],
  };
  const auth = { connect: vi.fn(async () => connection) };
  const worker = {
    getConnection: vi.fn(async () => connection),
    disconnect: vi.fn(async () => undefined),
    getTransitions: vi.fn(async () => ({
      issueKey: 'CORE-1',
      currentStatus: 'Open',
      transitions: [],
    })),
    executeTransition: vi.fn(async () => ({
      issueKey: 'CORE-1',
      oldStatus: 'Open',
      newStatus: 'Done',
      applied: true,
    })),
  };
  const settings = {
    loadSessionToken: vi.fn(async () => 'stored-session'),
    clearConnection: vi.fn(async () => undefined),
    loadAiConsent: vi.fn(async () => false),
    saveAiConsent: vi.fn(async () => undefined),
    loadSelectedSiteHosts: vi.fn(async () => ['acme.atlassian.net']),
  };
  const invalidate = vi.fn(async () => undefined);
  const listener = createJiraMessageListener({
    extensionId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    auth,
    worker,
    settings,
    providers: new LinkProviderRegistry([new AtlassianLinkProvider()]),
    invalidateSummary: invalidate,
  });
  return { listener, auth, worker, settings, invalidate };
}

function optionsSender() {
  return {
    id: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    documentUrl: 'chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/options.html',
    frameId: 0,
  };
}

function contentSender() {
  return {
    id: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    tabUrl: 'https://chat.google.com/u/0/room/AAAA',
    documentUrl: 'https://chat.google.com/u/0/room/AAAA',
    frameId: 0,
  };
}

function invoke(
  listener: ReturnType<typeof createJiraMessageListener>,
  request: unknown,
  sender: ReturnType<typeof optionsSender> | ReturnType<typeof contentSender>,
): { readonly keepChannelOpen: boolean; readonly response: Promise<JiraRuntimeResponse> } {
  let resolveResponse: ((value: JiraRuntimeResponse) => void) | undefined;
  const response = new Promise<JiraRuntimeResponse>((resolve) => {
    resolveResponse = resolve;
  });
  const keepChannelOpen = listener(request, sender, (value) => resolveResponse?.(value));
  return { keepChannelOpen, response };
}
