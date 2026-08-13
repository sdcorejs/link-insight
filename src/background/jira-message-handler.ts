import type {
  JiraConnectionStatus,
  JiraTransitionExecuteResult,
  JiraTransitionsResult,
} from '../core/contracts';
import { isLinkInsightError, LinkInsightError } from '../core/errors';
import {
  isJiraRuntimeRequest,
  type JiraRuntimeRequest,
  type JiraRuntimeResponse,
} from '../core/message-contracts';
import type {
  JiraContextRequest,
  JiraTransitionExecuteRequest,
} from '../core/worker-api-contracts';
import type { LinkProviderRegistry } from '../link-providers/link-provider-registry';
import type { MessageSenderLike } from './summary-message-handler';

interface JiraAuthGateway {
  connect(): Promise<JiraConnectionStatus>;
}

interface JiraWorkerGateway {
  getConnection(sessionToken: string): Promise<JiraConnectionStatus>;
  disconnect(sessionToken: string): Promise<void>;
  getTransitions(sessionToken: string, input: JiraContextRequest): Promise<JiraTransitionsResult>;
  executeTransition(
    sessionToken: string,
    input: JiraTransitionExecuteRequest,
  ): Promise<JiraTransitionExecuteResult>;
}

interface JiraSettingsGateway {
  loadSessionToken(): Promise<string | null>;
  clearConnection(): Promise<void>;
  loadAiConsent(): Promise<boolean>;
  saveAiConsent(enabled: boolean): Promise<void>;
  loadSelectedSiteHosts(): Promise<readonly string[]>;
}

interface JiraMessageDependencies {
  readonly extensionId: string;
  readonly auth: JiraAuthGateway;
  readonly worker: JiraWorkerGateway;
  readonly settings: JiraSettingsGateway;
  readonly providers: LinkProviderRegistry;
  readonly invalidateSummary: (canonicalUrl: string) => Promise<void>;
}

export type JiraMessageSenderLike = MessageSenderLike & { readonly documentUrl?: string };

export type JiraMessageListener = (
  message: unknown,
  sender: JiraMessageSenderLike,
  sendResponse: (response: JiraRuntimeResponse) => void,
) => boolean;

export function createJiraMessageListener(
  dependencies: JiraMessageDependencies,
): JiraMessageListener {
  return (message, sender, sendResponse): boolean => {
    if (!isJiraRuntimeRequest(message)) {
      return false;
    }
    void processRequest(message, sender, dependencies).then(sendResponse);
    return true;
  };
}

