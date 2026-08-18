import type {
  JiraTransition,
  JiraTransitionField,
  JiraTransitionFieldValue,
  LinkResource,
} from '../core/contracts';

export const JIRA_ACTION_CARD_ID = 'sdcorejs-link-insight-jira-action-card';

export interface JiraTransitionDraft {
  readonly transition: JiraTransition;
  readonly currentStatus: string;
  readonly values: Readonly<Record<string, JiraTransitionFieldValue>>;
  readonly displayValues: readonly { readonly label: string; readonly value: string }[];
  readonly comment?: string;
}

export interface JiraActionCardDelegate {
  onConfirmTransition(resource: LinkResource, draft: JiraTransitionDraft): void | Promise<void>;
  onClosed(): void;
}

export interface JiraActionCardPort {
  setDelegate(delegate: JiraActionCardDelegate): void;
  open(resource: LinkResource, opener?: HTMLElement): void;
  isOpenFor(resource: LinkResource): boolean;
  renderTransitions(
    resource: LinkResource,
    currentStatus: string,
    transitions: readonly JiraTransition[],
    notice?: string,
  ): void;
  renderLoading(message?: string): void;
  renderError(message: string, resource: LinkResource): void;
  renderSuccess(message: string): void;
  setConfirmationPending(pending: boolean): void;
  close(): void;
  dispose?(): void;
}

export class JiraActionCard implements JiraActionCardPort {
  private element: HTMLDivElement | null = null;
  private body: HTMLDivElement | null = null;
  private title: HTMLHeadingElement | null = null;
  private closeButton: HTMLButtonElement | null = null;
  private activeResource: LinkResource | null = null;
  private opener: HTMLElement | null = null;
  private transitions: readonly JiraTransition[] = [];
  private currentStatus = '';

  constructor(
    private readonly document: Document,
    private delegate: JiraActionCardDelegate | null = null,
  ) {
    this.document.addEventListener('keydown', this.handleKeyDown);
  }

  setDelegate(delegate: JiraActionCardDelegate): void {
    this.delegate = delegate;
  }

  open(resource: LinkResource, opener?: HTMLElement): void {
    if (resource.resourceType !== 'jira-issue') return;
    const element = this.ensureElement();
    this.activeResource = resource;
    this.opener = opener ?? null;
    this.transitions = [];
    this.currentStatus = '';
    element.hidden = false;
    this.title!.textContent = `Jira actions · ${resource.identifier}`;
    this.renderLoading();
    this.closeButton!.focus();
  }

  isOpenFor(resource: LinkResource): boolean {
    return (
      this.element?.hidden === false && this.activeResource?.canonicalUrl === resource.canonicalUrl
    );
  }

  renderTransitions(
    resource: LinkResource,
    currentStatus: string,
    transitions: readonly JiraTransition[],
    notice?: string,
  ): void {
    if (!this.isOpenFor(resource)) return;
    this.currentStatus = currentStatus;
    this.transitions = transitions;
    this.renderTransitionForm(resource, currentStatus, transitions, notice);
  }

  renderLoading(message = 'Loading Jira transitions…'): void {
    this.requireBody().replaceChildren(this.createNotice(message, 'loading'));
  }

  renderError(message: string, resource: LinkResource): void {
    if (!this.isOpenFor(resource)) return;
    this.requireBody().replaceChildren(
      this.createNotice(message, 'error'),
      this.createFallback(resource),
    );
  }

  renderSuccess(message: string): void {
    this.requireBody().replaceChildren(this.createNotice(message, 'success'));
  }

  setConfirmationPending(pending: boolean): void {
    for (const action of ['back', 'confirm']) {
      const button = this.element?.querySelector<HTMLButtonElement>(`[data-action="${action}"]`);
      if (button !== null && button !== undefined) button.disabled = pending;
    }
  }

  close(): void {
    const wasOpen = this.element?.hidden === false;
    this.activeResource = null;
    this.transitions = [];
    this.currentStatus = '';
    if (this.element !== null) this.element.hidden = true;
    this.opener?.focus();
    this.opener = null;
    if (wasOpen) this.delegate?.onClosed();
  }

