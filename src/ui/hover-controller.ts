import { RUNTIME_CONFIG } from '../config/runtime-config';
import type { LinkResource } from '../core/contracts';
import type { LinkSummaryRequest } from '../core/message-contracts';
import { parseLinkSummaryResponse } from '../core/message-contracts';
import type { LinkProviderRegistry } from '../link-providers/link-provider-registry';
import type { PointerPosition, Popover } from './popover';

interface HoverControllerOptions {
  readonly root: HTMLElement;
  readonly providers: LinkProviderRegistry;
  readonly popover: Popover;
  readonly sendMessage: (request: LinkSummaryRequest) => Promise<unknown>;
  readonly dwellMs?: number;
  readonly requestIdFactory?: () => string;
  readonly jiraActions?: JiraActionsPort;
}

export interface JiraActionsPort {
  showFor(resource: LinkResource, anchor: HTMLAnchorElement): void;
  linkExited(resource: LinkResource, relatedTarget: EventTarget | null): void;
  stop(): void;
}

export class HoverController {
  private readonly root: HTMLElement;
  private readonly providers: LinkProviderRegistry;
  private readonly popover: Popover;
  private readonly sendMessage: (request: LinkSummaryRequest) => Promise<unknown>;
  private readonly dwellMs: number;
  private readonly requestIdFactory: () => string;
  private readonly jiraActions: JiraActionsPort | undefined;
  private activeAnchor: HTMLAnchorElement | null = null;
  private activeResource: LinkResource | null = null;
  private pointerPosition: PointerPosition = { pageX: 0, pageY: 0 };
  private dwellTimer: ReturnType<typeof setTimeout> | null = null;
  private requestToken = 0;
  private started = false;

  constructor(options: HoverControllerOptions) {
    this.root = options.root;
    this.providers = options.providers;
    this.popover = options.popover;
    this.sendMessage = options.sendMessage;
    this.dwellMs = options.dwellMs ?? RUNTIME_CONFIG.hoverDwellMs;
    this.requestIdFactory = options.requestIdFactory ?? (() => crypto.randomUUID());
    this.jiraActions = options.jiraActions;
  }

  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    this.root.addEventListener('mouseover', this.handleMouseOver);
    this.root.addEventListener('mouseout', this.handleMouseOut);
  }

  stop(): void {
    if (!this.started) {
      return;
    }
    this.started = false;
    this.root.removeEventListener('mouseover', this.handleMouseOver);
    this.root.removeEventListener('mouseout', this.handleMouseOut);
    this.deactivate();
    this.jiraActions?.stop();
  }

  private readonly handleMouseOver = (event: MouseEvent): void => {
    const anchor = closestAnchor(event.target);
    if (anchor === null) {
      return;
    }

    if (isInside(anchor, event.relatedTarget) || anchor === this.activeAnchor) {
      return;
    }

    const resource = this.providers.resolve(anchor.href);
    if (resource === null) {
      return;
    }

    if (this.activeAnchor !== null) {
      this.deactivate();
    }

    this.activeAnchor = anchor;
    this.activeResource = resource;
    this.pointerPosition = { pageX: event.pageX, pageY: event.pageY };
    const token = ++this.requestToken;
    this.dwellTimer = setTimeout(() => {
      this.dwellTimer = null;
      void this.requestSummary(token, anchor, resource);
    }, this.dwellMs);
  };

  private readonly handleMouseOut = (event: MouseEvent): void => {
    const anchor = closestAnchor(event.target);
    if (anchor === null || anchor !== this.activeAnchor || isInside(anchor, event.relatedTarget)) {
      return;
    }

    this.jiraActions?.linkExited(resourceOrNull(this.activeResource), event.relatedTarget);
    this.deactivate();
  };

  private deactivate(): void {
    if (this.dwellTimer !== null) {
      clearTimeout(this.dwellTimer);
      this.dwellTimer = null;
    }
    this.activeAnchor = null;
    this.activeResource = null;
    this.requestToken += 1;
    this.popover.hide();
  }

  private async requestSummary(
    token: number,
    anchor: HTMLAnchorElement,
    resource: LinkResource,
  ): Promise<void> {
    if (!this.isCurrent(token, anchor, resource.canonicalUrl)) {
      return;
    }

    this.jiraActions?.showFor(resource, anchor);
    this.popover.showLoading(this.pointerPosition);
    const requestId = this.requestIdFactory();
    const request: LinkSummaryRequest = {
      type: 'LINK_SUMMARY_REQUEST',
      requestId,
      url: resource.canonicalUrl,
    };

    try {
      const rawResponse = await this.sendMessage(request);
      if (!this.isCurrent(token, anchor, resource.canonicalUrl)) {
        return;
      }

      const response = parseLinkSummaryResponse(rawResponse);
      if (response === null || response.requestId !== requestId) {
        this.popover.showError('Unable to load AI summary.');
        return;
      }

      if (response.type === 'LINK_SUMMARY_SUCCESS') {
        this.popover.showSummary(response.summary);
      } else {
        this.popover.showError(response.error.message);
      }
    } catch {
      if (this.isCurrent(token, anchor, resource.canonicalUrl)) {
        this.popover.showError('Unable to load AI summary.');
      }
    }
  }

  private isCurrent(token: number, anchor: HTMLAnchorElement, canonicalUrl: string): boolean {
    return (
      token === this.requestToken &&
      anchor === this.activeAnchor &&
      canonicalUrl === this.activeResource?.canonicalUrl
    );
  }
}

function resourceOrNull(resource: LinkResource | null): LinkResource {
  if (resource === null) {
    throw new TypeError('The active hover resource is missing.');
  }
  return resource;
}

function closestAnchor(target: EventTarget | null): HTMLAnchorElement | null {
  return target instanceof Element ? target.closest('a') : null;
}

function isInside(anchor: HTMLAnchorElement, target: EventTarget | null): boolean {
  return target instanceof Node && anchor.contains(target);
}
