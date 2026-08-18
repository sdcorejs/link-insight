import type { LinkResource } from '../core/contracts';
import { parseJiraRuntimeResponse, type JiraRuntimeRequest } from '../core/message-contracts';
import type {
  JiraActionCardDelegate,
  JiraActionCardPort,
  JiraTransitionDraft,
} from './jira-action-card';

export const JIRA_ACTION_TRIGGER_ID = 'sdcorejs-link-insight-jira-actions';

type SendMessage = (request: JiraRuntimeRequest) => Promise<unknown>;

interface JiraActionControllerOptions {
  readonly createRequestId?: () => string;
  readonly createIdempotencyKey?: () => string;
  readonly hideDelayMs?: number;
}

export class JiraActionController implements JiraActionCardDelegate {
  private trigger: HTMLButtonElement | null = null;
  private activeResource: LinkResource | null = null;
  private activeAnchor: HTMLAnchorElement | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private generation = 0;
  private writePending = false;
  private readonly createRequestId: () => string;
  private readonly createIdempotencyKey: () => string;
  private readonly hideDelayMs: number;

  constructor(
    private readonly document: Document,
    private readonly window: Window,
    private readonly card: JiraActionCardPort,
    private readonly sendMessage: SendMessage,
    options: JiraActionControllerOptions = {},
  ) {
    this.createRequestId = options.createRequestId ?? (() => crypto.randomUUID());
    this.createIdempotencyKey = options.createIdempotencyKey ?? (() => crypto.randomUUID());
    this.hideDelayMs = options.hideDelayMs ?? 150;
    this.card.setDelegate(this);
  }

  showFor(resource: LinkResource, anchor: HTMLAnchorElement): void {
    if (resource.resourceType !== 'jira-issue') return;
    this.cancelHide();
    const trigger = this.ensureTrigger();
    this.activeResource = resource;
    this.activeAnchor = anchor;
    const bounds = anchor.getBoundingClientRect();
    const left = Math.min(
      this.window.scrollX + bounds.right + 8,
      this.window.scrollX + this.window.innerWidth - 128,
    );
    trigger.style.left = `${Math.max(this.window.scrollX + 8, left)}px`;
    trigger.style.top = `${this.window.scrollY + bounds.top}px`;
    trigger.hidden = false;
  }

  linkExited(resource: LinkResource, relatedTarget: EventTarget | null): void {
    if (resource.canonicalUrl !== this.activeResource?.canonicalUrl) return;
    if (relatedTarget instanceof Node && this.trigger?.contains(relatedTarget)) return;
    this.scheduleHide();
  }

  async onConfirmTransition(resource: LinkResource, draft: JiraTransitionDraft): Promise<void> {
    if (this.writePending || !this.card.isOpenFor(resource)) return;
    this.writePending = true;
    this.card.setConfirmationPending(true);
    const generation = this.generation;
    const requestId = this.createRequestId();
    try {
      const response = parseJiraRuntimeResponse(
        await this.sendMessage({
          type: 'JIRA_TRANSITION_EXECUTE_REQUEST',
          requestId,
          url: resource.canonicalUrl,
          transitionId: draft.transition.id,
          idempotencyKey: this.createIdempotencyKey(),
          values: draft.values,
          ...(draft.comment === undefined ? {} : { comment: draft.comment }),
        }),
      );
      if (!this.isCurrentCard(resource, generation)) return;
      if (response === null || response.requestId !== requestId) {
        this.card.renderError('Unable to verify the Jira transition result.', resource);
      } else if (response.type === 'JIRA_OPERATION_ERROR') {
        if (
          response.error.code === 'AMBIGUOUS_WRITE_OUTCOME' ||
          response.error.code === 'JIRA_TRANSITION_STALE'
        ) {
          await this.loadTransitions(resource, ++this.generation, response.error.message);
        } else {
          this.card.renderError(response.error.message, resource);
        }
      } else if (
        response.type === 'JIRA_TRANSITION_EXECUTE_SUCCESS' &&
        response.result.issueKey === resource.identifier
      ) {
        if (response.result.applied) {
          this.card.renderSuccess(`${resource.identifier} is now ${response.result.newStatus}.`);
        } else {
          await this.loadTransitions(
            resource,
            ++this.generation,
            'This transition request was already processed. Jira state has been refreshed.',
          );
        }
      } else {
        this.card.renderError('Unable to verify the Jira transition result.', resource);
      }
    } catch {
      if (this.isCurrentCard(resource, generation)) {
        await this.loadTransitions(
          resource,
          ++this.generation,
          'The transition result is uncertain. Verify the issue before trying again.',
        );
      }
    } finally {
      this.writePending = false;
      if (this.card.isOpenFor(resource)) this.card.setConfirmationPending(false);
    }
  }

