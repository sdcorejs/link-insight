---
artifact_id: spec-link-insight-jira-oauth-actions-v1-r1
artifact_kind: spec
schema_version: 1
change_ref: link-insight-jira-oauth-actions-v1
source_spec: none
source_plan: none
commit_policy: with-change
owner: sdcorejs-spec
name: jira-oauth-actions
description: Approved security and behavior contract for real Jira summaries and confirmed workflow transitions.
contract_id: link-insight-jira-oauth-actions-v1
requirement_id: req-link-insight-jira-oauth-actions-v1
owner_repository_id: github.com/sdcorejs/link-insight
owner_repository_role: standalone
owner_module_id: none
repository_relative_path: .sdcorejs/specs/fullstack/2026-08-13-07-45-jira-oauth-actions.md
source_revision: 98e2c89e227ca22e1f168fe3e475d15eea898fa9
parent_repository_id: null
parent_references: []
approved_at: 2026-08-13T00:47:50.608Z
approved_by: null
approval_source: explicit-user-choice
track: fullstack
target_root_kind: target-project
stack_profile: node-esm
profile_confidence: high
sourceDraftPath: .sdcorejs/docs/fullstack/2026-08-13-07-30-jira-oauth-actions-spec.md
approval_hash: sha256:v1:69051341a24bcd1bc36f579ebba400184c593c8d3295fa5b248f07b28e8c43f5
approved_spec_hash: sha256:v1:69051341a24bcd1bc36f579ebba400184c593c8d3295fa5b248f07b28e8c43f5
acceptance_criteria_count: 38
manual_criteria_count: 4
redaction_applied: false
supersedes: null
change_control:
  revision: 1
  supersedes: null
  change_reason: null
---

# Jira OAuth Actions - Approved Spec

> Snapshot of what the user approved at the sdcorejs-spec gate. Do not edit by hand; re-author through sdcorejs-spec if the contract changes.

## Approved contract

# Spec - Jira OAuth Actions - 2026-08-13 07:30

```yaml
spec_context:
  source: sdcorejs-spec
  contract_id: link-insight-jira-oauth-actions-v1
  requirement_id: req-link-insight-jira-oauth-actions-v1
  approved_spec_path: null
  approved_spec_hash: null
  supersedes: null
  target_root: C:/Users/Admin/Documents/sdcorejs/sdcorejs-link-insight
  target_root_kind: target-project
  owner_repository_id: github.com/sdcorejs/link-insight
  owner_repository_role: standalone
  owner_module_id: null
  execution_host_repository_id: github.com/sdcorejs/link-insight
  track: fullstack
  stack_profile: node-esm
  profile_confidence: high
  source_requirement_context:
    id: req-link-insight-jira-oauth-actions-v1
    source: sdcorejs-brainstorming
    confirmed_at: 2026-08-13
  acceptance_criteria_count: 38
  manual_criteria_count: 4
  non_goals:
    - Real Confluence authentication or content retrieval
    - Support for every Jira custom field type
    - Account sync, bulk transitions, quick transitions, or Jira service accounts
    - Public Chrome Web Store publishing in this change
  risks:
    - Broad classic Jira write scope
    - OAuth credential compromise or replay
    - Sensitive free-text Jira content being sent to Gemini
    - Stale transition metadata and duplicate writes
    - Callback coupling to the Chrome extension ID and workers.dev origin
  assumptions:
    - The MVP uses one Cloudflare Workers workers.dev origin and one resource-level Atlassian OAuth 2.0 integration.
    - The first live validation uses the stable Unlisted Chrome Web Store extension ID.
    - Existing Gemini BYOK summarization remains in the background service worker.
    - Jira Cloud is the only Jira deployment type in scope.
  redaction_applied: false
  approval:
    approved: false
    approved_at: null
    approval_source: explicit-user-choice
  change_control:
    revision: 1
    supersedes: null
    change_reason: null
```

## Problem & Goals

SdCoreJS Link Insight currently recognizes Jira links in Google Chat but summarizes deterministic mock data and cannot perform Jira actions. Users must open Jira, locate a valid workflow transition, discover required transition-screen fields, enter them, and confirm the change. This interrupts the Google Chat workflow and makes routine status updates unnecessarily slow.

The change adds a secure Jira Cloud integration that acts as the connected Atlassian user. It must retrieve real Jira issue context for Gemini summaries, show only transitions currently permitted for that user, render common required fields, and execute a transition only after an explicit confirmation. OAuth credentials remain in a minimal Cloudflare Workers backend; Gemini remains Bring Your Own Key and is called directly by the trusted extension background.