  dispose(): void {
    this.close();
    this.document.removeEventListener('keydown', this.handleKeyDown);
    this.element?.remove();
    this.element = null;
    this.body = null;
    this.title = null;
    this.closeButton = null;
  }

  private renderTransitionForm(
    resource: LinkResource,
    currentStatus: string,
    transitions: readonly JiraTransition[],
    notice?: string,
    draft?: JiraTransitionDraft,
  ): void {
    const body = this.requireBody();
    body.replaceChildren();
    const view = this.document.createElement('div');
    view.dataset.view = 'form';
    if (notice !== undefined) view.append(this.createNotice(notice, 'error'));
    if (transitions.length === 0) {
      view.append(this.createNotice('No Jira transitions are currently available.', 'info'));
      view.append(this.createFallback(resource));
      body.append(view);
      return;
    }

    const transitionLabel = this.document.createElement('label');
    transitionLabel.htmlFor = 'sdcorejs-link-insight-transition';
    transitionLabel.textContent = 'Transition';
    const transitionSelect = this.document.createElement('select');
    transitionSelect.id = 'sdcorejs-link-insight-transition';
    transitionSelect.dataset.role = 'transition';
    for (const transition of transitions) {
      const option = this.document.createElement('option');
      option.value = transition.id;
      option.textContent = `${transition.name} → ${transition.toStatus}`;
      transitionSelect.append(option);
    }
    if (draft !== undefined) transitionSelect.value = draft.transition.id;
    const fieldsHost = this.document.createElement('div');
    fieldsHost.className = 'sdcorejs-link-insight-jira-fields';
    const actions = this.document.createElement('div');
    actions.className = 'sdcorejs-link-insight-jira-card-actions';
    const review = this.createButton('Review transition', 'review', 'primary');
    actions.append(review);
    view.append(transitionLabel, transitionSelect, fieldsHost, actions);
    body.append(view);

    const renderSelected = (selectedDraft?: JiraTransitionDraft): void => {
      const transition = transitions.find((candidate) => candidate.id === transitionSelect.value)!;
      this.renderFields(fieldsHost, transition, resource, selectedDraft);
      review.disabled = transition.unsupportedRequiredFields.length > 0;
    };
    transitionSelect.addEventListener('change', () => renderSelected());
    review.addEventListener('click', () => {
      const transition = transitions.find((candidate) => candidate.id === transitionSelect.value);
      if (transition === undefined) return;
      const pending = this.collectTransition(fieldsHost, transition, currentStatus);
      if (pending !== null) this.renderConfirmation(resource, pending);
    });
    renderSelected(draft);
  }

  private renderFields(
    host: HTMLDivElement,
    transition: JiraTransition,
    resource: LinkResource,
    draft?: JiraTransitionDraft,
  ): void {
    host.replaceChildren();
    const status = this.document.createElement('p');
    status.className = 'sdcorejs-link-insight-jira-destination';
    status.textContent = `Destination status: ${transition.toStatus}`;
    host.append(status);

    for (const field of transition.fields) {
      const wrapper = this.document.createElement('div');
      wrapper.className = 'sdcorejs-link-insight-jira-field';
      const id = `sdcorejs-link-insight-field-${field.fieldId}`;
      const label = this.document.createElement('label');
      label.htmlFor = id;
      label.textContent = `${field.label}${field.required ? ' *' : ''}`;
      const control = this.createFieldControl(field, id);
      this.restoreFieldValue(control, draft?.values[field.fieldId]);
      wrapper.append(label, control);
      host.append(wrapper);
    }

    const commentWrapper = this.document.createElement('div');
    commentWrapper.className = 'sdcorejs-link-insight-jira-field';
    const commentLabel = this.document.createElement('label');
    commentLabel.htmlFor = 'sdcorejs-link-insight-transition-comment';
    commentLabel.textContent = 'Comment (optional)';
    const comment = this.document.createElement('textarea');
    comment.id = 'sdcorejs-link-insight-transition-comment';
    comment.dataset.role = 'comment';
    comment.maxLength = 4_000;
    comment.rows = 3;
    comment.value = draft?.comment ?? '';
    commentWrapper.append(commentLabel, comment);
    host.append(commentWrapper);

    if ((transition.unsupportedOptionalFields?.length ?? 0) > 0) {
      host.append(
        this.createNotice(
          `Not shown here: ${transition.unsupportedOptionalFields!.join(', ')}.`,
          'info',
        ),
      );
    }

    if (transition.unsupportedRequiredFields.length > 0) {
      host.append(
        this.createNotice(
          `Complete these required fields in Jira: ${transition.unsupportedRequiredFields.join(', ')}.`,
          'error',
        ),
        this.createFallback(resource),
      );
    }
  }