async function processRequest(
  request: JiraRuntimeRequest,
  sender: JiraMessageSenderLike,
  dependencies: JiraMessageDependencies,
): Promise<JiraRuntimeResponse> {
  try {
    if (isOptionsOperation(request)) {
      requireOptionsSender(sender, dependencies.extensionId);
    } else {
      requireGoogleChatSender(sender, dependencies.extensionId);
    }

    if (request.type === 'JIRA_CONNECT_REQUEST') {
      const connection = await dependencies.auth.connect();
      return connectionResponse(
        request.requestId,
        connection,
        await dependencies.settings.loadAiConsent(),
      );
    }
    if (request.type === 'JIRA_CONNECTION_STATUS_REQUEST') {
      const sessionToken = await dependencies.settings.loadSessionToken();
      const connection =
        sessionToken === null
          ? { connected: false, reauthorizationRequired: false, sites: [] }
          : await dependencies.worker.getConnection(sessionToken);
      return connectionResponse(
        request.requestId,
        connection,
        await dependencies.settings.loadAiConsent(),
      );
    }
    if (request.type === 'JIRA_DISCONNECT_REQUEST') {
      const sessionToken = await dependencies.settings.loadSessionToken();
      let remoteRevocationConfirmed = true;
      if (sessionToken !== null) {
        try {
          await dependencies.worker.disconnect(sessionToken);
        } catch {
          remoteRevocationConfirmed = false;
        }
      }
      await dependencies.settings.clearConnection();
      return {
        type: 'JIRA_DISCONNECT_SUCCESS',
        requestId: request.requestId,
        remoteRevocationConfirmed,
      };
    }
    if (request.type === 'JIRA_CONSENT_SET_REQUEST') {
      await dependencies.settings.saveAiConsent(request.enabled);
      return {
        type: 'JIRA_CONSENT_SUCCESS',
        requestId: request.requestId,
        enabled: request.enabled,
      };
    }

    const resource = dependencies.providers.resolve(request.url);
    if (resource === null || resource.resourceType !== 'jira-issue') {
      throw new LinkInsightError('UNSUPPORTED_LINK', 'This Jira link is not supported.');
    }
    const siteHost = new URL(resource.canonicalUrl).hostname;
    const selectedSites = await dependencies.settings.loadSelectedSiteHosts();
    if (!selectedSites.includes(siteHost)) {
      throw new LinkInsightError(
        'JIRA_SITE_NOT_AUTHORIZED',
        'Connect this Jira site in the extension options.',
      );
    }
    const sessionToken = await dependencies.settings.loadSessionToken();
    if (sessionToken === null) {
      throw new LinkInsightError('JIRA_NOT_CONNECTED', 'Connect Jira in the extension options.');
    }

    if (request.type === 'JIRA_TRANSITIONS_REQUEST') {
      return {
        type: 'JIRA_TRANSITIONS_SUCCESS',
        requestId: request.requestId,
        result: await dependencies.worker.getTransitions(sessionToken, {
          siteHost,
          issueKey: resource.identifier,
        }),
      };
    }
    const result = await dependencies.worker.executeTransition(sessionToken, {
      siteHost,
      issueKey: resource.identifier,
      transitionId: request.transitionId,
      idempotencyKey: request.idempotencyKey,
      values: request.values,
      ...(request.comment === undefined ? {} : { comment: request.comment }),
    });
    await dependencies.invalidateSummary(resource.canonicalUrl);
    return {
      type: 'JIRA_TRANSITION_EXECUTE_SUCCESS',
      requestId: request.requestId,
      result,
    };
  } catch (error) {
    const normalized = isLinkInsightError(error)
      ? error
      : new LinkInsightError('INTERNAL_ERROR', 'Unable to complete the Jira operation.');
    return {
      type: 'JIRA_OPERATION_ERROR',
      requestId: request.requestId,
      error: { code: normalized.code, message: normalized.message },
    };
  }
}

function connectionResponse(
  requestId: string,
  connection: JiraConnectionStatus,
  consentEnabled: boolean,
): JiraRuntimeResponse {
  return {
    type: 'JIRA_CONNECTION_SUCCESS',
    requestId,
    connection,
    consentEnabled,
  };
}

function isOptionsOperation(request: JiraRuntimeRequest): boolean {
  return (
    request.type === 'JIRA_CONNECT_REQUEST' ||
    request.type === 'JIRA_CONNECTION_STATUS_REQUEST' ||
    request.type === 'JIRA_DISCONNECT_REQUEST' ||
    request.type === 'JIRA_CONSENT_SET_REQUEST'
  );
}

function requireOptionsSender(sender: JiraMessageSenderLike, extensionId: string): void {
  if (
    sender.id !== extensionId ||
    (sender.frameId !== undefined && sender.frameId !== 0) ||
    sender.documentUrl === undefined
  ) {
    throw unauthorized();
  }
  try {
    const url = new URL(sender.documentUrl);
    if (
      url.protocol !== 'chrome-extension:' ||
      url.hostname !== extensionId ||
      url.pathname !== '/options.html'
    ) {
      throw unauthorized();
    }
  } catch {
    throw unauthorized();
  }
}

function requireGoogleChatSender(sender: JiraMessageSenderLike, extensionId: string): void {
  if (sender.id !== extensionId || sender.frameId !== 0 || sender.tabUrl === undefined) {
    throw unauthorized();
  }
  try {
    const url = new URL(sender.tabUrl);
    if (
      url.protocol !== 'https:' ||
      (url.hostname !== 'chat.google.com' &&
        !(url.hostname === 'mail.google.com' && url.pathname.startsWith('/chat/')))
    ) {
      throw unauthorized();
    }
  } catch {
    throw unauthorized();
  }
}

function unauthorized(): LinkInsightError {
  return new LinkInsightError('UNAUTHORIZED_SENDER', 'This Jira request is not allowed.');
}
