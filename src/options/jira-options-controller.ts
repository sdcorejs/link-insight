import type { JiraConnectionStatus } from '../core/contracts';
import { parseJiraRuntimeResponse, type JiraRuntimeRequest } from '../core/message-contracts';

type SendMessage = (request: JiraRuntimeRequest) => Promise<unknown>;

interface JiraOptionsControllerOptions {
  readonly createRequestId?: () => string;
  readonly privacyUrl: string;
}

interface JiraOptionsElements {
  readonly connectButton: HTMLButtonElement;
  readonly disconnectButton: HTMLButtonElement;
  readonly status: HTMLParagraphElement;
  readonly sites: HTMLUListElement;
  readonly consent: HTMLInputElement;
  readonly privacyLink: HTMLAnchorElement;
}

export async function initializeJiraOptions(
  document: Document,
  sendMessage: SendMessage,
  options: JiraOptionsControllerOptions,
): Promise<void> {
  const elements = readElements(document);
  const createRequestId = options.createRequestId ?? (() => crypto.randomUUID());
  elements.privacyLink.href = validatePrivacyUrl(options.privacyUrl);

  elements.connectButton.addEventListener('click', () => {
    void connect(elements, sendMessage, createRequestId);
  });
  elements.disconnectButton.addEventListener('click', () => {
    void disconnect(elements, sendMessage, createRequestId);
  });
  elements.consent.addEventListener('change', () => {
    void saveConsent(elements, sendMessage, createRequestId);
  });

  await loadStatus(elements, sendMessage, createRequestId);
}

async function loadStatus(
  elements: JiraOptionsElements,
  sendMessage: SendMessage,
  createRequestId: () => string,
): Promise<void> {
  setBusy(elements, true);
  const requestId = createRequestId();
  try {
    const response = parseJiraRuntimeResponse(
      await sendMessage({ type: 'JIRA_CONNECTION_STATUS_REQUEST', requestId }),
    );
    if (response === null || response.requestId !== requestId) throw new TypeError();
    if (response.type === 'JIRA_OPERATION_ERROR') {
      setStatus(elements.status, response.error.message, 'error');
      renderConnection(elements, { connected: false, reauthorizationRequired: false, sites: [] });
      return;
    }
    if (response.type !== 'JIRA_CONNECTION_SUCCESS') throw new TypeError();
    renderConnection(elements, response.connection);
    elements.consent.checked = response.consentEnabled;
    if (response.connection.reauthorizationRequired) {
      setStatus(elements.status, 'Jira authorization expired. Reconnect to continue.', 'error');
    } else if (response.connection.connected) {
      setStatus(elements.status, 'Jira connected.', 'success');
    } else {
      setStatus(elements.status, 'Jira is not connected.', 'info');
    }
  } catch {
    renderConnection(elements, { connected: false, reauthorizationRequired: false, sites: [] });
    setStatus(elements.status, 'Could not load Jira connection status.', 'error');
  } finally {
    setBusy(elements, false);
  }
}

async function connect(
  elements: JiraOptionsElements,
  sendMessage: SendMessage,
  createRequestId: () => string,
): Promise<void> {
  setBusy(elements, true);
  setStatus(elements.status, 'Opening Jira authorization…', 'info');
  const requestId = createRequestId();
  try {
    const response = parseJiraRuntimeResponse(
      await sendMessage({ type: 'JIRA_CONNECT_REQUEST', requestId }),
    );
    if (response === null || response.requestId !== requestId) throw new TypeError();
    if (response.type === 'JIRA_OPERATION_ERROR') {
      setStatus(elements.status, response.error.message, 'error');
      return;
    }
    if (response.type !== 'JIRA_CONNECTION_SUCCESS') throw new TypeError();
    renderConnection(elements, response.connection);
    elements.consent.checked = response.consentEnabled;
    setStatus(elements.status, 'Jira connected.', 'success');
  } catch {
    setStatus(elements.status, 'Could not connect Jira. Try again.', 'error');
  } finally {
    setBusy(elements, false);
  }
}

