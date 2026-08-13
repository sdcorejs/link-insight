// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { JiraTransitionsResult, LinkResource } from '../../src/core/contracts';
import {
  JIRA_ACTION_CARD_ID,
  JiraActionCard,
  type JiraActionCardDelegate,
} from '../../src/ui/jira-action-card';

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
      unsupportedRequiredFields: [],
      unsupportedOptionalFields: ['Optional plugin field'],
      fields: [
        {
          fieldId: 'resolution',
          label: 'Resolution',
          type: 'resolution' as const,
          required: true,
          allowedValues: [{ id: '1', label: 'Fixed' }],
        },
        {
          fieldId: 'customfield_10001',
          label: 'Release note',
          type: 'textarea' as const,
          required: false,
          maxLength: 500,
        },
      ],
    },
  ],
};
const TRANSITION = TRANSITIONS.transitions[0]!;

beforeEach(() => document.body.replaceChildren());

describe('JiraActionCard', () => {
  it('reuses one accessible pinned dialog and closes with Escape', () => {
    const { card, delegate } = setup();
    card.open(RESOURCE);
    card.renderTransitions(RESOURCE, TRANSITIONS.currentStatus, TRANSITIONS.transitions);
    card.open(RESOURCE);

    const element = document.getElementById(JIRA_ACTION_CARD_ID)!;
    expect(document.querySelectorAll(`#${JIRA_ACTION_CARD_ID}`)).toHaveLength(1);
    expect(element.getAttribute('role')).toBe('dialog');
    expect(element.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement?.getAttribute('data-action')).toBe('close');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(element.hidden).toBe(true);
    expect(delegate.onClosed).toHaveBeenCalledTimes(1);
  });

  it('restores focus to the originating Jira link when closed', () => {
    const { card } = setup();
    const anchor = document.createElement('a');
    anchor.href = RESOURCE.canonicalUrl;
    anchor.textContent = RESOURCE.identifier;
    document.body.append(anchor);
    card.open(RESOURCE, anchor);

    card.close();

    expect(document.activeElement).toBe(anchor);
  });

  it('announces asynchronous loading, error, and success states', () => {
    const { card } = setup();
    card.open(RESOURCE);
    const loading = document.querySelector('.is-loading');
    expect(loading?.getAttribute('role')).toBe('status');
    expect(loading?.getAttribute('aria-live')).toBe('polite');

    card.renderError('Unable to load Jira transitions.', RESOURCE);
    expect(document.querySelector('.is-error')?.getAttribute('role')).toBe('alert');

    card.renderSuccess('CORE-1 is now Done.');
    const success = document.querySelector('.is-success');
    expect(success?.getAttribute('role')).toBe('status');
    expect(success?.getAttribute('aria-live')).toBe('polite');
  });

  it('renders supported fields safely and emits a draft only after confirmation', () => {
    const { card, delegate } = setup();
    card.open(RESOURCE);
    card.renderTransitions(RESOURCE, TRANSITIONS.currentStatus, TRANSITIONS.transitions);

    const resolution = document.querySelector<HTMLSelectElement>('[data-field-id="resolution"]')!;
    const note = document.querySelector<HTMLTextAreaElement>(
      '[data-field-id="customfield_10001"]',
    )!;
    expect(resolution.options[1]?.textContent).toBe('Fixed');
    expect(document.querySelector('script')).toBeNull();
    expect(document.querySelector('[data-view="form"]')?.textContent).toContain(
      'Not shown here: Optional plugin field.',
    );
    resolution.value = '1';
    note.value = 'Ready to ship';
    document.querySelector<HTMLButtonElement>('[data-action="review"]')!.click();

    expect(delegate.onConfirmTransition).not.toHaveBeenCalled();
    expect(document.querySelector('[data-view="confirmation"]')?.textContent).toContain(
      'In Progress → Done',
    );
    expect(document.querySelector('[data-view="confirmation"]')?.textContent).toContain(
      'Release note: Ready to ship',
    );

    document.querySelector<HTMLButtonElement>('[data-action="confirm"]')!.click();
    expect(delegate.onConfirmTransition).toHaveBeenCalledWith(
      RESOURCE,
      expect.objectContaining({
        transition: expect.objectContaining({ id: '31' }),
        values: { resolution: '1', customfield_10001: 'Ready to ship' },
      }),
    );
  });

  it('blocks unsupported required fields and offers an explicit Jira fallback', () => {
    const { card } = setup();
    card.open(RESOURCE);
    card.renderTransitions(RESOURCE, TRANSITIONS.currentStatus, [
      {
        ...TRANSITION,
        fields: [],
        unsupportedRequiredFields: ['Security approval'],
      },
    ]);

    expect(document.querySelector<HTMLButtonElement>('[data-action="review"]')?.disabled).toBe(
      true,
    );
    const fallback = document.querySelector<HTMLAnchorElement>('[data-action="jira-fallback"]');
    expect(fallback?.href).toBe(RESOURCE.canonicalUrl);
    expect(fallback?.target).toBe('_blank');
    expect(fallback?.rel).toBe('noopener noreferrer');
  });

  it('preserves entered field values and comment when returning from confirmation', () => {
    const { card } = setup();
    card.open(RESOURCE);
    card.renderTransitions(RESOURCE, TRANSITIONS.currentStatus, TRANSITIONS.transitions);
    const resolution = document.querySelector<HTMLSelectElement>('[data-field-id="resolution"]')!;
    const note = document.querySelector<HTMLTextAreaElement>(
      '[data-field-id="customfield_10001"]',
    )!;
    const comment = document.querySelector<HTMLTextAreaElement>('[data-role="comment"]')!;
    resolution.value = '1';
    note.value = 'Keep this draft';
    comment.value = 'Keep this comment';
    document.querySelector<HTMLButtonElement>('[data-action="review"]')!.click();

    document.querySelector<HTMLButtonElement>('[data-action="back"]')!.click();

    expect(document.querySelector<HTMLSelectElement>('[data-field-id="resolution"]')?.value).toBe(
      '1',
    );
    expect(
      document.querySelector<HTMLTextAreaElement>('[data-field-id="customfield_10001"]')?.value,
    ).toBe('Keep this draft');
    expect(document.querySelector<HTMLTextAreaElement>('[data-role="comment"]')?.value).toBe(
      'Keep this comment',
    );
  });
});

function setup() {
  const delegate: JiraActionCardDelegate = {
    onConfirmTransition: vi.fn(),
    onClosed: vi.fn(),
  };
  return { card: new JiraActionCard(document, delegate), delegate };
}
