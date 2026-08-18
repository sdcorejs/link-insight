// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { JiraTransitionsResult, LinkResource } from '../../src/core/contracts';
import type { JiraRuntimeRequest } from '../../src/core/message-contracts';
import type {
  JiraActionCardDelegate,
  JiraActionCardPort,
  JiraTransitionDraft,
} from '../../src/ui/jira-action-card';
import { JiraActionController, JIRA_ACTION_TRIGGER_ID } from '../../src/ui/jira-action-controller';

const RESOURCE: LinkResource = {
  providerId: 'atlassian',
  resourceType: 'jira-issue',
  canonicalUrl: 'https://acme.atlassian.net/browse/CORE-1',
  tenant: 'acme',
  identifier: 'CORE-1',
  metadata: { issueKey: 'CORE-1' },
};

const TRANSITIONS: JiraTransitionsResult = {
  issueKey: 'CORE-1',
  currentStatus: 'In Progress',
  transitions: [
    {
      id: '31',
      name: 'Done',
      toStatus: 'Done',
      fields: [],
      unsupportedRequiredFields: [],
    },
  ],
};

const DRAFT: JiraTransitionDraft = {
  transition: TRANSITIONS.transitions[0]!,
  currentStatus: 'In Progress',
  values: { resolution: '1' },
  displayValues: [{ label: 'Resolution', value: 'Fixed' }],
};

beforeEach(() => document.body.replaceChildren());