  onClosed(): void {
    this.generation += 1;
    this.writePending = false;
  }

  stop(): void {
    this.cancelHide();
    this.generation += 1;
    this.trigger?.remove();
    this.trigger = null;
    this.activeResource = null;
    this.activeAnchor = null;
    if (this.card.dispose !== undefined) this.card.dispose();
    else this.card.close();
  }

  private ensureTrigger(): HTMLButtonElement {
    if (this.trigger !== null && this.trigger.isConnected) return this.trigger;
    const trigger = this.document.createElement('button');
    trigger.id = JIRA_ACTION_TRIGGER_ID;
    trigger.type = 'button';
    trigger.hidden = true;
    trigger.textContent = 'Jira actions';
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.addEventListener('click', () => {
      const resource = this.activeResource;
      const anchor = this.activeAnchor;
      if (resource !== null && anchor !== null) {
        this.card.open(resource, anchor);
        void this.loadTransitions(resource, ++this.generation);
      }
    });
    trigger.addEventListener('mouseenter', () => this.cancelHide());
    trigger.addEventListener('mouseout', (event) => {
      if (event.relatedTarget instanceof Node && this.activeAnchor?.contains(event.relatedTarget)) {
        return;
      }
      this.scheduleHide();
    });
    this.document.body.append(trigger);
    this.trigger = trigger;
    return trigger;
  }

  private async loadTransitions(
    resource: LinkResource,
    generation: number,
    notice?: string,
  ): Promise<void> {
    if (!this.card.isOpenFor(resource)) return;
    this.card.renderLoading(notice === undefined ? undefined : 'Refreshing Jira state…');
    const requestId = this.createRequestId();
    try {
      const response = parseJiraRuntimeResponse(
        await this.sendMessage({
          type: 'JIRA_TRANSITIONS_REQUEST',
          requestId,
          url: resource.canonicalUrl,
        }),
      );
      if (!this.isCurrentCard(resource, generation)) return;
      if (response === null || response.requestId !== requestId) {
        this.card.renderError('Unable to load Jira transitions.', resource);
      } else if (response.type === 'JIRA_OPERATION_ERROR') {
        this.card.renderError(response.error.message, resource);
      } else if (
        response.type === 'JIRA_TRANSITIONS_SUCCESS' &&
        response.result.issueKey === resource.identifier
      ) {
        this.card.renderTransitions(
          resource,
          response.result.currentStatus,
          response.result.transitions,
          notice,
        );
      } else {
        this.card.renderError('Unable to load Jira transitions.', resource);
      }
    } catch {
      if (this.isCurrentCard(resource, generation)) {
        this.card.renderError('Unable to load Jira transitions.', resource);
      }
    }
  }

  private isCurrentCard(resource: LinkResource, generation: number): boolean {
    return generation === this.generation && this.card.isOpenFor(resource);
  }

  private scheduleHide(): void {
    this.cancelHide();
    this.hideTimer = setTimeout(() => this.hideTrigger(), this.hideDelayMs);
  }

  private cancelHide(): void {
    if (this.hideTimer !== null) clearTimeout(this.hideTimer);
    this.hideTimer = null;
  }

  private hideTrigger(): void {
    this.cancelHide();
    if (this.trigger !== null) this.trigger.hidden = true;
    this.activeResource = null;
    this.activeAnchor = null;
  }
}
