# SdCoreJS Link Insight

SdCoreJS Link Insight is a Chrome Manifest V3 extension for Google Chat. After a 500 ms hover over a supported link, it shows a three-bullet Gemini summary. Jira Cloud links can use real issue data through Atlassian OAuth and expose a separate, confirmed workflow-transition card. Confluence links continue to use deterministic mock content.

Gemini remains Bring Your Own Key (BYOK). The key is stored only in trusted local extension storage and Gemini is called by the background service worker. Atlassian OAuth credentials stay in a minimal Cloudflare Worker backed by D1; Atlassian tokens never enter the extension.

## Architecture

```text
Google Chat content script
  ├─ provider-neutral link recognition
  ├─ non-interactive AI-summary popover
  └─ separate Jira actions trigger + pinned confirmation dialog
        │ discriminated extension messages
        ▼
Trusted MV3 background service worker
  ├─ sender, frame, URL, message, and response validation
  ├─ trusted local settings (Gemini key, opaque Jira session, consent)
  ├─ five-minute session summary cache + in-flight deduplication
  ├─ Gemini structured-output client (direct BYOK request)
  └─ fixed Worker client (session token in Authorization header)
        │ exact HTTPS Worker origin
        ▼
Cloudflare Worker + D1
  ├─ Atlassian resource-level OAuth 3LO and rotating-token encryption
  ├─ exact extension-origin/site/cloudId binding
  ├─ minimal Jira context and transition normalization
  ├─ fresh pre-write validation + idempotency
  └─ no generic Jira proxy and no Jira content stored in D1
```

Key responsibilities:

- `entrypoints/` contains WXT background, content-script, and Options Page composition roots.
- `src/link-providers/` recognizes supported URLs and emits generic `LinkResource` values.
- `src/content-fetchers/` uses real Worker-backed data for Jira and deterministic mock data for Confluence.
- `src/summarizers/` owns the Gemini request, prompt-injection boundary, structured schema, and runtime response validation.
- `src/background/` owns trusted sender validation and orchestration.
- `src/storage/` owns trusted settings, the five-minute cache, and in-flight coordination.
- `src/ui/` owns delegated hover behavior, the singleton popover, and the confirmed Jira action card.
- `worker/src/` owns OAuth, crypto/session state, fixed Jira operations, HTTP security, and privacy responses.
- `src/config/runtime-config.ts` centralizes Gemini and Worker endpoint/time limits.

## Prerequisites

