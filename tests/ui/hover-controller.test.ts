// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { LinkSummaryRequest, LinkSummaryResponse } from '../../src/core/message-contracts';
import { AtlassianLinkProvider } from '../../src/link-providers/atlassian-link-provider';
import { LinkProviderRegistry } from '../../src/link-providers/link-provider-registry';
import { HoverController } from '../../src/ui/hover-controller';
import { POPOVER_ID, Popover } from '../../src/ui/popover';

const BULLETS = ['First point', 'Second point', 'Third point'] as const;

beforeEach(() => {
  vi.useFakeTimers();
  document.body.replaceChildren();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('HoverController', () => {
  it('does not request or create a popover after only 499 ms', async () => {
    const { anchor, sendMessage } = setup();

    mouseOver(anchor);
    await vi.advanceTimersByTimeAsync(499);

    expect(sendMessage).not.toHaveBeenCalled();
    expect(document.getElementById(POPOVER_ID)).toBeNull();
  });

  it('requests exactly once at 500 ms and displays the exact loading text', async () => {
    const response = deferred<LinkSummaryResponse>();
    const { anchor, sendMessage } = setup(async () => response.promise);

    mouseOver(anchor, null, 40, 50);
    await vi.advanceTimersByTimeAsync(500);

    expect(sendMessage).toHaveBeenCalledOnce();
    expect(sendMessage).toHaveBeenCalledWith({
      type: 'LINK_SUMMARY_REQUEST',
      requestId: 'request-1',
      url: 'https://acme.atlassian.net/browse/CORE-123',
    });
    const popover = document.getElementById(POPOVER_ID);
    expect(popover?.textContent).toBe('Loading AI summary...');
    expect(popover?.hidden).toBe(false);
  });

  it('cancels the timer when mouseout occurs before the dwell threshold', async () => {
    const { anchor, sendMessage } = setup();

    mouseOver(anchor);
    await vi.advanceTimersByTimeAsync(300);
    mouseOut(anchor, document.body);
    await vi.advanceTimersByTimeAsync(300);

    expect(sendMessage).not.toHaveBeenCalled();
    expect(document.getElementById(POPOVER_ID)).toBeNull();
  });

  it('does not reset dwell when moving between child elements of one anchor', async () => {
    const { anchor, sendMessage } = setup();
    const firstChild = document.createElement('span');
    const secondChild = document.createElement('strong');
    anchor.replaceChildren(firstChild, secondChild);

    mouseOver(firstChild);
    await vi.advanceTimersByTimeAsync(250);
    mouseOut(firstChild, secondChild);
    mouseOver(secondChild, firstChild);
    await vi.advanceTimersByTimeAsync(250);

    expect(sendMessage).toHaveBeenCalledOnce();
  });

  it('hides the popover synchronously on mouseout', async () => {
    const response = deferred<LinkSummaryResponse>();
    const { anchor } = setup(async () => response.promise);
    mouseOver(anchor);
    await vi.advanceTimersByTimeAsync(500);
    const popover = document.getElementById(POPOVER_ID);
    expect(popover?.hidden).toBe(false);

    mouseOut(anchor, document.body);

    expect(popover?.hidden).toBe(true);
  });

  it('does not render a response that arrives after the pointer leaves', async () => {
    const response = deferred<LinkSummaryResponse>();
    const { anchor } = setup(async () => response.promise);
    mouseOver(anchor);
    await vi.advanceTimersByTimeAsync(500);
    mouseOut(anchor, document.body);

    response.resolve(success('request-1'));
    await flushMicrotasks();

    const popover = document.getElementById(POPOVER_ID);
    expect(popover?.hidden).toBe(true);
    expect(popover?.querySelectorAll('li')).toHaveLength(0);
  });

  it('never displays the response for link A while link B is active', async () => {
    const responseA = deferred<LinkSummaryResponse>();
    const responseB = deferred<LinkSummaryResponse>();
    const { anchor, sendMessage } = setup((request) =>
      request.requestId === 'request-1' ? responseA.promise : responseB.promise,
    );
    const anchorB = createAnchor('https://acme.atlassian.net/browse/CORE-456');

    mouseOver(anchor);
    await vi.advanceTimersByTimeAsync(500);
    mouseOut(anchor, anchorB);
    mouseOver(anchorB, anchor);
    await vi.advanceTimersByTimeAsync(500);
    expect(sendMessage).toHaveBeenCalledTimes(2);

    responseA.resolve(success('request-1', ['A one', 'A two', 'A three']));
    await flushMicrotasks();
    expect(document.getElementById(POPOVER_ID)?.textContent).toBe('Loading AI summary...');

    responseB.resolve(success('request-2', ['B one', 'B two', 'B three']));
    await flushMicrotasks();
    expect(document.getElementById(POPOVER_ID)?.textContent).toContain('B one');
    expect(document.getElementById(POPOVER_ID)?.textContent).not.toContain('A one');
  });

  it('reuses one popover DOM node across repeated hovers', async () => {
    const { anchor } = setup(async (request) => success(request.requestId));

    mouseOver(anchor);
    await vi.advanceTimersByTimeAsync(500);
    await flushMicrotasks();
    mouseOut(anchor, document.body);
    mouseOver(anchor);
    await vi.advanceTimersByTimeAsync(500);
    await flushMicrotasks();

    expect(document.querySelectorAll(`#${POPOVER_ID}`)).toHaveLength(1);
  });

  it('renders model text as list-item text rather than HTML', async () => {
    const malicious = '<img src=x onerror=alert(1)>';
    const { anchor } = setup(async (request) =>
      success(request.requestId, [malicious, 'Safe two', 'Safe three']),
    );

    mouseOver(anchor);
    await vi.advanceTimersByTimeAsync(500);
    await flushMicrotasks();

    const popover = document.getElementById(POPOVER_ID);
    expect(popover?.querySelector('img')).toBeNull();
    expect(popover?.querySelector('li')?.textContent).toBe(malicious);
    expect(popover?.querySelectorAll('li')).toHaveLength(3);
  });

  it('notifies the separate Jira actions port after dwell while summary still hides on mouseout', async () => {
    const anchor = createAnchor('https://acme.atlassian.net/browse/CORE-777');
    const actions = { showFor: vi.fn(), linkExited: vi.fn(), stop: vi.fn() };
    const controller = new HoverController({
      root: document.body,
      providers: new LinkProviderRegistry([new AtlassianLinkProvider()]),
      popover: new Popover(document, window),
      sendMessage: vi.fn(async (request) => success(request.requestId)),
      requestIdFactory: () => 'request-actions',
      jiraActions: actions,
    });
    controller.start();
    mouseOver(anchor);
    await vi.advanceTimersByTimeAsync(500);
    expect(actions.showFor).toHaveBeenCalledWith(
      expect.objectContaining({ identifier: 'CORE-777' }),
      anchor,
    );

    const affordance = document.createElement('button');
    mouseOut(anchor, affordance);
    expect(document.getElementById(POPOVER_ID)?.hidden).toBe(true);
    expect(actions.linkExited).toHaveBeenCalledWith(
      expect.objectContaining({ identifier: 'CORE-777' }),
      affordance,
    );
  });
});

function setup(
  implementation: (request: LinkSummaryRequest) => Promise<LinkSummaryResponse> = async (request) =>
    success(request.requestId),
): {
  anchor: HTMLAnchorElement;
  sendMessage: ReturnType<
    typeof vi.fn<(request: LinkSummaryRequest) => Promise<LinkSummaryResponse>>
  >;
} {
  const anchor = createAnchor('https://acme.atlassian.net/browse/CORE-123');
  const sendMessage = vi.fn(implementation);
  let requestNumber = 0;
  const controller = new HoverController({
    root: document.body,
    providers: new LinkProviderRegistry([new AtlassianLinkProvider()]),
    popover: new Popover(document, window),
    sendMessage,
    requestIdFactory: () => `request-${++requestNumber}`,
  });
  controller.start();

  return { anchor, sendMessage };
}

function createAnchor(href: string): HTMLAnchorElement {
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.textContent = href;
  document.body.append(anchor);
  return anchor;
}

function mouseOver(
  target: Element,
  relatedTarget: EventTarget | null = null,
  clientX = 20,
  clientY = 30,
): void {
  target.dispatchEvent(
    new MouseEvent('mouseover', { bubbles: true, relatedTarget, clientX, clientY }),
  );
}

function mouseOut(target: Element, relatedTarget: EventTarget | null): void {
  target.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget }));
}

function success(
  requestId: string,
  bullets: readonly [string, string, string] = BULLETS,
): LinkSummaryResponse {
  return {
    type: 'LINK_SUMMARY_SUCCESS',
    requestId,
    summary: { bullets },
  };
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolvePromise: ((value: T) => void) | undefined;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return {
    promise,
    resolve: (value) => resolvePromise?.(value),
  };
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}