  private createFieldControl(
    field: JiraTransitionField,
    id: string,
  ): HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
    let control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    if (field.type === 'textarea' || field.type === 'comment') {
      control = this.document.createElement('textarea');
      control.rows = 3;
    } else if (
      field.type === 'single-select' ||
      field.type === 'multi-select' ||
      field.type === 'user' ||
      field.type === 'resolution'
    ) {
      control = this.document.createElement('select');
      control.multiple = field.type === 'multi-select';
      if (!control.multiple) {
        const empty = this.document.createElement('option');
        empty.value = '';
        empty.textContent = 'Select…';
        control.append(empty);
      }
      for (const allowed of field.allowedValues ?? []) {
        const option = this.document.createElement('option');
        option.value = allowed.id;
        option.textContent = allowed.label;
        control.append(option);
      }
    } else {
      control = this.document.createElement('input');
      control.type = field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text';
    }
    control.id = id;
    control.dataset.fieldId = field.fieldId;
    control.required = field.required;
    if (field.maxLength !== undefined && !(control instanceof HTMLSelectElement)) {
      control.maxLength = field.maxLength;
    }
    return control;
  }

  private restoreFieldValue(
    control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
    value: JiraTransitionFieldValue | undefined,
  ): void {
    if (value === undefined) return;
    if (control instanceof HTMLSelectElement && control.multiple && Array.isArray(value)) {
      const selected = new Set(value);
      for (const option of control.options) option.selected = selected.has(option.value);
      return;
    }
    if (!Array.isArray(value)) control.value = String(value);
  }

  private collectTransition(
    host: HTMLDivElement,
    transition: JiraTransition,
    currentStatus: string,
  ): JiraTransitionDraft | null {
    const values: Record<string, JiraTransitionFieldValue> = {};
    const displayValues: Array<{ label: string; value: string }> = [];
    for (const field of transition.fields) {
      const control = host.querySelector<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >(`[data-field-id="${CSS.escape(field.fieldId)}"]`);
      if (control === null) return null;
      let value: JiraTransitionFieldValue | undefined;
      let display: string;
      if (control instanceof HTMLSelectElement && control.multiple) {
        const selected = [...control.selectedOptions];
        value = selected.map((option) => option.value);
        display = selected.map((option) => option.textContent ?? option.value).join(', ');
      } else if (control instanceof HTMLSelectElement) {
        value = control.value;
        display = control.selectedOptions[0]?.textContent ?? control.value;
      } else if (field.type === 'number') {
        value = control.value === '' ? undefined : Number(control.value);
        display = control.value;
      } else {
        value = control.value.trim();
        display = control.value.trim();
      }
      const empty =
        value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
      if (field.required && empty) {
        control.setCustomValidity('Complete this required field.');
        control.reportValidity();
        return null;
      }
      control.setCustomValidity('');
      if (!empty && value !== undefined) {
        values[field.fieldId] = value;
        displayValues.push({ label: field.label, value: display });
      }
    }
    const commentControl = host.querySelector<HTMLTextAreaElement>('[data-role="comment"]');
    const comment = commentControl?.value.trim() ?? '';
    if (comment !== '') displayValues.push({ label: 'Comment', value: comment });
    return {
      transition,
      currentStatus,
      values,
      displayValues,
      ...(comment === '' ? {} : { comment }),
    };
  }

  private renderConfirmation(resource: LinkResource, pending: JiraTransitionDraft): void {
    const body = this.requireBody();
    body.replaceChildren();
    const view = this.document.createElement('div');
    view.dataset.view = 'confirmation';
    const heading = this.document.createElement('h3');
    heading.textContent = 'Confirm Jira transition';
    const issue = this.document.createElement('p');
    issue.textContent = resource.identifier;
    const status = this.document.createElement('p');
    status.className = 'sdcorejs-link-insight-jira-confirm-status';
    status.textContent = `${pending.currentStatus} → ${pending.transition.toStatus}`;
    const list = this.document.createElement('dl');
    for (const entry of pending.displayValues) {
      const term = this.document.createElement('dt');
      term.textContent = `${entry.label}: `;
      const detail = this.document.createElement('dd');
      detail.textContent = entry.value;
      list.append(term, detail);
    }
    const actions = this.document.createElement('div');
    actions.className = 'sdcorejs-link-insight-jira-card-actions';
    const back = this.createButton('Back', 'back', 'secondary');
    const confirm = this.createButton('Confirm transition', 'confirm', 'primary');
    back.addEventListener('click', () =>
      this.renderTransitionForm(
        resource,
        pending.currentStatus,
        this.transitions,
        undefined,
        pending,
      ),
    );
    confirm.addEventListener('click', () => {
      this.setConfirmationPending(true);
      void this.delegate?.onConfirmTransition(resource, pending);
    });
    actions.append(back, confirm);
    view.append(heading, issue, status, list, actions);
    body.append(view);
    confirm.focus();
  }

  private createNotice(
    message: string,
    state: 'loading' | 'info' | 'success' | 'error',
  ): HTMLParagraphElement {
    const notice = this.document.createElement('p');
    notice.className = `sdcorejs-link-insight-jira-notice is-${state}`;
    notice.textContent = message;
    if (state === 'error') {
      notice.setAttribute('role', 'alert');
    } else if (state === 'loading' || state === 'success') {
      notice.setAttribute('role', 'status');
      notice.setAttribute('aria-live', 'polite');
    }
    return notice;
  }

  private createFallback(resource: LinkResource): HTMLAnchorElement {
    const link = this.document.createElement('a');
    link.dataset.action = 'jira-fallback';
    link.href = resource.canonicalUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'Finish in Jira';
    return link;
  }

  private createButton(
    text: string,
    action: string,
    style: 'primary' | 'secondary',
  ): HTMLButtonElement {
    const button = this.document.createElement('button');
    button.type = 'button';
    button.dataset.action = action;
    button.className = `is-${style}`;
    button.textContent = text;
    return button;
  }

  private ensureElement(): HTMLDivElement {
    if (this.element !== null && this.element.isConnected) return this.element;
    const element = this.document.createElement('div');
    element.id = JIRA_ACTION_CARD_ID;
    element.hidden = true;
    element.setAttribute('role', 'dialog');
    element.setAttribute('aria-modal', 'true');
    element.setAttribute('aria-labelledby', `${JIRA_ACTION_CARD_ID}-title`);
    const header = this.document.createElement('header');
    const title = this.document.createElement('h2');
    title.id = `${JIRA_ACTION_CARD_ID}-title`;
    const close = this.createButton('Close', 'close', 'secondary');
    close.setAttribute('aria-label', 'Close Jira actions');
    close.addEventListener('click', () => this.close());
    header.append(title, close);
    const body = this.document.createElement('div');
    body.className = 'sdcorejs-link-insight-jira-card-body';
    element.append(header, body);
    this.document.body.append(element);
    this.element = element;
    this.body = body;
    this.title = title;
    this.closeButton = close;
    return element;
  }

  private requireBody(): HTMLDivElement {
    this.ensureElement();
    return this.body!;
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (this.element === null || this.element.hidden) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [
      ...this.element.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href]',
      ),
    ];
    if (focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable.at(-1)!;
    if (event.shiftKey && this.document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && this.document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
}