Success means a user can connect selected Jira sites, hover a supported Jira link for a real three-bullet summary, open a pinned Jira action card, complete supported transition fields, review the exact change, and transition the issue without exposing OAuth or Gemini credentials to the Google Chat page.

## Non-goals

- Real Confluence API access; Confluence continues to use deterministic mock content.
- Jira Server or Jira Data Center support.
- Generic Atlassian REST proxying, Jira administration, issue deletion, bulk transitions, or service-account impersonation.
- Account-level grants, SdCoreJS user accounts, cross-device session sync, or organization-wide credential distribution.
- One-click transitions, configurable confirmation bypass, or background automation of Jira writes.
- Universal Jira field rendering. Assets, cascading selects, Sprint, Team, rich plugin fields, and unsupported custom fields fall back to Jira.
- Sending transition input, attachments, changelog, full URLs, or arbitrary issue fields to Gemini.
- Storing issue content, issue URLs, transition values, Gemini prompts, or AI output in Cloudflare D1.
- Migrating the Worker to a custom domain or publishing a public Chrome Web Store release.

## Architecture

### Trust boundaries

- The Google Chat content script recognizes links, renders the hover UI and action card, and sends discriminated messages. It cannot read `chrome.storage.local`, Gemini keys, Jira session credentials, OAuth codes, or refresh tokens.
- The background service worker revalidates every sender, URL, request ID, message payload, site hostname, issue key, transition ID, and field value before calling a downstream service. It owns the Gemini API key and the opaque Worker session token in `chrome.storage.local` with `TRUSTED_CONTEXTS` access.
- The Cloudflare Worker is the only component that holds `ATLASSIAN_CLIENT_SECRET` and `TOKEN_ENCRYPTION_KEY`. It exposes a fixed allowlist of business operations and never accepts an arbitrary upstream URL, HTTP method, Jira REST path, or raw Jira update payload.
- Atlassian access and refresh tokens never enter the extension. The Worker returns normalized issue data, normalized transition metadata, site connection state, or a structured error; it never returns raw Atlassian responses.
- Real Jira content needed for summaries passes Worker -> trusted background -> Google Gemini only after explicit user consent. It is not exposed to the content script and is not proxied through or retained by the Worker after the Jira response completes.

### OAuth and installation session

The Options Page provides **Connect Jira**, connected-site status, **Disconnect Jira**, and a separate consent control for real Jira AI summaries. Connecting sends a trusted message to the background, which generates a high-entropy verifier and calls `chrome.identity.launchWebAuthFlow` through the Worker OAuth start route.

The Worker accepts only redirect URIs derived from configured Chrome extension IDs. It creates a short-lived, single-use OAuth state bound to the verifier challenge and resource-level Atlassian application. The Atlassian callback is the Worker URL. The Worker exchanges the authorization code with `ATLASSIAN_CLIENT_ID` and `ATLASSIAN_CLIENT_SECRET`, requests `offline_access read:jira-work write:jira-work`, resolves `/oauth/token/accessible-resources`, records only selected Jira sites, and redirects to the `chromiumapp.org` callback with a short-lived one-time exchange code.

The background exchanges that code plus its verifier for a random opaque installation session token. Only the token hash is stored in D1; the raw token is returned once and stored locally in a trusted extension context. OAuth state and exchange-code records expire quickly and are consumed atomically. Replays, mismatched verifiers, unapproved redirect IDs, expired records, and reused codes fail closed.

Refresh tokens are encrypted with versioned AES-GCM material held as a Worker secret. Refresh rotation uses an atomic D1 lease so concurrent requests cannot lose the newest rotating token. Access tokens remain request-scoped and are not persisted. Disconnect deletes the local session token and all associated Worker credentials/site rows. Failed refresh or revoked access invalidates the session. A scheduled Worker job deletes sessions and credentials after 30 days without authenticated activity, plus expired state, exchange-code, lease, and idempotency records.

### Worker API boundary

The Worker exposes only these normalized operation families:

- OAuth start and callback routes.
- One-time installation-session exchange.
- Connection status and connected-site listing.
- Session disconnect.
- `POST /v1/jira/context` with `siteHost` and `issueKey` in the body.
- `POST /v1/jira/transitions/query` with `siteHost` and `issueKey` in the body.
- `POST /v1/jira/transitions/execute` with validated transition input and an idempotency key in the body.
- A public privacy-policy route and a non-sensitive health response.

