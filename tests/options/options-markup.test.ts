// @vitest-environment jsdom

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

describe('Options Page markup', () => {
  it('contains the required copy, safe AI Studio link, and accessible controls', async () => {
    const html = await readFile(
      path.resolve(import.meta.dirname, '../../entrypoints/options/index.html'),
      'utf8',
    );
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    const visibleText = parsed.body.textContent?.replace(/\s+/gu, ' ').trim();
    const link = parsed.querySelector<HTMLAnchorElement>(
      'a[href="https://aistudio.google.com/apikey"]',
    );
    const input = parsed.querySelector<HTMLInputElement>('#gemini-api-key');
    const label = parsed.querySelector<HTMLLabelElement>('label[for="gemini-api-key"]');
    const status = parsed.querySelector<HTMLElement>('#save-status');
    const form = parsed.querySelector<HTMLFormElement>('#api-key-form');

    expect(visibleText).toContain(
      'To use this extension, you need a Google Gemini API Key. Get your free API key here: Google AI Studio',
    );
    expect(link?.target).toBe('_blank');
    expect(link?.rel).toBe('noopener noreferrer');
    expect(input?.type).toBe('password');
    expect(input?.name).toBe('');
    expect(form?.method).toBe('post');
    expect(label).not.toBeNull();
    expect(status?.getAttribute('aria-live')).toBe('polite');

    const connect = parsed.querySelector<HTMLButtonElement>('#connect-jira');
    const disconnect = parsed.querySelector<HTMLButtonElement>('#disconnect-jira');
    const consent = parsed.querySelector<HTMLInputElement>('#jira-ai-consent');
    const consentLabel = parsed.querySelector<HTMLLabelElement>('label[for="jira-ai-consent"]');
    const jiraStatus = parsed.querySelector<HTMLElement>('#jira-connection-status');
    const privacy = parsed.querySelector<HTMLAnchorElement>('#jira-privacy-link');
    expect(connect?.type).toBe('button');
    expect(disconnect?.type).toBe('button');
    expect(consent?.type).toBe('checkbox');
    expect(consentLabel).not.toBeNull();
    expect(jiraStatus?.getAttribute('aria-live')).toBe('polite');
    expect(privacy?.target).toBe('_blank');
    expect(privacy?.rel).toBe('noopener noreferrer');
    expect(parsed.querySelector('input[name*="session" i]')).toBeNull();
  });
});