- Node.js 22 or newer.
- npm 10 or newer.
- Google Chrome 102 or newer.
- For live summaries: an authorized Gemini API key created in [Google AI Studio](https://aistudio.google.com/apikey).
- For real Jira: a Cloudflare account with Workers and D1, an Atlassian OAuth 2.0 (3LO) app, and a stable Chrome extension ID.

No real credential is required for installation, automated tests, local D1 migration, or dry-run builds.

## Install and develop

```bash
npm install
npm run dev
```

WXT prepares the extension and starts its development runner. The repository uses npm only and commits `package-lock.json`.

The local Worker checks are separate and never deploy:

```bash
npm run worker:migrate:local
npm run worker:test
npm run worker:typecheck
npm run worker:build
```

`worker:build` is `wrangler deploy --dry-run`; it writes only local bundle output.

## Build and load unpacked

```bash
npm run build
```

Load this directory from `chrome://extensions` → **Developer mode** → **Load unpacked**:

```text
.output/chrome-mv3/
```

The default local/test build uses the reserved Worker origin `https://link-insight.invalid`. It is fully buildable and testable, but Jira Connect will not work until a real Worker origin is injected. Gemini and mock Confluence can still be verified independently.

For a release build connected to a deployed Worker, set `WXT_WORKER_ORIGIN` to that exact HTTPS origin, then run:

```bash
npm run build:release
npm run zip
```

The release preflight rejects a missing, malformed, or reserved test Worker origin. After each rebuild, reload the unpacked extension in `chrome://extensions` and reload existing Google Chat tabs.

## Configure Gemini BYOK

1. Open the extension Options Page from its toolbar action.
2. Follow the Google AI Studio link and create a key under Google's current authorization guidance.
3. Enter it in the password field and select **Save**.
4. The page reports `Saved locally on this device.` without echoing the key.
5. Use **Clear key** to remove it.

The key is trimmed and checked only for non-empty input. It is never synced, logged, added to a URL, returned to the content script, or included in fixtures.

## Configure and deploy the Jira Worker manually

These steps mutate Cloudflare/Atlassian state and are intentionally not run by repository scripts.

1. Obtain the final Chrome extension ID. For an Unlisted Chrome Web Store item, use its assigned ID consistently for both the OAuth redirect allowlist and the uploaded extension.
2. Create a D1 database for the deployment with Wrangler or the Cloudflare dashboard.
3. In a deployment-specific copy of `worker/wrangler.jsonc`, replace the all-zero local D1 sentinel with the created database ID. Set the exact public Worker origin and a comma-separated allowlist of exact Chrome extension IDs. Do not commit deployment-specific identifiers if your operating policy treats them as environment configuration.
4. Configure these Worker secrets interactively; never put their values in source, command history, screenshots, or documentation:

   - `ATLASSIAN_CLIENT_ID`
   - `ATLASSIAN_CLIENT_SECRET`
   - `TOKEN_ENCRYPTION_KEY`
   - `SESSION_HMAC_KEY`

   `TOKEN_ENCRYPTION_KEY` must be base64 for exactly 32 random bytes. `SESSION_HMAC_KEY` must be base64 for at least 32 random bytes.

5. Apply migrations to the intended remote D1 database only after reviewing the resolved binding:

   ```bash
   npx wrangler d1 migrations apply sdcorejs-link-insight --remote --config worker/wrangler.jsonc
   ```

6. Deploy the Worker explicitly:

   ```bash
   npx wrangler deploy --config worker/wrangler.jsonc
   ```

7. In the Atlassian developer console, configure an OAuth 2.0 (3LO) app with the Worker callback `https://<exact-worker-origin>/oauth/callback` and exactly these scopes:

   ```text
   offline_access read:jira-work write:jira-work
   ```

8. Build the extension with the same exact Worker origin using `npm run build:release`, upload the resulting Chrome ZIP for the intended Unlisted item, or load the unpacked output for development.
9. Open Options, select **Connect Jira**, approve only the intended Jira resources, verify the connected-site list, and separately enable Jira-to-Gemini consent if real Jira summaries are desired.

For rollback, deploy the previously verified Worker version and extension package. If credentials or an update may be compromised, use **Disconnect Jira**, revoke Atlassian access, remove/recreate Worker secrets, and revoke the Gemini API key as appropriate.

## Use in Google Chat

Supported content-script surfaces:

- `https://chat.google.com/*`
- `https://mail.google.com/chat/*`

Example URL shapes:

```text
https://example.atlassian.net/browse/DEMO-123
https://example.atlassian.net/wiki/spaces/ENG/pages/123456/Architecture-Guide
```

Hover for less than 500 ms: no background request or popover is created. Hover for at least 500 ms: `Loading AI summary...` appears, followed by exactly three validated bullets or an actionable error. Mouseout hides the summary synchronously; stale responses cannot reopen it.

For a Jira issue, the separate **Jira actions** trigger opens one pinned dialog. Choose a transition, complete supported fields, review the issue/current/destination status and exact values, then select **Confirm transition**. There is no one-click bypass and writes are never automatically retried. Unsupported required fields produce a **Finish in Jira** link. A stale or ambiguous result refreshes Jira state instead of claiming success.

## Real Jira versus mock Confluence

Jira never falls back to mock data. A Jira summary requires all of the following:

- a connected, non-expired Jira installation;
- the exact Jira hostname among the granted/selected sites;
- a saved Gemini key; and
- explicit Jira AI-summary consent, which defaults to off.

The Worker retrieves only summary, description, issue type, status, priority, assignee display name, labels, and three newest plain-text comments. Obvious email-like text is redacted, author/account/attachment/link-target data is omitted, and total context is bounded before it reaches Gemini.

Confluence remains deterministic mock data and does not call Atlassian. No Atlassian host permission is necessary because the extension calls only the exact Worker origin.

## Permissions

| Manifest capability | Built value                                   | Justification                                                             |
| ------------------- | --------------------------------------------- | ------------------------------------------------------------------------- |
| `permissions`       | `storage`                                     | Stores trusted local settings and validated session summaries.            |
| `permissions`       | `identity`                                    | Runs the user-initiated Atlassian OAuth flow through `launchWebAuthFlow`. |
| `host_permissions`  | `https://generativelanguage.googleapis.com/*` | Lets only the trusted background call Gemini.                             |
| `host_permissions`  | `<exact WXT_WORKER_ORIGIN>/*`                 | Calls the fixed OAuth/Jira Worker API.                                    |
| Content matches     | Google Chat and Gmail Chat paths only         | Runs delegated hover/action UI only on supported Chat surfaces.           |

The manifest has no Atlassian host permission, `activeTab`, `tabs`, `scripting`, cookies, `webRequest`, GitLab permission, or wildcard host permission.

## Privacy and security limitations

See [PRIVACY.md](./PRIVACY.md) and the public deployed Worker `/privacy` page.

- The background calls `chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" })`; content-script code cannot read the Gemini key or Jira session.
- Local extension storage is not a hardware-backed secret vault. Sufficient device/profile access or a future compromised extension update can access locally stored credentials.
- Atlassian access/refresh tokens and Worker secret values never enter the extension. D1 stores only an encrypted refresh token and opaque security/session records, not Jira content or transition inputs.
- Jira content is transferred to Google Gemini only with separate explicit consent. Gemini uses the user's key, `store: false`, and may impose quota or pricing.
- No production source logs secrets, prompts, Jira URLs, issue keys, request bodies, transition values, authorization headers, or raw upstream errors. No telemetry is present.
- Worker records expire after 30 days without authenticated activity; Disconnect requests earlier deletion.

## Troubleshooting

### Set your Gemini API key

Open Options, save a non-empty authorized key, and retry. The key is never displayed after saving.

### Invalid Gemini key or quota

HTTP 401/403 becomes an invalid-key message. HTTP 429 becomes a quota/rate-limit message. Check the Google AI Studio project, restrictions, billing, and quota before retrying.

### Jira is not connected / reauthorization required

Open Options and use **Connect Jira** or **Reconnect Jira**. Confirm the Worker origin in the release manifest matches the deployed Worker and the stable extension ID is in the Worker's exact allowlist.

### Jira site is not authorized

The requested `<tenant>.atlassian.net` hostname was not returned for this installation. Reconnect and approve the intended resource. Lookalike, dotted-subtenant, HTTP, credential-bearing, and unselected hosts are rejected.

### Transition fields cannot be rendered

Required Jira/plugin fields outside the safe renderer disable confirmation. Use **Finish in Jira**. Optional unsupported fields are not guessed or sent.

### Stale or ambiguous transition result

The card refreshes instead of retrying. Verify the current issue status in Jira before starting another transition; do not repeat a write merely because a network response was lost.

### Content script does not run

Verify the page is one of the two supported Google Chat URL families, reload the Chat tab after installation/update, and confirm the link is exact HTTPS `<tenant>.atlassian.net` with a supported path.

### Service worker or Worker errors

Inspect the extension service worker from `chrome://extensions`. For the Cloudflare Worker, use non-sensitive health checks at `/health`; do not enable request logging that captures protected headers or bodies. Confirm remote D1 migrations, bindings, non-secret variables, and the four named secrets are configured.

## Add GitLab later

Adding GitLab should not require rewriting `HoverController`, `Popover`, or `GeminiSummarizer`:

1. Add a `GitLabLinkProvider` that validates exact HTTPS GitLab URLs and emits generic `LinkResource` data.
2. Add a GitLab content fetcher/authentication boundary that maps issue, merge request, and commit data to `NormalizedLinkContent`.
3. Register the provider and fetcher in the composition roots.
4. Add only the exact GitLab host/Worker permission required by that implementation.
5. Add GitLab-specific actions as a separate capability port rather than provider branches in the generic hover/popover/Gemini code.
6. Add provider, trust-boundary, response-schema, cache, privacy, and lifecycle tests before enabling it.

## Scripts and validation

| Command                        | Purpose                                                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `npm run dev`                  | Start WXT development mode.                                                                                  |
| `npm run build`                | Build test/local Chrome MV3 output and validate its actual manifest.                                         |
| `npm run build:release`        | Require a real Worker origin, then build and validate.                                                       |
| `npm run zip`                  | Create the Chrome distribution ZIP.                                                                          |
| `npm run lint`                 | Run ESLint.                                                                                                  |
| `npm run typecheck`            | Strict-check extension TypeScript.                                                                           |
| `npm test`                     | Run extension unit/jsdom tests.                                                                              |
| `npm run worker:migrate:local` | Apply D1 migrations locally.                                                                                 |
| `npm run worker:test`          | Run tests in the Cloudflare Workers runtime.                                                                 |
| `npm run worker:typecheck`     | Strict-check Worker TypeScript.                                                                              |
| `npm run worker:build`         | Bundle the Worker with Wrangler dry-run only.                                                                |
| `npm run check`                | Run formatting, lint, both typechecks/test suites, Worker dry-run, extension build, and manifest validation. |

Automated tests use mocked network responses and local D1. They cover OAuth state/exchange replay and expiry, AES-GCM/HMAC/session handling, refresh leases, rate limits, exact CORS/schema boundaries, site/cloudId binding, Jira minimization/redaction, transition normalization and payload validation, sender/storage isolation, real-Jira consent gates, Gemini structured output, caching/deduplication/invalidation, 500 ms hover/stale behavior, Options accessibility, action confirmation/idempotency behavior, and built-manifest permissions.

Live OAuth, Jira reads/writes, Cloudflare deployment, Chrome Web Store installation, and Gemini requests remain manual checks requiring user-owned credentials. Do not treat automated mocked tests as proof that those live flows succeeded.

## Out of scope

- Real Confluence authentication/API access.
- GitLab authentication/API/link support.
- Generic Jira proxying, issue deletion, administration, bulk transitions, or one-click confirmation bypass.
- Backend user accounts, service-account impersonation, telemetry, analytics, enterprise key distribution, or Chrome Web Store automation.
- AI-generated HTML rendering.
- Firefox or Safari support.
