import {
  parseJiraContextRequest,
  parseJiraTransitionExecuteRequest,
  parseOAuthExchangeRequest,
  parseOAuthStartRequest,
  WORKER_API_PATHS,
} from '../../src/core/worker-api-contracts';
import { createAtlassianTransport, resolveGrantedSite } from './atlassian';
import { readWorkerConfig, type WorkerConfig, type WorkerEnv } from './config';
import {
  buildCorsHeaders,
  errorResponse,
  jsonResponse,
  readJsonBody,
  requireAllowedOrigin,
  requireBearerToken,
  WorkerHttpError,
} from './http';
import { executeJiraWriteWithIdempotency } from './idempotency';
import { exchangeInstallationSession, handleOAuthCallback, startOAuth } from './oauth';
import { createHealthResponse, createPrivacyResponse } from './privacy';
import { SessionStore } from './session-store';
import {
  buildTransitionPayload,
  executeJiraTransition,
  loadJiraContext,
  loadJiraTransitions,
} from './jira';
import { hashOpaqueToken } from './token-crypto';

const worker = {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    let config;
    try {
      config = readWorkerConfig(env);
    } catch {
      return errorResponse(
        new WorkerHttpError(500, 'INTERNAL_ERROR', 'The service is not configured.'),
      );
    }
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === WORKER_API_PATHS.health) {
      return createHealthResponse();
    }
    if (request.method === 'GET' && url.pathname === WORKER_API_PATHS.privacy) {
      return createPrivacyResponse();
    }
    if (request.method === 'GET' && url.pathname === '/oauth/callback') {
      try {
        return await handleOAuthCallback(request, env, config);
      } catch (error) {
        return errorResponse(error);
      }
    }

    const corsHeaders = buildCorsHeaders(request.headers.get('Origin'), config.allowedExtensionIds);
    try {
      requireAllowedOrigin(request, config.allowedExtensionIds);
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
      }
      if (request.method === 'POST' && url.pathname === WORKER_API_PATHS.oauthStart) {
        const input = parseOAuthStartRequest(await readJsonBody(request, config.maxRequestBytes));
        if (input === null) {
          throw new WorkerHttpError(400, 'INVALID_REQUEST', 'The OAuth start request is invalid.');
        }
        return jsonResponse(await startOAuth(input, env, config), 200, corsHeaders);
      }
      if (request.method === 'POST' && url.pathname === WORKER_API_PATHS.oauthExchange) {
        const input = parseOAuthExchangeRequest(
          await readJsonBody(request, config.maxRequestBytes),
        );
        if (input === null) {
          throw new WorkerHttpError(
            400,
            'INVALID_REQUEST',
            'The OAuth exchange request is invalid.',
          );
        }
        return jsonResponse(
          await exchangeInstallationSession(input, env, config),
          200,
          corsHeaders,
        );
      }
      if (request.method === 'GET' && url.pathname === WORKER_API_PATHS.connection) {
        const session = await authenticatedSession(request, env, config);
        return jsonResponse(
          {
            connected: true,
            reauthorizationRequired: false,
            sites: session.sites.map(({ host, displayName }) => ({ host, displayName })),
          },
          200,
          corsHeaders,
        );
      }
      if (request.method === 'POST' && url.pathname === WORKER_API_PATHS.disconnect) {
        const rawToken = requireBearerToken(request);
        const removed = await new SessionStore(env.DB, {
          sessionIdleTtlSeconds: config.sessionIdleTtlSeconds,
        }).disconnect(await hashOpaqueToken(rawToken, config.sessionHmacKey));
        if (!removed) {
          throw new WorkerHttpError(401, 'UNAUTHORIZED_SESSION', 'Connect Jira again to continue.');
        }
        return new Response(null, { status: 204, headers: corsHeaders });
      }
      if (request.method === 'POST' && url.pathname === WORKER_API_PATHS.jiraContext) {
        const input = parseJiraContextRequest(await readJsonBody(request, config.maxRequestBytes));
        if (input === null) {
          throw new WorkerHttpError(400, 'INVALID_REQUEST', 'The Jira context request is invalid.');
        }
        const session = await authenticatedSession(request, env, config);
        const site = resolveGrantedSite(session, input.siteHost);
        const transport = await createAtlassianTransport(session, site, env, config);
        return jsonResponse(await loadJiraContext(transport, input.issueKey), 200, corsHeaders);
      }
      if (request.method === 'POST' && url.pathname === WORKER_API_PATHS.jiraTransitionsQuery) {
        const input = parseJiraContextRequest(await readJsonBody(request, config.maxRequestBytes));
        if (input === null) {
          throw new WorkerHttpError(
            400,
            'INVALID_REQUEST',
            'The Jira transition request is invalid.',
          );
        }
        const session = await authenticatedSession(request, env, config);
        const site = resolveGrantedSite(session, input.siteHost);
        const transport = await createAtlassianTransport(session, site, env, config);
        const context = await loadJiraContext(transport, input.issueKey);
        return jsonResponse(
          await loadJiraTransitions(transport, input.issueKey, context.status),
          200,
          corsHeaders,
        );
      }
      if (request.method === 'POST' && url.pathname === WORKER_API_PATHS.jiraTransitionsExecute) {
        const input = parseJiraTransitionExecuteRequest(
          await readJsonBody(request, config.maxRequestBytes),
        );
        if (input === null) {
          throw new WorkerHttpError(
            400,
            'INVALID_REQUEST',
            'The Jira transition request is invalid.',
          );
        }
        const session = await authenticatedSession(request, env, config);
        const site = resolveGrantedSite(session, input.siteHost);
        const store = new SessionStore(env.DB, {
          sessionIdleTtlSeconds: config.sessionIdleTtlSeconds,
        });
        const keyHash = await hashOpaqueToken(input.idempotencyKey, config.sessionHmacKey);
        const operationHash = await hashOpaqueToken(
          stableJson({
            siteHost: input.siteHost,
            issueKey: input.issueKey,
            transitionId: input.transitionId,
            values: input.values,
            comment: input.comment ?? null,
          }),
          config.sessionHmacKey,
        );
        const claim = await store.claimIdempotency(
          session.installationId,
          keyHash,
          operationHash,
          Math.floor(Date.now() / 1_000) + 24 * 60 * 60,
        );
        if (claim.state === 'conflict') {
          throw new WorkerHttpError(409, 'INVALID_REQUEST', 'This action key was already used.');
        }
        if (claim.state === 'pending' || claim.state === 'ambiguous') {
          throw new WorkerHttpError(
            409,
            'AMBIGUOUS_WRITE_OUTCOME',
            'Jira may have applied the transition. Refresh before trying again.',
          );
        }
        if (claim.state === 'applied') {
          return jsonResponse({ issueKey: input.issueKey, applied: false }, 200, corsHeaders);
        }

        const prepared = await (async () => {
          const transport = await createAtlassianTransport(session, site, env, config);
          const context = await loadJiraContext(transport, input.issueKey);
          const transitions = await loadJiraTransitions(transport, input.issueKey, context.status);
          const transition = transitions.transitions.find(
            (candidate) => candidate.id === input.transitionId,
          );
          if (transition === undefined) {
            throw new WorkerHttpError(
              409,
              'JIRA_TRANSITION_STALE',
              'The Jira transition changed. Refresh and try again.',
            );
          }
          return {
            transport,
            payload: buildTransitionPayload(transition, input.values, input.comment),
            oldStatus: context.status,
            newStatus: transition.toStatus,
          };
        })().catch(async (error: unknown) => {
          await store.abandonIdempotency(session.installationId, keyHash);
          throw error;
        });

        await executeJiraWriteWithIdempotency({
          execute: () =>
            executeJiraTransition(prepared.transport, input.issueKey, prepared.payload),
          complete: (outcome) =>
            store.completeIdempotency(session.installationId, keyHash, outcome),
          abandon: () => store.abandonIdempotency(session.installationId, keyHash),
        });
        return jsonResponse(
          {
            issueKey: input.issueKey,
            oldStatus: prepared.oldStatus,
            newStatus: prepared.newStatus,
            applied: true,
          },
          200,
          corsHeaders,
        );
      }
      throw new WorkerHttpError(404, 'INVALID_REQUEST', 'This operation is not available.');
    } catch (error) {
      return errorResponse(error, corsHeaders);
    }
  },

  async scheduled(_controller: ScheduledController, env: WorkerEnv): Promise<void> {
    const config = readWorkerConfig(env);
    await new SessionStore(env.DB, {
      sessionIdleTtlSeconds: config.sessionIdleTtlSeconds,
    }).cleanupExpired();
  },
};

async function authenticatedSession(request: Request, env: WorkerEnv, config: WorkerConfig) {
  const store = new SessionStore(env.DB, {
    sessionIdleTtlSeconds: config.sessionIdleTtlSeconds,
  });
  const session = await store.loadSession(
    await hashOpaqueToken(requireBearerToken(request), config.sessionHmacKey),
  );
  if (session === null) {
    throw new WorkerHttpError(401, 'SESSION_EXPIRED', 'Connect Jira again to continue.');
  }
  if (
    !(await store.consumeRateLimit(
      session.installationId,
      config.authenticatedRequestLimit,
      config.rateLimitWindowSeconds,
    ))
  ) {
    throw new WorkerHttpError(429, 'JIRA_RATE_LIMIT', 'Too many Jira requests. Try again later.');
  }
  return session;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(',')}]`;
  }
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
      left.localeCompare(right),
    );
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export default worker;
