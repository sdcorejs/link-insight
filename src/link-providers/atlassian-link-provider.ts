import type { LinkResource } from '../core/contracts';
import type { LinkProvider } from './link-provider';

const ATLASSIAN_SUFFIX = '.atlassian.net';
const JIRA_ISSUE_KEY = /^[A-Z][A-Z0-9_]*-\d+$/u;
const TENANT_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u;

export class AtlassianLinkProvider implements LinkProvider {
  readonly id = 'atlassian';

  resolve(input: string | URL): LinkResource | null {
    const url = parseUrl(input);
    if (url === null || !isSupportedOrigin(url)) {
      return null;
    }

    const tenant = url.hostname.slice(0, -ATLASSIAN_SUFFIX.length);
    return resolveJira(url, tenant) ?? resolveConfluence(url, tenant);
  }
}

function parseUrl(input: string | URL): URL | null {
  try {
    return new URL(input.toString());
  } catch {
    return null;
  }
}

function isSupportedOrigin(url: URL): boolean {
  if (url.protocol !== 'https:' || url.port !== '' || url.username !== '' || url.password !== '') {
    return false;
  }

  const hostname = url.hostname.toLowerCase();
  if (!hostname.endsWith(ATLASSIAN_SUFFIX)) {
    return false;
  }

  const tenant = hostname.slice(0, -ATLASSIAN_SUFFIX.length);
  return TENANT_LABEL.test(tenant) && !tenant.includes('.');
}

function resolveJira(url: URL, tenant: string): LinkResource | null {
  const segments = pathSegments(url.pathname);
  if (segments.length !== 2 || segments[0] !== 'browse') {
    return null;
  }

  const issueKey = decodeSegment(segments[1])?.toUpperCase();
  if (issueKey === undefined || !JIRA_ISSUE_KEY.test(issueKey)) {
    return null;
  }

  return {
    providerId: 'atlassian',
    resourceType: 'jira-issue',
    canonicalUrl: `https://${url.hostname.toLowerCase()}/browse/${encodeURIComponent(issueKey)}`,
    tenant,
    identifier: issueKey,
    metadata: {
      issueKey,
    },
  };
}

function resolveConfluence(url: URL, tenant: string): LinkResource | null {
  const segments = pathSegments(url.pathname);
  if (segments[0] !== 'wiki' || segments.length < 2) {
    return null;
  }

  if (
    segments[1] === 'spaces' &&
    segments[3] === 'pages' &&
    segments[2] !== undefined &&
    segments[4] !== undefined
  ) {
    const spaceKey = decodeSegment(segments[2]);
    const pageId = decodeSegment(segments[4]);
    if (spaceKey === null || pageId === null || !/^\d+$/u.test(pageId)) {
      return null;
    }

    const slug = segments[5] === undefined ? '' : (decodeSegment(segments[5]) ?? '');
    return {
      providerId: 'atlassian',
      resourceType: 'confluence-page',
      canonicalUrl: `https://${url.hostname.toLowerCase()}/wiki/spaces/${encodeURIComponent(spaceKey)}/pages/${encodeURIComponent(pageId)}`,
      tenant,
      identifier: pageId,
      metadata: {
        pageId,
        spaceKey,
        slug,
      },
    };
  }

  const identifier = decodeSegment(segments.at(-1));
  if (identifier === null || identifier.trim() === '') {
    return null;
  }

  const canonicalPath = `/${segments.join('/')}`;
  return {
    providerId: 'atlassian',
    resourceType: 'confluence-page',
    canonicalUrl: `https://${url.hostname.toLowerCase()}${canonicalPath}`,
    tenant,
    identifier,
    metadata: {
      slug: identifier,
    },
  };
}

function pathSegments(pathname: string): string[] {
  return pathname.split('/').filter((segment) => segment !== '');
}

function decodeSegment(segment: string | undefined): string | null {
  if (segment === undefined) {
    return null;
  }

  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}
