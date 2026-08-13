import { describe, expect, it } from 'vitest';

import {
  parseJiraContextRequest,
  parseJiraContextResponse,
  parseJiraTransitionExecuteRequest,
  parseJiraTransitionExecuteResponse,
  parseJiraTransitionsResponse,
  parseOAuthStartResponse,
  parseWorkerErrorResponse,
} from '../../src/core/worker-api-contracts';

describe('Worker API contracts', () => {
  it('accepts a bounded Jira context request and rejects extra/proxy properties', () => {
    expect(
      parseJiraContextRequest({ siteHost: 'acme.atlassian.net', issueKey: 'CORE-123' }),
    ).toEqual({ siteHost: 'acme.atlassian.net', issueKey: 'CORE-123' });
    expect(
      parseJiraContextRequest({
        siteHost: 'acme.atlassian.net',
        issueKey: 'CORE-123',
        upstreamUrl: 'https://example.test',
      }),
    ).toBeNull();
    expect(
      parseJiraContextRequest({ siteHost: 'atlassian.net.evil.example', issueKey: 'CORE-123' }),
    ).toBeNull();
  });

  it('accepts only minimized Jira context payloads with three bounded comments', () => {
    const context = {
      issueKey: 'CORE-123',
      title: 'Keep the workflow reliable',
      description: 'Bounded plain text',
      issueType: 'Task',
      status: 'In Progress',
      priority: 'High',
      assignee: 'Alex',
      labels: ['extension'],
      comments: ['Newest', 'Second', 'Third'],
    };

    expect(parseJiraContextResponse(context)).toEqual(context);
    expect(
      parseJiraContextResponse({ ...context, comments: [...context.comments, 'Fourth'] }),
    ).toBeNull();
    expect(parseJiraContextResponse({ ...context, authorEmail: 'hidden@example.test' })).toBeNull();
  });

  it('validates normalized transition metadata without accepting raw Jira schemas', () => {
    const response = {
      issueKey: 'CORE-123',
      currentStatus: 'In Progress',
      transitions: [
        {
          id: '31',
          name: 'Done',
          toStatus: 'Done',
          fields: [
            {
              fieldId: 'resolution',
              label: 'Resolution',
              type: 'resolution',
              required: true,
              allowedValues: [{ id: '1', label: 'Done' }],
            },
          ],
          unsupportedRequiredFields: [],
          unsupportedOptionalFields: ['Optional plugin field'],
        },
      ],
    };

    expect(parseJiraTransitionsResponse(response)).toEqual(response);
    expect(parseJiraTransitionsResponse({ ...response, expand: 'transitions.fields' })).toBeNull();
  });

  it('validates a confirmed transition request and rejects unknown or oversized fields', () => {
    const request = {
      siteHost: 'acme.atlassian.net',
      issueKey: 'CORE-123',
      transitionId: '31',
      idempotencyKey: '3e288ae3-bd2c-4c70-ad29-e6b2632c068b',
      values: { resolution: '1', labels: ['one', 'two'], storyPoints: 3 },
      comment: 'Ready to move.',
    };

    expect(parseJiraTransitionExecuteRequest(request)).toEqual(request);
    expect(
      parseJiraTransitionExecuteRequest({ ...request, jiraPath: '/rest/api/3/issue' }),
    ).toBeNull();
    expect(
      parseJiraTransitionExecuteRequest({ ...request, comment: 'x'.repeat(4_001) }),
    ).toBeNull();
  });

  it('parses applied transition results and minimal already-processed replays exactly', () => {
    expect(
      parseJiraTransitionExecuteResponse({
        issueKey: 'CORE-123',
        oldStatus: 'Open',
        newStatus: 'Done',
        applied: true,
      }),
    ).toEqual({
      issueKey: 'CORE-123',
      oldStatus: 'Open',
      newStatus: 'Done',
      applied: true,
    });
    expect(parseJiraTransitionExecuteResponse({ issueKey: 'CORE-123', applied: false })).toEqual({
      issueKey: 'CORE-123',
      applied: false,
    });
    expect(
      parseJiraTransitionExecuteResponse({
        issueKey: 'CORE-123',
        oldStatus: 'Open',
        newStatus: 'Done',
        applied: false,
      }),
    ).toBeNull();
  });

  it('accepts only public structured Worker errors', () => {
    expect(
      parseWorkerErrorResponse({
        error: { code: 'JIRA_RATE_LIMIT', message: 'Jira is rate limiting requests.' },
      }),
    ).toEqual({ error: { code: 'JIRA_RATE_LIMIT', message: 'Jira is rate limiting requests.' } });
    expect(
      parseWorkerErrorResponse({
        error: { code: 'JIRA_UPSTREAM_ERROR', message: 'Unavailable', rawBody: 'secret' },
      }),
    ).toBeNull();
  });

  it('accepts only the exact Atlassian authorization endpoint and expected query contract', () => {
    const valid = new URL('https://auth.atlassian.com/authorize');
    valid.searchParams.set('audience', 'api.atlassian.com');
    valid.searchParams.set('client_id', 'unit-test-client');
    valid.searchParams.set('scope', 'offline_access read:jira-work write:jira-work');
    valid.searchParams.set('redirect_uri', 'https://link-insight.example/oauth/callback');
    valid.searchParams.set('state', 'state-value-that-is-at-least-thirty-two-characters');
    valid.searchParams.set('response_type', 'code');
    valid.searchParams.set('prompt', 'consent');

    expect(
      parseOAuthStartResponse(
        { authorizationUrl: valid.toString() },
        'https://link-insight.example',
      ),
    ).toEqual({
      authorizationUrl: valid.toString(),
    });

    for (const unsafe of [
      new URL(valid.toString().replace('/authorize?', '/unexpected?')),
      new URL(valid.toString().replace('auth.atlassian.com', 'user@auth.atlassian.com')),
      new URL(valid.toString().replace('auth.atlassian.com', 'auth.atlassian.com:444')),
      new URL(`${valid.toString()}#unexpected`),
    ]) {
      expect(
        parseOAuthStartResponse(
          { authorizationUrl: unsafe.toString() },
          'https://link-insight.example',
        ),
      ).toBeNull();
    }

    const attackerCallback = new URL(valid);
    attackerCallback.searchParams.set('redirect_uri', 'https://attacker.example/oauth/callback');
    expect(
      parseOAuthStartResponse(
        { authorizationUrl: attackerCallback.toString() },
        'https://link-insight.example',
      ),
    ).toBeNull();

    const missingResponseType = new URL(valid);
    missingResponseType.searchParams.delete('response_type');
    expect(
      parseOAuthStartResponse(
        { authorizationUrl: missingResponseType.toString() },
        'https://link-insight.example',
      ),
    ).toBeNull();
  });
});