async function disconnect(
  elements: JiraOptionsElements,
  sendMessage: SendMessage,
  createRequestId: () => string,
): Promise<void> {
  setBusy(elements, true);
  const requestId = createRequestId();
  try {
    const response = parseJiraRuntimeResponse(
      await sendMessage({ type: 'JIRA_DISCONNECT_REQUEST', requestId }),
    );
    if (
      response === null ||
      response.requestId !== requestId ||
      response.type !== 'JIRA_DISCONNECT_SUCCESS'
    ) {
      if (response?.type === 'JIRA_OPERATION_ERROR') {
        setStatus(elements.status, response.error.message, 'error');
        return;
      }
      throw new TypeError();
    }
    renderConnection(elements, { connected: false, reauthorizationRequired: false, sites: [] });
    if (response.remoteRevocationConfirmed) {
      setStatus(elements.status, 'Jira disconnected.', 'success');
    } else {
      setStatus(
        elements.status,
        'Jira was disconnected locally, but remote revocation could not be confirmed.',
        'error',
      );
    }
  } catch {
    setStatus(elements.status, 'Could not disconnect Jira. Try again.', 'error');
  } finally {
    setBusy(elements, false);
  }
}

async function saveConsent(
  elements: JiraOptionsElements,
  sendMessage: SendMessage,
  createRequestId: () => string,
): Promise<void> {
  const enabled = elements.consent.checked;
  elements.consent.disabled = true;
  const requestId = createRequestId();
  try {
    const response = parseJiraRuntimeResponse(
      await sendMessage({ type: 'JIRA_CONSENT_SET_REQUEST', requestId, enabled }),
    );
    if (
      response === null ||
      response.requestId !== requestId ||
      response.type !== 'JIRA_CONSENT_SUCCESS'
    ) {
      if (response?.type === 'JIRA_OPERATION_ERROR') {
        setStatus(elements.status, response.error.message, 'error');
        elements.consent.checked = !enabled;
        return;
      }
      throw new TypeError();
    }
    elements.consent.checked = response.enabled;
    setStatus(
      elements.status,
      response.enabled ? 'Jira AI summary sharing enabled.' : 'Jira AI summary sharing disabled.',
      'success',
    );
  } catch {
    elements.consent.checked = !enabled;
    setStatus(elements.status, 'Could not save Jira AI sharing preference.', 'error');
  } finally {
    elements.consent.disabled = false;
  }
}

function renderConnection(elements: JiraOptionsElements, connection: JiraConnectionStatus): void {
  elements.connectButton.hidden = connection.connected;
  elements.connectButton.textContent = connection.reauthorizationRequired
    ? 'Reconnect Jira'
    : 'Connect Jira';
  elements.disconnectButton.hidden = !connection.connected;
  elements.sites.replaceChildren();
  for (const site of connection.sites) {
    const item = document.createElement('li');
    const name = document.createElement('strong');
    name.textContent = site.displayName;
    const host = document.createElement('span');
    host.textContent = site.host;
    item.append(name, host);
    elements.sites.append(item);
  }
}

function setBusy(elements: JiraOptionsElements, busy: boolean): void {
  elements.connectButton.disabled = busy;
  elements.disconnectButton.disabled = busy;
}

function setStatus(
  status: HTMLParagraphElement,
  message: string,
  state: 'info' | 'success' | 'error',
): void {
  status.textContent = message;
  status.dataset.state = state;
}

function validatePrivacyUrl(value: string): string {
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    url.pathname !== '/privacy' ||
    url.search !== '' ||
    url.hash !== ''
  ) {
    throw new TypeError('The Worker privacy URL is invalid.');
  }
  return url.toString();
}

function readElements(document: Document): JiraOptionsElements {
  const connectButton = document.querySelector('#connect-jira');
  const disconnectButton = document.querySelector('#disconnect-jira');
  const status = document.querySelector('#jira-connection-status');
  const sites = document.querySelector('#jira-sites');
  const consent = document.querySelector('#jira-ai-consent');
  const privacyLink = document.querySelector('#jira-privacy-link');
  if (
    !(connectButton instanceof HTMLButtonElement) ||
    !(disconnectButton instanceof HTMLButtonElement) ||
    !(status instanceof HTMLParagraphElement) ||
    !(sites instanceof HTMLUListElement) ||
    !(consent instanceof HTMLInputElement) ||
    !(privacyLink instanceof HTMLAnchorElement)
  ) {
    throw new Error('Jira options markup is incomplete.');
  }
  return { connectButton, disconnectButton, status, sites, consent, privacyLink };
}
