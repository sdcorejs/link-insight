import type { AiSummary } from '../core/contracts';

export const POPOVER_ID = 'sdcorejs-link-insight-popover';
const CURSOR_OFFSET = 15;
const VIEWPORT_MARGIN = 8;

export interface PointerPosition {
  readonly pageX: number;
  readonly pageY: number;
}

export class Popover {
  private element: HTMLDivElement | null = null;
  private lastPosition: PointerPosition = { pageX: 0, pageY: 0 };

  constructor(
    private readonly document: Document,
    private readonly window: Window,
  ) {}

  showLoading(position: PointerPosition): void {
    const element = this.ensureElement();
    this.lastPosition = position;
    element.className = 'sdcorejs-link-insight-popover is-loading';
    element.textContent = 'Loading AI summary...';
    element.setAttribute('aria-busy', 'true');
    this.show(element);
  }

  showSummary(summary: AiSummary): void {
    const element = this.ensureElement();
    const list = this.document.createElement('ul');

    for (const bullet of summary.bullets) {
      const item = this.document.createElement('li');
      item.textContent = bullet;
      list.append(item);
    }

    element.className = 'sdcorejs-link-insight-popover is-success';
    element.replaceChildren(list);
    element.setAttribute('aria-busy', 'false');
    this.show(element);
  }

  showError(message: string): void {
    const element = this.ensureElement();
    element.className = 'sdcorejs-link-insight-popover is-error';
    element.textContent = message;
    element.setAttribute('aria-busy', 'false');
    this.show(element);
  }

  hide(): void {
    if (this.element === null) {
      return;
    }

    this.element.classList.remove('is-visible');
    this.element.hidden = true;
    this.element.setAttribute('aria-busy', 'false');
  }

  private ensureElement(): HTMLDivElement {
    if (this.element !== null && this.element.isConnected) {
      return this.element;
    }

    const existing = this.document.getElementById(POPOVER_ID);
    if (existing instanceof HTMLDivElement) {
      this.element = existing;
      return existing;
    }

    const element = this.document.createElement('div');
    element.id = POPOVER_ID;
    element.className = 'sdcorejs-link-insight-popover';
    element.hidden = true;
    element.setAttribute('role', 'status');
    element.setAttribute('aria-live', 'polite');
    element.setAttribute('aria-atomic', 'true');
    element.setAttribute('aria-busy', 'false');
    this.document.body.append(element);
    this.element = element;
    return element;
  }

  private show(element: HTMLDivElement): void {
    element.hidden = false;
    this.position(element, this.lastPosition);
    element.classList.add('is-visible');
  }

  private position(element: HTMLDivElement, position: PointerPosition): void {
    const viewportLeft = this.window.scrollX + VIEWPORT_MARGIN;
    const viewportTop = this.window.scrollY + VIEWPORT_MARGIN;
    const proposedLeft = position.pageX + CURSOR_OFFSET;
    const proposedTop = position.pageY + CURSOR_OFFSET;

    element.style.left = `${proposedLeft}px`;
    element.style.top = `${proposedTop}px`;

    const bounds = element.getBoundingClientRect();
    const maximumLeft = Math.max(
      viewportLeft,
      this.window.scrollX + this.window.innerWidth - bounds.width - VIEWPORT_MARGIN,
    );
    const maximumTop = Math.max(
      viewportTop,
      this.window.scrollY + this.window.innerHeight - bounds.height - VIEWPORT_MARGIN,
    );

    element.style.left = `${clamp(proposedLeft, viewportLeft, maximumLeft)}px`;
    element.style.top = `${clamp(proposedTop, viewportTop, maximumTop)}px`;
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}
