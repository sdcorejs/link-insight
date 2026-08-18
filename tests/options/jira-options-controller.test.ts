// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { initializeJiraOptions } from '../../src/options/jira-options-controller';

beforeEach(() => {
  document.body.innerHTML = `
    <section id="jira-settings">
      <button id="connect-jira" type="button">Connect Jira</button>
      <button id="disconnect-jira" type="button">Disconnect</button>
      <p id="jira-connection-status" role="status" aria-live="polite"></p>
      <ul id="jira-sites"></ul>
      <input id="jira-ai-consent" type="checkbox" />
      <a id="jira-privacy-link" target="_blank" rel="noopener noreferrer">Privacy</a>
    </section>
  `;
});

describe('initializeJiraOptions', () => {
  it('loads disconnected state and starts OAuth only from the Connect button gesture', async () => {
    const sendMessage = vi
      .fn()
      .mockResolvedValueOnce(connectionResponse('status-1', false))
      .mockResolvedValueOnce(connectionResponse('connect-1', true));
    await initializeJiraOptions(document, sendMessage, {
      createRequestId: vi.fn().mockReturnValueOnce('status-1').mockReturnValueOnce('connect-1'),
      privacyUrl: 'https://worker.example/privacy',
    });

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(getConnect().textContent).toBe('Connect Jira');
    getConnect().click();
    expect(getConnect().disabled).toBe(true);
    await vi.waitFor(() => expect(getStatus().textContent).toBe('Jira connected.'));
    expect(sendMessage).toHaveBeenLastCalledWith({
      type: 'JIRA_CONNECT_REQUEST',
      requestId: 'connect-1',
    });
    expect(getSites().textContent).toContain('Acme Jira');
    expect(getSites().textContent).toContain('acme.atlassian.net');
  });

  it('shows reauthorization state without exposing a token field', async () => {
    await initializeJiraOptions(
      document,
      vi.fn(async (request: { requestId: string }) => ({
        ...connectionResponse(request.requestId, false),
        connection: { connected: false, reauthorizationRequired: true, sites: [] },
      })),
      { createRequestId: () => 'status-2', privacyUrl: 'https://worker.example/privacy' },
    );

    expect(getConnect().textContent).toBe('Reconnect Jira');
    expect(getStatus().textContent).toBe('Jira authorization expired. Reconnect to continue.');
    expect(document.querySelector('input[name*="session" i]')).toBeNull();
  });

  it('disconnects, clears the visible site list, and reports via aria-live', async () => {
    const sendMessage = vi
      .fn()
      .mockResolvedValueOnce(connectionResponse('status-3', true))
      .mockResolvedValueOnce({
        type: 'JIRA_DISCONNECT_SUCCESS',
        requestId: 'disconnect-1',
        remoteRevocationConfirmed: true,
      });
    await initializeJiraOptions(document, sendMessage, {
      createRequestId: vi.fn().mockReturnValueOnce('status-3').mockReturnValueOnce('disconnect-1'),
      privacyUrl: 'https://worker.example/privacy',
    });

    getDisconnect().click();

    await vi.waitFor(() => expect(getStatus().textContent).toBe('Jira disconnected.'));
    expect(getSites().children).toHaveLength(0);
    expect(getDisconnect().hidden).toBe(true);
    expect(getStatus().getAttribute('aria-live')).toBe('polite');
  });

  it('shows a local-only warning when remote Jira revocation cannot be confirmed', async () => {
    const sendMessage = vi
      .fn()
      .mockResolvedValueOnce(connectionResponse('status-remote-warning', true))
      .mockResolvedValueOnce({
        type: 'JIRA_DISCONNECT_SUCCESS',
        requestId: 'disconnect-remote-warning',
        remoteRevocationConfirmed: false,
      });
    await initializeJiraOptions(document, sendMessage, {
      createRequestId: vi
        .fn()
        .mockReturnValueOnce('status-remote-warning')
        .mockReturnValueOnce('disconnect-remote-warning'),
      privacyUrl: 'https://worker.example/privacy',
    });

    getDisconnect().click();

    await vi.waitFor(() => expect(getDisconnect().hidden).toBe(true));
    expect(getStatus().textContent).toBe(
      'Jira was disconnected locally, but remote revocation could not be confirmed.',
    );
  });

  it('keeps AI consent default-off and saves it independently', async () => {
    const sendMessage = vi
      .fn()
      .mockResolvedValueOnce(connectionResponse('status-4', true, false))
      .mockResolvedValueOnce({
        type: 'JIRA_CONSENT_SUCCESS',
        requestId: 'consent-1',
        enabled: true,
      });
    await initializeJiraOptions(document, sendMessage, {
      createRequestId: vi.fn().mockReturnValueOnce('status-4').mockReturnValueOnce('consent-1'),
      privacyUrl: 'https://worker.example/privacy',
    });

    expect(getConsent().checked).toBe(false);
    getConsent().checked = true;
    getConsent().dispatchEvent(new Event('change', { bubbles: true }));

    await vi.waitFor(() =>
      expect(getStatus().textContent).toBe('Jira AI summary sharing enabled.'),
    );
    expect(sendMessage).toHaveBeenLastCalledWith({
      type: 'JIRA_CONSENT_SET_REQUEST',
      requestId: 'consent-1',
      enabled: true,
    });
    expect(getPrivacyLink().href).toBe('https://worker.example/privacy');
  });
});

function connectionResponse(requestId: string, connected: boolean, consentEnabled = false) {
  return {
    type: 'JIRA_CONNECTION_SUCCESS',
    requestId,
    connection: {
      connected,
      reauthorizationRequired: false,
      sites: connected ? [{ host: 'acme.atlassian.net', displayName: 'Acme Jira' }] : [],
    },
    consentEnabled,
  };
}

function getConnect(): HTMLButtonElement {
  return document.querySelector<HTMLButtonElement>('#connect-jira')!;
}
function getDisconnect(): HTMLButtonElement {
  return document.querySelector<HTMLButtonElement>('#disconnect-jira')!;
}
function getStatus(): HTMLParagraphElement {
  return document.querySelector<HTMLParagraphElement>('#jira-connection-status')!;
}
function getSites(): HTMLUListElement {
  return document.querySelector<HTMLUListElement>('#jira-sites')!;
}
function getConsent(): HTMLInputElement {
  return document.querySelector<HTMLInputElement>('#jira-ai-consent')!;
}
function getPrivacyLink(): HTMLAnchorElement {
  return document.querySelector<HTMLAnchorElement>('#jira-privacy-link')!;
}