Issue keys and transition values are not placed in Worker URLs, reducing accidental exposure in edge request logs. CORS accepts only configured `chrome-extension://` origins, while OAuth redirects accept only matching configured `chromiumapp.org` origins. Authenticated routes enforce request size limits, content type, per-installation throttling, exact HTTPS `*.atlassian.net` host validation, the session's hostname-to-`cloudId` binding, and runtime schemas. Production logs contain no secrets, authorization headers, OAuth codes, Jira URLs, issue keys, request bodies, field values, comments, prompts, or raw upstream errors.

### Real Jira summary source

For an authorized Jira site, the Worker retrieves only summary, description, issue type, status, priority, assignee display label, labels, and the three most recent comments. Structured author email/account IDs and author metadata are omitted. Comments are converted from Atlassian Document Format to plain text, obvious email-like values are redacted, links contribute display text but not target URLs, and each comment is capped at 1,000 characters. A centralized total-content cap bounds the description and comment payload.

The background uses a real Jira `ContentFetcher` for Jira issues and retains the mock Atlassian fetcher only for Confluence pages. Jira content is sent to Gemini only when the user has saved a Gemini key and explicitly enabled real Jira AI summaries. The transition form and values are never included. Existing structured-output validation, three-bullet requirement, prompt-injection defenses, timeout, request deduplication, five-minute summary cache, and stale-response protection remain active. A successful transition invalidates the corresponding summary cache immediately.

If Jira is disconnected, the hostname is not among the granted resources, consent is disabled, or reauthorization is required, the hover result gives a specific configuration action instead of falling back to mock Jira data. Confluence behavior remains unchanged.

### Jira action card

After the existing 500 ms dwell, a supported Jira link may show a separate **Jira actions** affordance next to the non-interactive summary popover. The summary popover keeps `pointer-events: none` and still hides synchronously on link mouseout. Moving from the link to the separate affordance does not dismiss that affordance; clicking it opens one reusable, interactive, pinned action card. The card remains open independently of hover, does not block the link's normal navigation, is keyboard accessible, traps focus only while acting as a dialog, closes with its close control or Escape, and never creates duplicate DOM nodes.

The card asks the background for the currently permitted transitions. The Worker calls Jira's transition metadata endpoint with `expand=transitions.fields`, normalizes only fields shown on the transition screen, and returns safe renderer metadata. Supported controls are single-line text, multiline text, number, date, single select, multi-select, user/assignee when allowed values are present, resolution, and plain-text comment. Choices use Atlassian IDs/account IDs internally and display labels in the UI. Unsupported optional fields are omitted with an explanation. If any required field cannot be represented safely, submission is disabled and the card offers an explicit user-initiated link to finish in Jira.

Submitting first shows a confirmation view containing the issue key, current status, destination status, and the exact normalized field values about to be sent. There is no bypass. **Confirm transition** creates one request with a unique idempotency key; the extension does not automatically retry a write. Before calling Jira, the Worker re-fetches transition metadata and validates that the transition is still available, every submitted field belongs to the transition screen, all required supported fields are present, select/user values are allowed, values match size/type limits, and no extra properties exist. It constructs the Jira `fields`/`update` payload itself. A stale workflow or ambiguous network result refreshes the card instead of claiming success.

### Data and storage

D1 contains only opaque installation/session identifiers, session-token hashes, encrypted rotating refresh tokens and crypto metadata, selected `cloudId`/site display metadata, timestamps, short-lived OAuth/exchange records, refresh leases, and short-lived opaque idempotency records. It contains no raw Jira issue content or transition input. Foreign-key cleanup removes all installation-owned records together.

Trusted local storage adds the Worker session token and `jiraGeminiConsent`; neither uses sync storage. The consent defaults to false and is independently reversible without disconnecting Jira. The existing `geminiApiKey` contract is unchanged. The public privacy page and `PRIVACY.md` disclose the Worker, Cloudflare/D1, Atlassian OAuth, direct Gemini transfer, three-comment scope, retention, BYOK limitations, and user controls.

### Permissions and configuration

The extension manifest adds only `identity` and the exact HTTPS Worker origin to the existing `storage` permission and Gemini host permission. It does not add Atlassian host permissions, `activeTab`, `tabs`, `scripting`, cookies, `webRequest`, or wildcard hosts. The concrete Worker origin is injected at build time and validated in the built manifest.

