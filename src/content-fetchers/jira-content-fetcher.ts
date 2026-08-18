import type { JiraIssueContext, LinkResource, NormalizedLinkContent } from '../core/contracts';
import { LinkInsightError } from '../core/errors';
import type { JiraContextRequest } from '../core/worker-api-contracts';
import type { ContentFetcher } from './content-fetcher';

interface JiraContentSettings {
  loadSessionToken(): Promise<string | null>;
  loadSelectedSiteHosts(): Promise<readonly string[]>;
  loadAiConsent(): Promise<boolean>;
  loadApiKey(): Promise<string | null>;
}

interface JiraContextGateway {
  getContext(sessionToken: string, input: JiraContextRequest): Promise<JiraIssueContext>;
}

interface JiraContentFetcherDependencies {
  readonly settings: JiraContentSettings;
  readonly worker: JiraContextGateway;
}

export class JiraContentFetcher implements ContentFetcher {
  constructor(private readonly dependencies: JiraContentFetcherDependencies) {}

  supports(resource: LinkResource): boolean {
    return resource.providerId === 'atlassian' && resource.resourceType === 'jira-issue';
  }

  async fetch(resource: LinkResource): Promise<NormalizedLinkContent> {
    if (!this.supports(resource)) {
      throw new LinkInsightError('CONTENT_FETCH_FAILED', 'This content source is not supported.');
    }
    const sessionToken = await this.dependencies.settings.loadSessionToken();
    if (sessionToken === null) {
      throw new LinkInsightError('JIRA_NOT_CONNECTED', 'Connect Jira in the extension options.');
    }
    const siteHost = new URL(resource.canonicalUrl).hostname;
    const selectedSites = await this.dependencies.settings.loadSelectedSiteHosts();
    if (!selectedSites.includes(siteHost)) {
      throw new LinkInsightError(
        'JIRA_SITE_NOT_AUTHORIZED',
        'Connect this Jira site in the extension options.',
      );
    }
    if ((await this.dependencies.settings.loadApiKey()) === null) {
      throw new LinkInsightError(
        'MISSING_API_KEY',
        'Set your Gemini API key in the extension options.',
      );
    }
    if (!(await this.dependencies.settings.loadAiConsent())) {
      throw new LinkInsightError(
        'JIRA_AI_CONSENT_REQUIRED',
        'Enable Jira content sharing for AI summaries in the extension options.',
      );
    }
    const context = await this.dependencies.worker.getContext(sessionToken, {
      siteHost,
      issueKey: resource.identifier,
    });
    return normalizeContext(context, resource);
  }
}

function normalizeContext(
  context: JiraIssueContext,
  resource: LinkResource,
): NormalizedLinkContent {
  const comments = context.comments.slice(0, 3);
  const body = [
    context.description,
    comments.length === 0
      ? ''
      : `Recent comments:\n${comments.map((comment) => `- ${comment}`).join('\n')}`,
  ]
    .filter((section) => section !== '')
    .join('\n\n');
  return {
    providerId: resource.providerId,
    resourceType: resource.resourceType,
    identifier: context.issueKey,
    title: context.title,
    body,
    attributes: {
      issueType: context.issueType,
      status: context.status,
      ...(context.priority === null ? {} : { priority: context.priority }),
      ...(context.assignee === null ? {} : { assignee: context.assignee }),
      labels: context.labels.join(', '),
    },
  };
}