describe('JiraActionController', () => {
  it('shows one separate affordance without modifying normal link navigation', async () => {
    const anchor = createAnchor(RESOURCE);
    const { card, open } = createCardPort();
    const sendMessage = transitionGateway();
    const controller = createController(card, sendMessage);

    controller.showFor(RESOURCE, anchor);
    controller.showFor(RESOURCE, anchor);

    const trigger = document.getElementById(JIRA_ACTION_TRIGGER_ID) as HTMLButtonElement;
    expect(document.querySelectorAll(`#${JIRA_ACTION_TRIGGER_ID}`)).toHaveLength(1);
    expect(trigger.textContent).toBe('Jira actions');
    expect(anchor.href).toBe(RESOURCE.canonicalUrl);
    trigger.click();
    expect(open).toHaveBeenCalledWith(RESOURCE, anchor);
    await vi.waitFor(() => expect(card.renderTransitions).toHaveBeenCalledTimes(1));
  });

  it('keeps the affordance while moving from link to it and hides it elsewhere after grace', () => {
    vi.useFakeTimers();
    try {
      const anchor = createAnchor(RESOURCE);
      const { card } = createCardPort();
      const controller = createController(card, transitionGateway());
      controller.showFor(RESOURCE, anchor);
      const trigger = document.getElementById(JIRA_ACTION_TRIGGER_ID)!;

      controller.linkExited(RESOURCE, trigger);
      expect(trigger.hidden).toBe(false);
      controller.linkExited(RESOURCE, document.body);
      expect(trigger.hidden).toBe(false);
      vi.advanceTimersByTime(200);
      expect(trigger.hidden).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps the affordance reachable while the pointer crosses the placement gap', () => {
    vi.useFakeTimers();
    try {
      const anchor = createAnchor(RESOURCE);
      const { card } = createCardPort();
      const controller = createController(card, transitionGateway());
      controller.showFor(RESOURCE, anchor);
      const trigger = document.getElementById(JIRA_ACTION_TRIGGER_ID)!;

      controller.linkExited(RESOURCE, document.body);
      expect(trigger.hidden).toBe(false);
      trigger.dispatchEvent(new MouseEvent('mouseenter'));
      vi.advanceTimersByTime(250);
      expect(trigger.hidden).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('owns the confirmed write request, unique idempotency key, and success rendering', async () => {
    const anchor = createAnchor(RESOURCE);
    const port = createCardPort();
    const sendMessage = transitionGateway();
    const controller = createController(port.card, sendMessage);
    controller.showFor(RESOURCE, anchor);
    document.getElementById(JIRA_ACTION_TRIGGER_ID)!.click();
    await vi.waitFor(() => expect(port.card.renderTransitions).toHaveBeenCalledTimes(1));

    await port.delegate().onConfirmTransition(RESOURCE, DRAFT);

    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(sendMessage.mock.calls[1]?.[0]).toEqual({
      type: 'JIRA_TRANSITION_EXECUTE_REQUEST',
      requestId: 'request-2',
      url: RESOURCE.canonicalUrl,
      transitionId: '31',
      idempotencyKey: '00000000-0000-4000-8000-000000000001',
      values: { resolution: '1' },
    });
    expect(port.card.renderSuccess).toHaveBeenCalledWith('CORE-1 is now Done.');
  });

  it('refreshes after an ambiguous write without retrying the transition', async () => {
    const sendMessage = vi
      .fn<(request: JiraRuntimeRequest) => Promise<unknown>>()
      .mockImplementationOnce(async (request) => ({
        type: 'JIRA_TRANSITIONS_SUCCESS',
        requestId: request.requestId,
        result: TRANSITIONS,
      }))
      .mockImplementationOnce(async (request) => ({
        type: 'JIRA_OPERATION_ERROR',
        requestId: request.requestId,
        error: {
          code: 'AMBIGUOUS_WRITE_OUTCOME',
          message: 'Jira may have applied the transition.',
        },
      }))
      .mockImplementationOnce(async (request) => ({
        type: 'JIRA_TRANSITIONS_SUCCESS',
        requestId: request.requestId,
        result: { ...TRANSITIONS, currentStatus: 'Done', transitions: [] },
      }));
    const port = createCardPort();
    const controller = createController(port.card, sendMessage);
    controller.showFor(RESOURCE, createAnchor(RESOURCE));
    document.getElementById(JIRA_ACTION_TRIGGER_ID)!.click();
    await vi.waitFor(() => expect(port.card.renderTransitions).toHaveBeenCalledTimes(1));

    await port.delegate().onConfirmTransition(RESOURCE, DRAFT);

    expect(
      sendMessage.mock.calls.filter(
        ([request]) => request.type === 'JIRA_TRANSITION_EXECUTE_REQUEST',
      ),
    ).toHaveLength(1);
    expect(port.card.renderSuccess).not.toHaveBeenCalled();
    expect(port.card.renderTransitions).toHaveBeenCalledTimes(2);
    expect(port.card.renderTransitions).toHaveBeenLastCalledWith(
      RESOURCE,
      'Done',
      [],
      'Jira may have applied the transition.',
    );
  });

  it('does not render a stale write response after the card closes', async () => {
    let resolveWrite: ((value: unknown) => void) | undefined;
    const write = new Promise<unknown>((resolve) => {
      resolveWrite = resolve;
    });
    const sendMessage = vi
      .fn<(request: JiraRuntimeRequest) => Promise<unknown>>()
      .mockImplementationOnce(async (request) => ({
        type: 'JIRA_TRANSITIONS_SUCCESS',
        requestId: request.requestId,
        result: TRANSITIONS,
      }))
      .mockImplementationOnce(async () => write);
    const port = createCardPort();
    const controller = createController(port.card, sendMessage);
    controller.showFor(RESOURCE, createAnchor(RESOURCE));
    document.getElementById(JIRA_ACTION_TRIGGER_ID)!.click();
    await vi.waitFor(() => expect(port.card.renderTransitions).toHaveBeenCalledTimes(1));
    const pending = port.delegate().onConfirmTransition(RESOURCE, DRAFT);
    port.card.close();
    port.delegate().onClosed();

    resolveWrite?.({
      type: 'JIRA_TRANSITION_EXECUTE_SUCCESS',
      requestId: 'request-2',
      result: {
        issueKey: 'CORE-1',
        oldStatus: 'In Progress',
        newStatus: 'Done',
        applied: true,
      },
    });
    await pending;

    expect(port.card.renderSuccess).not.toHaveBeenCalled();
    expect(port.card.renderError).not.toHaveBeenCalled();
  });

  it('does not render a stale transition read after a different Jira card opens', async () => {
    let resolveFirst: ((value: unknown) => void) | undefined;
    const first = new Promise<unknown>((resolve) => {
      resolveFirst = resolve;
    });
    const secondResource = {
      ...RESOURCE,
      identifier: 'CORE-2',
      canonicalUrl: 'https://acme.atlassian.net/browse/CORE-2',
    };
    const sendMessage = vi
      .fn<(request: JiraRuntimeRequest) => Promise<unknown>>()
      .mockImplementationOnce(async () => first)
      .mockImplementationOnce(async (request) => ({
        type: 'JIRA_TRANSITIONS_SUCCESS',
        requestId: request.requestId,
        result: { ...TRANSITIONS, issueKey: 'CORE-2' },
      }));
    const port = createCardPort();
    const controller = createController(port.card, sendMessage);
    controller.showFor(RESOURCE, createAnchor(RESOURCE));
    document.getElementById(JIRA_ACTION_TRIGGER_ID)!.click();
    controller.showFor(secondResource, createAnchor(secondResource));
    document.getElementById(JIRA_ACTION_TRIGGER_ID)!.click();
    await vi.waitFor(() => expect(port.card.renderTransitions).toHaveBeenCalledTimes(1));

    resolveFirst?.({
      type: 'JIRA_TRANSITIONS_SUCCESS',
      requestId: 'request-1',
      result: TRANSITIONS,
    });
    await Promise.resolve();

    expect(port.card.renderTransitions).toHaveBeenCalledTimes(1);
    expect(port.card.renderTransitions).toHaveBeenCalledWith(
      secondResource,
      'In Progress',
      TRANSITIONS.transitions,
      undefined,
    );
  });

  it('does not show actions for Confluence and removes surfaces on stop', () => {
    const anchor = createAnchor(RESOURCE);
    const { card } = createCardPort();
    const controller = createController(card, transitionGateway());
    controller.showFor({ ...RESOURCE, resourceType: 'confluence-page' }, anchor);
    expect(document.getElementById(JIRA_ACTION_TRIGGER_ID)).toBeNull();
    controller.showFor(RESOURCE, anchor);
    controller.stop();
    expect(document.getElementById(JIRA_ACTION_TRIGGER_ID)).toBeNull();
    expect(card.dispose).toHaveBeenCalledTimes(1);
  });
});

function createController(
  card: JiraActionCardPort,
  sendMessage: (request: JiraRuntimeRequest) => Promise<unknown>,
) {
  let requestNumber = 0;
  return new JiraActionController(document, window, card, sendMessage, {
    createRequestId: () => `request-${++requestNumber}`,
    createIdempotencyKey: () => '00000000-0000-4000-8000-000000000001',
    hideDelayMs: 150,
  });
}

function createAnchor(resource: LinkResource): HTMLAnchorElement {
  const anchor = document.createElement('a');
  anchor.href = resource.canonicalUrl;
  document.body.append(anchor);
  return anchor;
}

function transitionGateway() {
  return vi.fn(async (request: JiraRuntimeRequest) => {
    if (request.type === 'JIRA_TRANSITIONS_REQUEST') {
      return {
        type: 'JIRA_TRANSITIONS_SUCCESS',
        requestId: request.requestId,
        result: TRANSITIONS,
      };
    }
    return {
      type: 'JIRA_TRANSITION_EXECUTE_SUCCESS',
      requestId: request.requestId,
      result: {
        issueKey: 'CORE-1',
        oldStatus: 'In Progress',
        newStatus: 'Done',
        applied: true,
      },
    };
  });
}

function createCardPort() {
  let currentUrl: string | null = null;
  let delegateValue: JiraActionCardDelegate | undefined;
  const open = vi.fn((resource: LinkResource) => {
    currentUrl = resource.canonicalUrl;
  });
  const card: JiraActionCardPort = {
    setDelegate: vi.fn((delegate) => {
      delegateValue = delegate;
    }),
    open,
    isOpenFor: vi.fn((resource) => currentUrl === resource.canonicalUrl),
    renderTransitions: vi.fn(),
    renderLoading: vi.fn(),
    renderError: vi.fn(),
    renderSuccess: vi.fn(),
    setConfirmationPending: vi.fn(),
    close: vi.fn(() => {
      currentUrl = null;
    }),
    dispose: vi.fn(),
  };
  return {
    card,
    open,
    delegate: () => delegateValue!,
  };
}