Worker secret values are configured out of band. Source and documentation may name only `ATLASSIAN_CLIENT_ID`, `ATLASSIAN_CLIENT_SECRET`, `TOKEN_ENCRYPTION_KEY`, and `SESSION_HMAC_KEY`. Non-secret configuration includes the exact public Worker origin, allowed extension IDs, D1 binding, retention durations, request limits, and environment name. No credential-like fixture or example value is committed.

## Stack profile and technology assumptions

- Track: `fullstack`.
- Stack profile: `node-esm`.
- Profile evidence: the repository is a TypeScript ESM npm project using WXT, Manifest V3, native DOM APIs, native fetch, Vitest, ESLint, Prettier, and strict TypeScript.
- The Worker uses native Cloudflare Workers APIs, Web Crypto, D1, scheduled events, and `wrangler.jsonc`; no web application framework is required.
- Extension and Worker share runtime-validated API contracts but have independent build/deploy commands. `npm run check` validates both and never deploys.
- Atlassian resource-level OAuth 2.0 configuration and Cloudflare secrets are manual environment prerequisites, not source-controlled configuration.
- The configured Unlisted Chrome Web Store extension ID is the production callback identity. Additional development IDs require an explicit environment allowlist entry; arbitrary callback IDs are never accepted.

## File structure

- `wxt.config.ts` - add `identity` and the validated Worker host permission.
- `entrypoints/background.ts` - register Jira auth/action listeners synchronously at service-worker startup.
- `entrypoints/content.ts` - compose the action affordance/card without weakening hover behavior.
- `entrypoints/options/*` - add Jira connection, connected-site, disconnect, consent, and privacy controls.
- `src/config/runtime-config.ts` - centralize Worker origin, limits, expiry values, and Jira/Gemini content caps.
- `src/core/{contracts,errors,message-contracts}.ts` - extend discriminated extension message and error contracts.
- `src/core/worker-api-contracts.ts` - create shared runtime-validated Worker request/response contracts.
- `src/auth/jira-auth-client.ts` - create the trusted `chrome.identity` orchestration client.
- `src/storage/jira-settings-store.ts` - create trusted local Jira session/consent persistence.
- `src/jira/jira-worker-client.ts` - create the background-only normalized Worker client.
- `src/content-fetchers/jira-content-fetcher.ts` - create real Jira normalized content retrieval.
- `src/content-fetchers/{content-fetcher-registry,mock-atlassian-content-fetcher}.ts` - route Jira to real data and retain Confluence mock behavior.
- `src/background/{summary-message-handler,jira-message-handler}.ts` - enforce sender validation and mediate summary/action requests.
- `src/ui/{hover-controller,popover}.ts` and `src/ui/popover.css` - preserve hover lifecycle while exposing the separate action affordance.
- `src/ui/jira-action-controller.ts` - create action request tokens, stale-response protection, and card lifecycle.
- `src/ui/jira-action-card.ts` and `src/ui/jira-action-card.css` - create accessible field, confirmation, success, and error views using text-safe DOM APIs.
- `worker/wrangler.jsonc` - create Worker, D1, scheduled cleanup, non-secret configuration, and environment bindings.
- `worker/migrations/0001_initial.sql` - create minimal session, grant, site, OAuth, lease, and idempotency tables.
- `worker/src/{index,config,http}.ts` - create routing, CORS, limits, security headers, and structured errors.
- `worker/src/{oauth,session-store,token-crypto}.ts` - create OAuth, session hashing, encryption, rotation lease, expiry, and cleanup behavior.
- `worker/src/{atlassian,jira}.ts` - create the fixed Atlassian client and normalized Jira operations.
- `worker/src/privacy.ts` and `PRIVACY.md` - create aligned public and repository privacy disclosures.
- `tests/{auth,background,jira,storage,ui,security}/**` - add or extend extension TDD coverage.
- `worker/test/**` - create Worker contract, OAuth, crypto/session, Jira, privacy, and route tests with mocked upstream fetch.
- `package.json`, `package-lock.json`, `tsconfig.json`, `vitest.config.ts`, `scripts/validate-manifest.mjs`, and `README.md` - integrate Worker development/validation and document setup without deploying from `check`.

Projected implementation surface: 25 files created and 20 files edited; the plan may consolidate files while preserving every responsibility and contract above.

## Acceptance criteria

- AC-001 - Options Page displays Connect Jira, connection status, selected Jira sites, Disconnect Jira, AI-summary consent, and a public privacy-policy link with accessible status feedback.
- AC-002 - Jira AI-summary consent defaults to off, can be enabled only through an explicit user action, and can be disabled without disconnecting Jira or disabling Jira Actions.
- AC-003 - `chrome.identity.launchWebAuthFlow` is initiated only by a trusted extension context after a user clicks Connect Jira.
- AC-004 - OAuth state, verifier challenge, redirect URI, and one-time exchange code are runtime-validated, short-lived, single-use, and reject mismatch, expiry, replay, or unapproved extension IDs.
- AC-005 - The Worker exchanges Atlassian authorization codes using resource-level 3LO and exactly `offline_access read:jira-work write:jira-work`.
- AC-006 - Atlassian client secret, encryption/HMAC keys, access tokens, and refresh tokens never appear in extension source, storage, messages, logs, fixtures, URLs, or responses.
- AC-007 - The raw installation session token is returned once, stored only in trusted local extension storage, represented only by a hash in D1, and is never readable by content-script code.
- AC-008 - Refresh tokens are versioned AES-GCM ciphertext in D1; concurrent refreshes use an expiring atomic lease and persist the newest rotating token safely.
- AC-009 - Disconnect deletes trusted local Jira session state and associated Worker grant/site/session records; revoked or unusable refresh credentials force a reauthorization state.
- AC-010 - Automated expiry tests prove sessions are rejected and purged after 30 days without authenticated activity, with expired transient records purged separately.
- AC-011 - A session can access only a normalized hostname whose exact `cloudId` mapping came from that session's accessible resources; fake, HTTP, credential-bearing, dotted-subtenant, and ungranted hosts are rejected.
- AC-012 - Worker authenticated APIs expose only connection status, site listing, disconnect, Jira context, transition query, and transition execution; no generic proxy or issue-delete path exists.
- AC-013 - Worker CORS, redirect validation, body limits, content type, rate limits, and schemas fail closed for unapproved origins, methods, bodies, and extra properties.
- AC-014 - Jira issue keys and field values travel in bounded request bodies rather than Worker URLs, and production application logs contain none of the prohibited data listed in the spec.
- AC-015 - The Jira context response contains only the approved issue fields and at most three newest comments; each comment is plain text capped at 1,000 characters without author metadata, structured account IDs, attachment data, or link targets.
- AC-016 - Obvious email-like strings are redacted and a centralized total-content limit prevents an oversized Jira/Gemini payload.
- AC-017 - Without Jira connection, site authorization, Gemini key, or AI consent, Jira hover returns the correct actionable error and never substitutes mock Jira content or sends issue data to Gemini.
- AC-018 - With connection, site authorization, Gemini key, and consent, Jira hover uses real normalized Jira content and renders exactly three validated Gemini bullets after the existing 500 ms dwell.
- AC-019 - Jira description/comments are treated as untrusted prompt data; instructions inside them cannot alter the requested three-bullet, same-language, data-only response contract.
- AC-020 - Confluence recognition and deterministic mock summarization remain behaviorally unchanged.
- AC-021 - Mouseout, stale-response, link-switch, request deduplication, five-minute caching, and single-popover guarantees continue to pass existing and regression tests.
- AC-022 - A separate Jira actions affordance is reachable from the hovered Jira link without making the summary popover interactive or preventing normal link navigation.
- AC-023 - Moving from the link to the action affordance does not close it, while the summary popover still hides synchronously when the link is left.
- AC-024 - Clicking Jira actions opens exactly one reusable, pinned, keyboard-accessible card that remains independent of hover and closes by its close control or Escape.
- AC-025 - Transition options come from the current user's Jira permissions using `expand=transitions.fields`; missing Transition Issues permission produces a structured, actionable error.
- AC-026 - The card correctly renders and validates text, textarea, number, date, allowed single/multi-select, allowed user/assignee, resolution, and plain-text comment fields without `innerHTML`.
- AC-027 - An unsupported required field prevents execution and offers a user-initiated canonical Jira link; unsupported optional fields do not create an invalid payload.
- AC-028 - Every transition presents a confirmation view showing issue key, old status, destination status, and exact submitted values, and no code path bypasses Confirm transition.
- AC-029 - The Worker re-fetches transition metadata immediately before writing and rejects stale/unavailable transitions, missing required values, disallowed choices, wrong types, oversize values, and fields absent from the transition screen.
- AC-030 - Transition execution uses a unique idempotency key, has no automatic client retry, stores no transition input, and handles replay or ambiguous outcomes by refreshing issue state instead of claiming duplicate success.
- AC-031 - A successful transition displays the new status, invalidates that canonical URL's summary cache, and a subsequent summary/action request observes refreshed Jira data.
- AC-032 - All extension/Worker errors are normalized; 400/401/403/404/409/422/429, token expiry, timeout, network failure, Atlassian 5xx, malformed JSON, and invalid schemas never expose raw upstream bodies or credentials.
- AC-033 - Built manifest validation proves the only permissions are `storage` and `identity`, with exact Gemini and Worker host permissions and no Atlassian or wildcard host permission.
- AC-034 - TDD coverage includes OAuth replay/expiry, crypto/session rotation, 30-day cleanup, site binding, API allowlist, context minimization, transition normalization/validation, confirmation, stale UI responses, cache invalidation, security source boundaries, and error mapping; `npm run check` passes extension and Worker validation without deploying.
- AC-035 [Manual] - A deployed workers.dev instance and Unlisted Chrome installation complete the full Atlassian callback and one-time session exchange without exposing credentials to the extension page.
- AC-036 [Manual] - Resource-level consent lists only the Jira sites selected by the user, and an unselected tenant is rejected.
- AC-037 [Manual] - On a test Jira issue and valid user-supplied Gemini key, real Jira content produces a summary only after AI consent is enabled.
- AC-038 [Manual] - A transition with supported required fields is confirmed once, succeeds under the connected Jira user's audit identity, and Disconnect makes subsequent Jira actions require reconnection.

## Risks & mitigations

- **Risk:** `write:jira-work` is broader than the single desired write. -> **Mitigation:** The Worker contains no arbitrary proxy and constructs only transition requests after fresh metadata validation; destructive Jira routes do not exist.
- **Risk:** A leaked refresh/session credential enables Jira access. -> **Mitigation:** Worker-only OAuth secrets, AES-GCM refresh-token encryption, hash-only installation sessions, trusted extension storage, origin/redirect allowlists, rotation leases, throttling, and 30-day inactivity deletion limit exposure.
- **Risk:** Free-text descriptions/comments can include confidential or personal data. -> **Mitigation:** Explicit default-off consent, minimum field selection, author-metadata omission, redaction, per-comment/total caps, no persistence, direct BYOK Gemini transfer, and clear privacy disclosure.
- **Risk:** Prompt injection in Jira content manipulates Gemini. -> **Mitigation:** Preserve the existing untrusted-data prompt boundary and structured response validator; never render model output as HTML.
- **Risk:** Workflow metadata becomes stale between form load and submit. -> **Mitigation:** Re-fetch and revalidate transitions server-side immediately before the write; return a stale-state response and refresh the card.
- **Risk:** Network retry duplicates a transition/comment. -> **Mitigation:** No automatic write retry, unique idempotency keys, short-lived consumed records, and post-error state reconciliation.
- **Risk:** Unsupported custom fields make a transition impossible in-extension. -> **Mitigation:** Fail closed and offer an explicit canonical Jira fallback instead of sending partial or guessed values.
- **Risk:** workers.dev origin or Chrome extension ID changes. -> **Mitigation:** Centralized environment configuration, exact build validation, explicit callback allowlists, and a new OAuth/Web Store review when production identity changes.
- **Risk:** Cloudflare, Atlassian, or Gemini is unavailable or rate-limited. -> **Mitigation:** Bounded timeouts, normalized retry guidance for reads, no automatic retry for writes, and preserved direct-open Jira fallback.

## Out of scope (deferred)

- Real Confluence fetching and permissions - defer until Confluence OAuth/data contracts are separately approved.
- Advanced/plugin Jira field renderers - defer until actual transition metadata from target tenants identifies supported demand.
- Quick transitions or configurable confirmation bypass - defer until successful audited usage demonstrates a safe allowlist model.
- Account-level Atlassian grants, SdCoreJS accounts, and cross-device sessions - defer until multi-device identity is a product requirement.
- Custom production domain and separate development OAuth application - defer until the Unlisted workers.dev MVP is validated.
- Public Chrome Web Store release - defer until privacy disclosure, live OAuth/Jira evidence, listing assets, and review readiness pass a separate shipping gate.
- GitLab actions, Jira bulk actions, telemetry, enterprise key distribution, and backend-hosted Gemini - remain outside this feature.

## Decisions captured during review

- Approved as drafted.

## Skill provenance

sdcorejs-spec (approved on attempt 1 / 3)
