---
artifact_id: plan-link-insight-jira-oauth-actions-v1-r1
artifact_kind: plan
schema_version: 1
change_ref: link-insight-jira-oauth-actions-v1
source_spec: .sdcorejs/specs/fullstack/2026-08-13-07-45-jira-oauth-actions.md
source_plan: none
commit_policy: with-change
owner: sdcorejs-plan
name: jira-oauth-actions
description: Approved TDD execution contract for Jira OAuth, real summaries, and confirmed transitions.
contract_id: link-insight-jira-oauth-actions-v1
requirement_id: req-link-insight-jira-oauth-actions-v1
approved_at: 2026-08-13T02:49:22.376Z
approved_by: null
approval_source: explicit-user-choice
track: fullstack
sourceSpecPath: .sdcorejs/specs/fullstack/2026-08-13-07-45-jira-oauth-actions.md
approved_spec_reference:
  repository_id: github.com/sdcorejs/link-insight
  repository_relative_path: .sdcorejs/specs/fullstack/2026-08-13-07-45-jira-oauth-actions.md
  artifact_id: spec-link-insight-jira-oauth-actions-v1-r1
  revision: 98e2c89e227ca22e1f168fe3e475d15eea898fa9
  approval_hash: sha256:v1:69051341a24bcd1bc36f579ebba400184c593c8d3295fa5b248f07b28e8c43f5
parent_repository_id: null
parent_references:
  - repository_id: github.com/sdcorejs/link-insight
    artifact_id: spec-link-insight-jira-oauth-actions-v1-r1
    artifact_kind: spec
    revision: 98e2c89e227ca22e1f168fe3e475d15eea898fa9
    approval_hash: sha256:v1:69051341a24bcd1bc36f579ebba400184c593c8d3295fa5b248f07b28e8c43f5
owner_repository_id: github.com/sdcorejs/link-insight
owner_repository_role: standalone
owner_module_id: none
execution_host_repository_id: github.com/sdcorejs/link-insight
integration_owner_repository_id: github.com/sdcorejs/link-insight
repository_relative_path: .sdcorejs/plans/fullstack/2026-08-13-09-49-jira-oauth-actions.md
source_revision: 98e2c89e227ca22e1f168fe3e475d15eea898fa9
dependency_order:
  - repo-preflight
  - repo-harness
  - shared-contracts
  - worker-security
  - worker-jira
  - extension-trusted
  - extension-summary
  - extension-options
  - extension-actions
  - docs-validation
  - final-verification
gitlink_updates_in_scope: false
task_count: 34
phase_count: 9
target_root_kind: target-project
stack_profile: node-esm
approved_spec_hash: sha256:v1:69051341a24bcd1bc36f579ebba400184c593c8d3295fa5b248f07b28e8c43f5
allowed_paths:
  - package.json
  - package-lock.json
  - tsconfig.json
  - vitest.config.ts
  - eslint.config.js
  - .gitignore
  - .prettierignore
  - wxt.config.ts
  - entrypoints/**
  - src/**
  - tests/**
  - worker/**
  - scripts/validate-manifest.mjs
  - README.md
  - PRIVACY.md
  - .sdcorejs/docs/fullstack/*jira-oauth-actions-plan.md
  - .sdcorejs/plans/fullstack/*jira-oauth-actions*.md
prohibited_paths:
  - .git/**
  - .env
  - .env.*
  - worker/.dev.vars
  - worker/.dev.vars.*
  - node_modules/**
  - .output/**
  - .wxt/**
  - .wrangler/**
  - coverage/**
  - worker/dist/**
  - .sdcorejs/specs/**
  - Chrome profile or browser authentication data
dependency_changes:
  required: true
  approval_required: true
env_changes:
  required: true
  approval_required: true
migration_changes:
  required: true
  approval_required: true
verification_strategy:
  package_manager: npm
  commands_planned:
    - npm run worker:migrate:local
    - npm run worker:test
    - npm run worker:typecheck
    - npm run worker:build
    - npm run check
    - npm run zip
    - npm audit --audit-level=high
approval_hash: sha256:v1:21a52a873a587b488c0b031b128137dd0295ef4772719684b0272a0e1712a345
approved_plan_hash: sha256:v1:21a52a873a587b488c0b031b128137dd0295ef4772719684b0272a0e1712a345
supersedes: null
change_control:
  revision: 1
  supersedes: null
  change_reason: null
---

# Jira OAuth Actions - Approved Plan

> Snapshot of what the user approved at the `sdcorejs-plan` gate. Do not edit by hand; re-author through `sdcorejs-plan` if the contract changes.

## Approved contract

# Plan - Jira OAuth Actions - 2026-08-13 07:56

## Scope

Implement the approved real-Jira extension slice in the existing WXT Manifest V3 repository: a Cloudflare Worker/D1 OAuth boundary, trusted extension integration, opt-in real Jira summaries, and a separately pinned/confirmed Jira transition card. Confluence remains on deterministic mock content, Gemini remains BYOK, and public deployment or live credential use is deferred to manual verification.

## Execution context

- Track: `fullstack`
- Target root kind: `target-project`
- Stack profile: `node-esm`
- Coverage approach: TDD
- Parallel candidates: no; shared runtime contracts, `package-lock.json`, D1 migration, and top-level extension/Worker registration create a security-sensitive dependency chain that should stay sequential.

```yaml
plan_context:
  source: sdcorejs-plan
  contract_id: link-insight-jira-oauth-actions-v1
  requirement_id: req-link-insight-jira-oauth-actions-v1
  approved_spec_path: .sdcorejs/specs/fullstack/2026-08-13-07-45-jira-oauth-actions.md
  approved_spec_hash: sha256:v1:69051341a24bcd1bc36f579ebba400184c593c8d3295fa5b248f07b28e8c43f5
  approved_spec_reference:
    repository_id: github.com/sdcorejs/link-insight
    repository_relative_path: .sdcorejs/specs/fullstack/2026-08-13-07-45-jira-oauth-actions.md
    artifact_id: spec-link-insight-jira-oauth-actions-v1-r1
    revision: 98e2c89e227ca22e1f168fe3e475d15eea898fa9
    approval_hash: sha256:v1:69051341a24bcd1bc36f579ebba400184c593c8d3295fa5b248f07b28e8c43f5
  approved_plan_path: null
  approved_plan_hash: null
  supersedes: null
  target_root: C:/Users/Admin/Documents/sdcorejs/sdcorejs-link-insight
  target_root_kind: target-project
  owner_repository_id: github.com/sdcorejs/link-insight
  owner_repository_role: standalone
  owner_module_id: null
  execution_host_repository_id: github.com/sdcorejs/link-insight
  integration_owner_repository_id: github.com/sdcorejs/link-insight
  dependency_order:
    - repo-preflight
    - repo-harness
    - shared-contracts
    - worker-security
    - worker-jira
    - extension-trusted
    - extension-summary
    - extension-options
    - extension-actions
    - docs-validation
    - final-verification
  gitlink_updates_in_scope: false
  track: fullstack
  stack_profile: node-esm
  task_count: 34
  phase_count: 9
  allowed_paths:
    - package.json
    - package-lock.json
    - tsconfig.json
    - vitest.config.ts
    - eslint.config.js
    - .gitignore
    - .prettierignore
    - wxt.config.ts
    - entrypoints/**
    - src/**
    - tests/**
    - worker/**
    - scripts/validate-manifest.mjs
    - README.md
    - PRIVACY.md
    - .sdcorejs/docs/fullstack/*jira-oauth-actions-plan.md
    - .sdcorejs/plans/fullstack/*jira-oauth-actions*.md
  prohibited_paths:
    - .git/**
    - .env
    - .env.*
    - worker/.dev.vars
    - worker/.dev.vars.*
    - node_modules/**
    - .output/**
    - .wxt/**
    - .wrangler/**
    - coverage/**
    - worker/dist/**
    - .sdcorejs/specs/**
    - Chrome profile or browser authentication data
  generated_artifacts:
    - .output/**
    - .wxt/**
    - .wrangler/**
    - coverage/**
    - worker/dist/**
  docs_artifacts:
    - README.md
    - PRIVACY.md
    - .sdcorejs/docs/fullstack/2026-08-13-07-56-jira-oauth-actions-plan.md
    - .sdcorejs/specs/fullstack/2026-08-13-07-45-jira-oauth-actions.md
    - .sdcorejs/plans/fullstack/*jira-oauth-actions*.md
  dependency_changes:
    required: true
    packages:
      - wrangler
      - '@cloudflare/vitest-pool-workers'
      - '@cloudflare/workers-types'
    approval_required: true
  env_changes:
    required: true
    files: []
    approval_required: true
    non_secret_inputs:
      - WXT_WORKER_ORIGIN
      - ALLOWED_EXTENSION_IDS
      - PUBLIC_WORKER_ORIGIN
    worker_secret_names:
      - ATLASSIAN_CLIENT_ID
      - ATLASSIAN_CLIENT_SECRET
      - TOKEN_ENCRYPTION_KEY
      - SESSION_HMAC_KEY
    policy: Values are supplied out of band; no env or dev-vars file and no credential-like fixture is committed.
  migration_changes:
    required: true
    description: Create the initial D1 schema for hash-only installation sessions, encrypted rotating refresh grants, selected Jira sites, short-lived OAuth/exchange records, refresh leases, and opaque idempotency records; no Jira content or transition values are stored.
    approval_required: true
  frontend_architecture:
    required: true
    not_applicable_reason: null
    project_conventions:
      component_style: Native DOM classes/controllers composed in WXT entrypoints; no UI framework and no custom element convention detected.
      folder_convention: Responsibility-based folders under src with WXT surface entrypoints under entrypoints.
      state_convention: Feature-local controller state plus trusted storage adapters; no global application store.
      service_data_access_convention: Interface/registry boundaries with native fetch in trusted background or Worker contexts.
      registration_provider_convention: Explicit constructor composition at WXT entrypoints and synchronous top-level runtime listener registration.
      public_api_barrel_convention: No barrel exports; direct relative imports are the detected convention.
      test_convention: Vitest unit tests mirror source responsibilities; jsdom is selected per DOM suite and Chrome/storage/fetch boundaries are injected or mocked.
      evidence_inspected:
        - entrypoints/background.ts
        - entrypoints/content.ts
        - entrypoints/options/main.ts
        - src/ui/hover-controller.ts
        - src/ui/popover.ts
        - src/options/options-controller.ts
        - src/background/summary-message-handler.ts
        - src/content-fetchers/content-fetcher-registry.ts
        - src/storage/summary-cache.ts
        - tests/ui/hover-controller.test.ts
        - tests/options/options-controller.test.ts
        - tests/background/summary-message-handler.test.ts
        - wxt.config.ts
        - vitest.config.ts
    component_tree:
      - Options document -> existing OptionsController for Gemini key + new JiraOptionsController for connect/status/site/disconnect/consent/privacy controls
      - Google Chat content entrypoint -> extended HoverController for delegated dwell lifecycle + reused Popover for non-interactive summary + new JiraActionController for affordance/pinned workflow
      - JiraActionController -> one reusable affordance + one reusable JiraActionCard with transition selection, supported field form, confirmation, result/error, close/Escape, and focus lifecycle
      - Background entrypoint -> existing summary listener + new Jira message listener + JiraAuthClient/JiraWorkerClient/JiraSettingsStore composition
    reuse_decisions:
      - need: Preserve delegated Google Chat hover and stale-response behavior
        candidate: src/ui/hover-controller.ts HoverController
        decision: extend
        reason: It already owns the tested 500 ms event-delegated lifecycle; add a narrow JiraActionsPort instead of duplicating link handling.
      - need: Preserve summary rendering and non-interactive safety
        candidate: src/ui/popover.ts Popover
        decision: reuse
        reason: It already renders text through DOM APIs, owns a singleton node, and keeps AI output out of innerHTML.
      - need: Add pinned Jira workflow UI
        candidate: none in repository
        decision: feature-local creation
        reason: Interactive transition state, confirmation, and focus management are cohesive and unrelated to Popover responsibilities.
      - need: Preserve Gemini key settings
        candidate: src/options/options-controller.ts OptionsController
        decision: reuse beside a new controller
        reason: Jira connection must not make the established Gemini controller own OAuth/session state.
      - need: Resolve real Jira versus mock Confluence content
        candidate: src/content-fetchers/content-fetcher-registry.ts ContentFetcherRegistry
        decision: reuse and extend registration
        reason: The existing resource-driven registry already avoids Jira-specific branching in hover and summarizer code.
      - need: Cache invalidation after a successful write
        candidate: src/storage/summary-cache.ts SummaryCache and src/storage/summary-request-coordinator.ts SummaryRequestCoordinator
        decision: extend
        reason: Add URL-scoped invalidation at the current cache owner instead of introducing another store.
    file_decisions:
      - path: src/ui/hover-controller.ts
        decision: extend existing
        symbols: [HoverController, JiraActionsPort]
        reason: Keep a single delegated mouseover/mouseout owner and expose only the action lifecycle hook.
      - path: src/ui/jira-action-controller.ts
        decision: create feature-local
        symbols: [JiraActionController]
        reason: Own affordance, pinned-card, request-token, and transition workflow orchestration.
      - path: src/ui/jira-action-card.ts
        decision: create feature-local
        symbols: [JiraActionCard]
        reason: Own accessible text-safe DOM rendering and user events without network/storage access.
      - path: src/options/jira-options-controller.ts
        decision: create page-local
        symbols: [JiraOptionsController, initializeJiraOptions]
        reason: Isolate Jira connection/consent state from Gemini-key persistence.
      - path: src/jira/jira-worker-client.ts
        decision: create trusted service
        symbols: [JiraWorkerClient]
        reason: Centralize exact Worker routes, session header, timeouts, and response validation in background-only code.
      - path: src/auth/jira-auth-client.ts
        decision: create trusted collaborator
        symbols: [JiraAuthClient]
        reason: Keep PKCE-style verifier/challenge and launchWebAuthFlow orchestration outside UI/message handlers.
      - path: src/core/worker-api-contracts.ts
        decision: create shared contract module
        symbols: [Worker request/response parsers and normalized DTOs]
        reason: Extension and Worker need one runtime-validated allowlisted protocol without generic proxy payloads.
      - path: entrypoints/background.ts
        decision: extend registration
        symbols: [synchronous onMessage composition]
        reason: Manifest V3 listeners must remain registered synchronously at service-worker startup.
      - path: entrypoints/content.ts
        decision: extend composition
        symbols: [HoverController and JiraActionController instances]
        reason: Instances are scoped once per content-script lifecycle and disposed together.
      - path: entrypoints/options/index.html
        decision: inline semantic page markup
        symbols: [Jira settings section]
        reason: Static labels/controls are small; extracting markup would add indirection without reusable behavior.
    responsibilities:
      - symbol: HoverController
        cohesive_responsibility: Delegated anchor recognition, dwell timer, summary request token, and synchronous summary hide.
        inputs: DOM mouse events, LinkProviderRegistry, summary sender, JiraActionsPort
        outputs: Popover state and Jira action hover notifications
      - symbol: JiraActionController
        cohesive_responsibility: Jira-only affordance/pinned-card lifecycle, read/write request tokens, confirmation gating, cache-refresh outcome handling.
        inputs: LinkResource, pointer position, Jira message sender, JiraActionCard
        outputs: Card view models and extension requests
      - symbol: JiraActionCard
        cohesive_responsibility: Safe supported-field controls, validation presentation, confirmation/result/error DOM, keyboard/focus behavior.
        inputs: Normalized transition/card view models
        outputs: Typed user intents and normalized field values
      - symbol: JiraOptionsController
        cohesive_responsibility: Trusted connection/status/disconnect/consent UI orchestration with aria-live feedback.
        inputs: DOM controls and typed background message sender
        outputs: User-triggered Jira settings requests and rendered status
      - symbol: JiraWorkerClient
        cohesive_responsibility: Authenticated fixed-route Worker HTTP calls with runtime response validation and normalized errors.
        inputs: Public Worker origin, installation session token, typed DTOs
        outputs: Typed connection/context/transition DTOs or LinkInsightError
      - symbol: JiraAuthClient
        cohesive_responsibility: Generate verifier/challenge, start OAuth, validate redirect, exchange one-time code, and persist resulting opaque session via its injected store.
        inputs: Chrome identity adapter, JiraWorkerClient, JiraSettingsStore
        outputs: Connection result without exposing Atlassian credentials
    state_owners:
      - HoverController owns current anchor/resource, dwell timer, cursor position, and summary request token.
      - JiraActionController owns current Jira resource, affordance visibility, pinned-card mode, read token, write idempotency key, and stale-response generation.
      - JiraActionCard owns only DOM nodes, focus restoration target, selected transition/control values, and emitted UI events.
      - JiraOptionsController owns page-local loading/status state; background remains authoritative for connection and consent.
      - JiraSettingsStore owns opaque installation session token and jiraGeminiConsent in trusted chrome.storage.local.
      - Worker D1 repositories own only hashes/ciphertext/site mappings/transient records and timestamps defined by the migration.
    service_boundaries:
      - symbol: JiraWorkerClient
        scope: app
      - symbol: JiraAuthClient
        scope: app
      - symbol: JiraSettingsStore
        scope: app
      - symbol: JiraContentFetcher
        scope: feature
      - symbol: JiraActionController
        scope: feature
      - symbol: JiraActionCard
        scope: component
      - symbol: Worker API runtime parsers
        scope: pure_function
    data_flow:
      - Options click -> JiraOptionsController -> discriminated runtime message -> Jira message handler -> JiraAuthClient -> fixed Worker OAuth routes -> chrome.identity flow -> one-time exchange -> JiraSettingsStore -> status view
      - Jira hover -> HoverController -> summary request -> background sender/URL revalidation -> JiraContentFetcher -> JiraWorkerClient /v1/jira/context -> normalized minimal content -> GeminiSummarizer -> validated three bullets -> Popover
      - Jira action affordance -> JiraActionController -> transition query message -> background validation -> JiraWorkerClient -> Worker site binding + Atlassian expand=transitions.fields -> normalized metadata -> JiraActionCard
      - Confirm transition -> unique idempotency request -> Worker fresh metadata validation -> constructed Jira transition request -> normalized result -> summary cache invalidation -> refreshed card/status
    declarations_and_registration:
      - HoverController and JiraActionController are constructed once in entrypoints/content.ts and stopped on WXT invalidation.
      - OptionsController and JiraOptionsController are constructed once in entrypoints/options/main.ts after static semantic markup loads.
      - Summary and Jira message listeners are created and synchronously registered in entrypoints/background.ts.
      - Worker fetch and scheduled handlers are exported from worker/src/index.ts; no dynamic route registry or arbitrary proxy registration is allowed.
    public_exports:
      - none; this is an application repository and detected imports are direct relative paths, so no barrel/public package surface is added.
    tests:
      - Hover architecture test proves a single delegated controller and singleton summary/action nodes across repeated SPA hover cycles.
      - Options architecture test proves Jira UI uses runtime messages and never reads the Jira session token.
      - Background architecture test proves only trusted listeners can access JiraSettingsStore and JiraWorkerClient.
      - Source-boundary test proves content/UI modules do not import chrome.storage, auth/session storage, Worker secrets, or raw Atlassian clients.
      - Worker route test proves the exported fetch handler exposes only the approved route/method allowlist.
    decomposition_rationale:
      - Keep static Options markup inline, but extract JiraOptionsController because it owns an independent async connection state machine.
      - Keep hover recognition in HoverController, but extract JiraActionController because pinned interactive workflow state must outlive hover and cannot belong to the non-interactive Popover.
      - Keep field rendering in one JiraActionCard because the supported controls share form/confirmation/focus invariants; do not create one class per trivial input type.
      - Keep Worker HTTP, OAuth/session, crypto, and Jira normalization separate because they represent distinct trust/test boundaries, while avoiding a framework, ORM, facade, or generic proxy abstraction.
  agent_architecture:
    required: false
    not_applicable_reason: The feature calls Gemini as a bounded summarizer but does not create an autonomous agent runtime, tool loop, or provider conversation state.
    schema_version: 1
  verification_strategy:
    package_manager: npm
    scripts_detected:
      - dev
      - build
      - zip
      - lint
      - format
      - format:check
      - typecheck
      - test
      - test:watch
      - check
      - postinstall
    commands_planned:
      - npm install - update package-lock.json with only the three approved Cloudflare development packages.
      - npm test -- tests/core/worker-api-contracts.test.ts - prove the shared extension/Worker DTO parsers independently.
      - npm run worker:test - run Worker OAuth, D1, crypto, route, privacy, and Jira tests in the Workers Vitest runtime.
      - npm run worker:typecheck - type-check the Worker with its isolated Cloudflare runtime configuration.
      - npm run worker:build - run Wrangler deploy --dry-run only; produce a local generated bundle and perform no network deployment.
      - npm run worker:migrate:local - apply 0001_initial.sql only to Wrangler local D1 state.
      - npm run check - run formatter, lint, extension typecheck/tests, Worker typecheck/tests/dry-build, and test-mode extension build without deployment.
      - npm run zip - produce the Chrome upload artifact after the broad gate is green.
      - npm audit --audit-level=high - report dependency vulnerabilities without mutating the lockfile.
      - node scripts/validate-manifest.mjs - inspect the actual test/release manifest for MV3, storage+identity only, exact Gemini/Worker hosts, and no Atlassian/wildcard host.
    commands_skipped:
      - npm run dev - interactive long-running process; documented for human development rather than used as a completion gate.
      - wrangler d1 create - remote resource creation is an external mutation and is not authorized by plan approval alone.
      - wrangler secret put - requires real credentials and an interactive Cloudflare account; secret values must never enter this task transcript or repository.
      - wrangler d1 migrations apply --remote - remote data mutation is deferred until deployment is explicitly authorized.
      - wrangler deploy - external publication is deferred until Cloudflare/D1/Atlassian configuration and a separate deployment approval exist.
      - live Atlassian OAuth/Jira transition/Gemini request - requires user credentials, selected test sites, an Unlisted extension ID, and explicit manual authorization.
    focused_checks:
      - Contract parser suites reject extra properties, invalid IDs/hosts/types, oversized bodies, and malformed upstream payloads.
      - Fake-timer/controller suites prove dwell, child movement, stale response, confirmation, one-card, and cache invalidation behavior.
      - Worker integration suites use local D1 migrations and mocked Atlassian fetch; they inspect stored rows for privacy-minimal records.
      - Security tests inspect source/import boundaries and assert secrets/tokens never cross extension messages or production logs.
    broad_checks:
      - npm run check
      - npm run zip
      - npm audit --audit-level=high
      - inspect .output/chrome-mv3/manifest.json and generated ZIP contents
  parallel_candidates:
    allowed: false
    frozen_contract:
      path: .sdcorejs/specs/fullstack/2026-08-13-07-45-jira-oauth-actions.md
      hash: sha256:v1:69051341a24bcd1bc36f579ebba400184c593c8d3295fa5b248f07b28e8c43f5
      revision: 1
      derived_from_approved_plan_hash: null
      supersedes: null
    units: []
    shared_files:
      - package.json and package-lock.json have one sequential owner in task 2.
      - src/core/worker-api-contracts.ts is frozen by tasks 4-6 before either runtime consumes it.
      - worker/migrations/0001_initial.sql is owned by task 8 and verified before Worker repositories are completed.
      - entrypoints/background.ts, entrypoints/content.ts, and wxt.config.ts are integrated sequentially in tasks 17 and 29.
    conflict_risks:
      - OAuth route shapes, D1 columns, and extension messages must remain exactly aligned.
      - Summary and Jira action flows share sender validation and canonical URL/cache identity.
      - Root scripts/configuration are touched by extension and Worker validation.
  repository_plan:
    schema_version: 1
    integration_owner_repository_id: github.com/sdcorejs/link-insight
    gitlink_updates_in_scope: false
    dependency_order:
      - rp1-preflight
      - rp2-harness-edit
      - rp3-harness-create
      - rp4-contract-create
      - rp5-worker-create
      - rp6-extension-create
      - rp7-extension-edit
      - rp8-doc-create
      - rp9-doc-edit
      - rp10-final-verify
    repositories:
      - repository_id: github.com/sdcorejs/link-insight
        role: standalone
        module_id: null
        plan_artifact_id: plan-link-insight-jira-oauth-actions-v1-r1
    steps:
      - id: rp1-preflight
        action: VERIFY
        semantic_scope: repository
        owner_repository_id: github.com/sdcorejs/link-insight
        git_roots: [github.com/sdcorejs/link-insight]
        allowed_paths: ['.']
        prohibited_paths: [.git/**]
        depends_on: []
      - id: rp2-harness-edit
        action: EDIT
        semantic_scope: repository
        owner_repository_id: github.com/sdcorejs/link-insight
        git_roots: [github.com/sdcorejs/link-insight]
        allowed_paths:
          [
            package.json,
            package-lock.json,
            tsconfig.json,
            vitest.config.ts,
            eslint.config.js,
            .gitignore,
            .prettierignore,
          ]
        prohibited_paths: [.env*, node_modules/**, .output/**, .wxt/**, .wrangler/**]
        depends_on: [rp1-preflight]
      - id: rp3-harness-create
        action: CREATE
        semantic_scope: repository
        owner_repository_id: github.com/sdcorejs/link-insight
        git_roots: [github.com/sdcorejs/link-insight]
        allowed_paths:
          [
            worker/wrangler.jsonc,
            worker/tsconfig.json,
            worker/vitest.config.ts,
            worker/test/setup.ts,
          ]
        prohibited_paths: [worker/.dev.vars*, worker/dist/**, .wrangler/**]
        depends_on: [rp2-harness-edit]
      - id: rp4-contract-create
        action: CREATE
        semantic_scope: repository
        owner_repository_id: github.com/sdcorejs/link-insight
        git_roots: [github.com/sdcorejs/link-insight]
        allowed_paths:
          [
            src/core/worker-api-contracts.ts,
            tests/core/worker-api-contracts.test.ts,
            worker/test/contracts.test.ts,
          ]
        prohibited_paths: [.sdcorejs/specs/**]
        depends_on: [rp3-harness-create]
      - id: rp5-worker-create
        action: CREATE
        semantic_scope: repository
        owner_repository_id: github.com/sdcorejs/link-insight
        git_roots: [github.com/sdcorejs/link-insight]
        allowed_paths: [worker/migrations/**, worker/src/**, worker/test/**]
        prohibited_paths: [worker/.dev.vars*, worker/dist/**, .wrangler/**]
        depends_on: [rp4-contract-create]
      - id: rp6-extension-create
        action: CREATE
        semantic_scope: repository
        owner_repository_id: github.com/sdcorejs/link-insight
        git_roots: [github.com/sdcorejs/link-insight]
        allowed_paths:
          [
            src/auth/**,
            src/jira/**,
            src/content-fetchers/jira-content-fetcher.ts,
            src/background/jira-message-handler.ts,
            src/options/jira-options-controller.ts,
            src/storage/jira-settings-store.ts,
            src/ui/jira-action-*,
            tests/auth/**,
            tests/jira/**,
            tests/core/**,
            tests/content-fetchers/jira-content-fetcher.test.ts,
            tests/background/jira-message-handler.test.ts,
            tests/options/jira-options-controller.test.ts,
            tests/storage/jira-settings-store.test.ts,
            tests/ui/jira-action-*,
            tests/security/jira-security-boundaries.test.ts,
          ]
        prohibited_paths: [.sdcorejs/specs/**, .env*, node_modules/**]
        depends_on: [rp4-contract-create, rp5-worker-create]
      - id: rp7-extension-edit
        action: EDIT
        semantic_scope: repository
        owner_repository_id: github.com/sdcorejs/link-insight
        git_roots: [github.com/sdcorejs/link-insight]
        allowed_paths:
          [
            wxt.config.ts,
            entrypoints/**,
            src/config/runtime-config.ts,
            src/core/contracts.ts,
            src/core/errors.ts,
            src/core/message-contracts.ts,
            src/background/summary-message-handler.ts,
            src/content-fetchers/content-fetcher-registry.ts,
            src/content-fetchers/mock-atlassian-content-fetcher.ts,
            src/storage/summary-cache.ts,
            src/storage/summary-request-coordinator.ts,
            src/ui/hover-controller.ts,
            src/ui/popover.css,
            tests/background/summary-message-handler.test.ts,
            tests/content-fetchers/mock-atlassian-content-fetcher.test.ts,
            tests/options/options-controller.test.ts,
            tests/options/options-markup.test.ts,
            tests/security/source-boundaries.test.ts,
            tests/storage/summary-cache.test.ts,
            tests/ui/hover-controller.test.ts,
          ]
        prohibited_paths: [.sdcorejs/specs/**, .env*, node_modules/**]
        depends_on: [rp5-worker-create, rp6-extension-create]
      - id: rp8-doc-create
        action: CREATE
        semantic_scope: repository
        owner_repository_id: github.com/sdcorejs/link-insight
        git_roots: [github.com/sdcorejs/link-insight]
        allowed_paths: [PRIVACY.md]
        prohibited_paths: [.sdcorejs/specs/**]
        depends_on: [rp7-extension-edit]
      - id: rp9-doc-edit
        action: EDIT
        semantic_scope: repository
        owner_repository_id: github.com/sdcorejs/link-insight
        git_roots: [github.com/sdcorejs/link-insight]
        allowed_paths: [README.md, scripts/validate-manifest.mjs]
        prohibited_paths: [.env*, worker/.dev.vars*]
        depends_on: [rp8-doc-create]
      - id: rp10-final-verify
        action: VERIFY
        semantic_scope: repository
        owner_repository_id: github.com/sdcorejs/link-insight
        git_roots: [github.com/sdcorejs/link-insight]
        allowed_paths: ['.']
        prohibited_paths: [.git/**, .env*, worker/.dev.vars*]
        depends_on: [rp9-doc-edit]
  finish_tail:
    docs_before_final_branch_ready: true
    verify_before_done: true
    branch_ready_final_gate: true
    no_writes_after_branch_ready: true
  approval:
    approved: false
    approved_at: null
  change_control:
    revision: 1
    supersedes: null
    change_reason: null

artifact_context:
  schema_version: 1
  change_ref: link-insight-jira-oauth-actions-v1
  source_spec: .sdcorejs/specs/fullstack/2026-08-13-07-45-jira-oauth-actions.md
  source_plan: none
  required_with_change:
    - path: .sdcorejs/specs/fullstack/2026-08-13-07-45-jira-oauth-actions.md
      kind: spec
      reason: Immutable approved scope for this change.
    - path: .sdcorejs/docs/fullstack/2026-08-13-07-56-jira-oauth-actions-plan.md
      kind: plan-draft
      reason: File-level TDD execution contract presented for approval.
  shared_owned: []
  conditional:
    - path: .sdcorejs/plans/fullstack/*jira-oauth-actions*.md
      kind: plan
      reason: Created only after explicit plan approval.
  local_only:
    - path: .output/**
      kind: build-output
      reason: Generated extension artifacts are verification evidence, not source artifacts.
    - path: .wrangler/**
      kind: local-runtime-state
      reason: Local D1 and Worker build state must not be committed.
  unrelated_observed: []
```

## Tasks

### Phase 1 - Repository preflight, tooling, and frozen contracts

1. **VERIFY** `github.com/sdcorejs/link-insight:.` - before any edit, run `git status --short`, `git diff --stat`, `git diff --cached --stat`, `git ls-files --others --exclude-standard`, `git branch --show-current`, and `git rev-parse HEAD`; compare dirty files against `allowed_paths`/`prohibited_paths` and enforce the `target-project` authoring guard. If unrelated dirty files exist, ask the required 1/2/3 scope question and do not touch them implicitly.
2. **EDIT** `github.com/sdcorejs/link-insight:{package.json,package-lock.json,tsconfig.json,vitest.config.ts,eslint.config.js,.gitignore,.prettierignore}` - add only `wrangler`, `@cloudflare/vitest-pool-workers`, and `@cloudflare/workers-types`; isolate browser and Worker test/type contexts; add `worker:test`, `worker:typecheck`, `worker:build`, `worker:migrate:local`, and test-mode build scripts; make `check` include both runtimes without deployment; update the npm lock with `npm install`; ignore local Wrangler state.
3. **CREATE** `github.com/sdcorejs/link-insight:{worker/wrangler.jsonc,worker/tsconfig.json,worker/vitest.config.ts,worker/test/setup.ts}` - establish an ES-module Worker harness, D1 binding, scheduled cleanup, Vitest Workers runtime, local-only migration/test configuration, explicit compatibility date, and dry-run build; use a clearly documented non-production D1 sentinel until a real remote database is provisioned, and never auto-deploy from a script.
4. **CREATE** `github.com/sdcorejs/link-insight:{tests/core/worker-api-contracts.test.ts,worker/test/contracts.test.ts}` - write RED contract tests for every fixed Worker route DTO, exact-property validation, HTTPS Atlassian site binding, bounded issue/transition values, three-comment context caps, normalized errors, and absence of any arbitrary URL/method/Jira path field.
5. **CREATE** `github.com/sdcorejs/link-insight:src/core/worker-api-contracts.ts` - implement the smallest runtime parsers and normalized DTOs that satisfy task 4 and can be consumed by both extension and Worker without a validation library.
6. **EDIT** `github.com/sdcorejs/link-insight:{src/core/contracts.ts,src/core/errors.ts,src/core/message-contracts.ts,src/config/runtime-config.ts}` - add extensible Jira context/transition/action types, discriminated trusted runtime messages, actionable normalized error codes, Worker origin/timeouts/content limits, and explicit test-vs-release Worker-origin validation while preserving the existing generic provider contracts.

### Phase 2 - Worker OAuth, session, crypto, HTTP, and D1 security

7. **CREATE** `github.com/sdcorejs/link-insight:{worker/test/oauth-session.test.ts,worker/test/http-security.test.ts,worker/test/privacy.test.ts}` - write RED Workers-runtime tests for verifier challenge/state/redirect checks, single-use expiry/replay, exact OAuth scopes, hash-only sessions, AES-GCM versioning, rotating refresh lease concurrency, disconnect/revocation, 30-day cleanup, exact CORS/origin/method/body/schema allowlists, redacted logs, and public privacy/health responses.
8. **CREATE** `github.com/sdcorejs/link-insight:worker/migrations/0001_initial.sql` - define foreign-keyed D1 tables/indexes for installations, token hashes, encrypted refresh grants, selected sites, OAuth state/exchange codes, refresh leases, and opaque idempotency records with expiry timestamps and no Jira content/transition-input columns; prove it applies to local D1 before repository implementation depends on it.
9. **CREATE** `github.com/sdcorejs/link-insight:{worker/src/index.ts,worker/src/config.ts,worker/src/http.ts,worker/src/oauth.ts,worker/src/session-store.ts,worker/src/token-crypto.ts,worker/src/privacy.ts}` - implement the fixed Worker router, fail-closed config, CORS/content-type/body/rate/schema boundaries, resource-level Atlassian OAuth start/callback/exchange, HMAC session hashing, versioned AES-GCM refresh storage/lease rotation, disconnect, scheduled cleanup, non-sensitive health, and disclosure response until task 7 is green; never log protected values.
10. **VERIFY** `github.com/sdcorejs/link-insight:worker/test/{oauth-session,http-security,privacy}.test.ts` - run the focused Worker tests and inspect local D1 rows to prove plaintext session/refresh values, issue data, and transition inputs are absent before adding Jira operations.

### Phase 3 - Fixed Jira Worker operations

11. **CREATE** `github.com/sdcorejs/link-insight:worker/test/jira.test.ts` - write RED tests for accessible-resource cloudId binding, fake/unselected host rejection, minimal Jira context/ADF plain-text conversion/email redaction/caps, `expand=transitions.fields`, supported field normalization, permission errors, fresh pre-write validation, exact payload construction, idempotency/replay/ambiguous outcomes, and 400/401/403/404/409/422/429/5xx/timeout/malformed-response mapping.
12. **CREATE** `github.com/sdcorejs/link-insight:{worker/src/atlassian.ts,worker/src/jira.ts}` - implement a request-scoped Atlassian client and Jira domain functions for only context, transition query, and confirmed transition execution; access tokens stay in memory, all upstream URLs are constructed internally from granted cloudId data, and raw upstream bodies never escape.
13. **EDIT** `github.com/sdcorejs/link-insight:{worker/src/index.ts,worker/src/http.ts}` - wire only `POST /v1/jira/context`, `POST /v1/jira/transitions/query`, and `POST /v1/jira/transitions/execute`; enforce authenticated session/site binding and freshly revalidate transition fields immediately before the write.

### Phase 4 - Trusted extension OAuth/session/Worker integration

14. **CREATE** `github.com/sdcorejs/link-insight:{tests/auth/jira-auth-client.test.ts,tests/storage/jira-settings-store.test.ts,tests/jira/jira-worker-client.test.ts,tests/background/jira-message-handler.test.ts,tests/security/jira-security-boundaries.test.ts}` - write RED tests for user-gesture-only launchWebAuthFlow orchestration, verifier/redirect/exchange validation, trusted local session/consent save/load/clear, token-in-header only, fixed Worker endpoints, sender/frame/URL/message revalidation, no automatic write retry, response requestId matching, and secret/session isolation from content/UI code.
15. **EDIT** `github.com/sdcorejs/link-insight:tests/security/source-boundaries.test.ts` - extend the existing static boundary test so content-script and UI imports cannot reach Jira session storage, chrome.storage, Atlassian/Worker secrets, or raw Worker fetch clients, and no protected key/token/header value is logged or embedded in URLs/fixtures.
16. **CREATE** `github.com/sdcorejs/link-insight:{src/auth/jira-auth-client.ts,src/storage/jira-settings-store.ts,src/jira/jira-worker-client.ts,src/background/jira-message-handler.ts}` - implement trusted-only OAuth/session persistence, validated fixed Worker fetches, connect/status/sites/disconnect/consent/context/transitions/execute message handling, and structured errors until tasks 14-15 are green.
17. **EDIT** `github.com/sdcorejs/link-insight:{entrypoints/background.ts,wxt.config.ts,src/core/message-contracts.ts,src/core/errors.ts,scripts/validate-manifest.mjs}` - synchronously register the Jira listener, add only `identity` and one exact HTTPS Worker host, keep Gemini permission exact, reject missing/invalid release Worker origins, and validate the actual built manifest contains no Atlassian/wildcard/unexpected permission.

### Phase 5 - Real Jira summary source and cache coherence

18. **CREATE** `github.com/sdcorejs/link-insight:tests/content-fetchers/jira-content-fetcher.test.ts` - write RED tests proving Jira requires connection, granted site, Gemini key, and explicit default-off consent; retrieves only real normalized Worker content; never falls back to mock Jira; minimizes comments; and exposes no raw content to the content script.
19. **EDIT** `github.com/sdcorejs/link-insight:{tests/background/summary-message-handler.test.ts,tests/content-fetchers/mock-atlassian-content-fetcher.test.ts,tests/storage/summary-cache.test.ts}` - add RED regressions for real Jira routing, unchanged mock Confluence, prompt-untrusted boundaries, exact three-bullet output, five-minute deduplication, and canonical-URL invalidation after a successful transition.
20. **CREATE** `github.com/sdcorejs/link-insight:src/content-fetchers/jira-content-fetcher.ts` - implement the real Jira `ContentFetcher` against `JiraWorkerClient`, with connection/consent/key gates and conversion only into the existing minimal `NormalizedLinkContent` contract.
21. **EDIT** `github.com/sdcorejs/link-insight:{src/background/summary-message-handler.ts,src/content-fetchers/content-fetcher-registry.ts,src/content-fetchers/mock-atlassian-content-fetcher.ts,src/storage/summary-cache.ts,src/storage/summary-request-coordinator.ts}` - register real Jira before Confluence mock, keep provider-agnostic resolution, add URL-scoped cache invalidation, preserve in-flight deduplication/stale behavior, and connect successful transitions to invalidation without caching errors.

### Phase 6 - Options Page connection, consent, and privacy controls

22. **CREATE** `github.com/sdcorejs/link-insight:tests/options/jira-options-controller.test.ts` - write RED jsdom tests for Connect Jira user gesture, busy/connected/reauthorize states, selected sites, Disconnect, independent default-off consent, aria-live success/error text without secrets, and privacy link behavior.
23. **EDIT** `github.com/sdcorejs/link-insight:{tests/options/options-controller.test.ts,tests/options/options-markup.test.ts}` - add RED regression/accessibility assertions that the original Gemini key save/load/clear contract remains intact and the new Jira controls have correct labels, relationships, target/rel attributes, and no session-token field.
24. **CREATE** `github.com/sdcorejs/link-insight:src/options/jira-options-controller.ts` - implement a page-local typed-message controller for connection/status/site/disconnect/consent flows; never read Jira session storage or echo OAuth/session values.
25. **EDIT** `github.com/sdcorejs/link-insight:{entrypoints/options/index.html,entrypoints/options/main.ts,entrypoints/options/style.css}` - compose the existing Gemini controller with Jira settings, responsive accessible controls, clear default-off disclosure, and public Worker privacy link while preserving the mandated Google AI Studio copy.

### Phase 7 - Separate Jira actions affordance and confirmed transition card

26. **CREATE** `github.com/sdcorejs/link-insight:{tests/ui/jira-action-controller.test.ts,tests/ui/jira-action-card.test.ts}` - write RED fake-timer/jsdom tests for affordance reachability, link-to-affordance movement, one reusable pinned card, close/Escape/focus, stale read/write responses, supported control rendering/validation, unsupported required fallback, exact confirmation view, no confirmation bypass, unique idempotency key, ambiguous outcome refresh, success status, and cache invalidation.
27. **EDIT** `github.com/sdcorejs/link-insight:tests/ui/hover-controller.test.ts` - add RED regressions proving the 500 ms dwell, child-element movement, immediate summary hide, link A/B stale protection, normal navigation, singleton popover, and pointer-events behavior remain correct when the Jira action port is present.
28. **CREATE** `github.com/sdcorejs/link-insight:{src/ui/jira-action-controller.ts,src/ui/jira-action-card.ts,src/ui/jira-action-card.css}` - implement the feature-local affordance/controller/card with textContent/createElement only, supported typed controls, explicit fallback link, confirmation-only write path, focus lifecycle, one DOM node per surface, request generations, and no automatic transition retry.
29. **EDIT** `github.com/sdcorejs/link-insight:{entrypoints/content.ts,src/ui/hover-controller.ts,src/ui/popover.css}` - compose the action controller via a narrow JiraActionsPort, preserve delegated hover and non-interactive Popover semantics, make link-to-affordance movement stable, and dispose both controllers on WXT invalidation without provider-specific Gemini/popover branches.

### Phase 8 - Privacy, operator documentation, and artifact validation

30. **CREATE** `github.com/sdcorejs/link-insight:PRIVACY.md` - document Cloudflare/D1 processing, Atlassian OAuth, exact Jira fields/three-comment transfer, Gemini opt-in/BYOK limitations, 30-day inactivity cleanup, disconnect controls, no telemetry, and the fact that extension updates can access locally stored credentials.
31. **EDIT** `github.com/sdcorejs/link-insight:{README.md,scripts/validate-manifest.mjs}` - document architecture, local Worker/D1 setup, non-secret build configuration, secret-name setup without sample values, Atlassian app/Unlisted ID callback steps, local migration/test/build/load-unpacked flow, exact permissions, action UX, troubleshooting, mock Confluence, manual deployment sequence, rollback/disconnect, and out-of-scope items; make manifest validation inspect test and release outputs explicitly.

### Phase 9 - Focused, broad, and branch-ready verification

32. **VERIFY** `github.com/sdcorejs/link-insight:{tests/**,worker/test/**}` - run the focused contract/OAuth/session/Jira/summary/options/action/security suites after each GREEN slice, then run `npm run worker:migrate:local`, `npm run worker:test`, `npm run worker:typecheck`, and `npm run worker:build`; fix only plan-scoped failures and rerun until green.
33. **VERIFY** `github.com/sdcorejs/link-insight:.` - run `npm run check`, `npm run zip`, and `npm audit --audit-level=high`; inspect `.output/chrome-mv3/manifest.json` and ZIP contents for MV3, service worker/options/content entries, only `storage`+`identity`, exact Gemini+configured Worker hosts, no Atlassian/wildcard permissions, no remote code, and no secret/dev files.
34. **VERIFY** `github.com/sdcorejs/link-insight:.` - record manual criteria AC-035..AC-038 as not executed unless the user separately authorizes Cloudflare resource creation/deploy and supplies credentials through their own browser/CLI; prepare exact workers.dev/D1/secrets/Atlassian/Unlisted smoke steps, then run the final `sdcorejs-ship` branch-readiness gate with no writes afterward. Do not claim live OAuth, Jira write, or Gemini success without that evidence.

## Acceptance mapping

- AC-001 -> tasks 22-25, 31-33
- AC-002 -> tasks 14, 16, 18, 22, 24-25, 32
- AC-003 -> tasks 7, 14, 16, 22, 24, 32
- AC-004 -> tasks 4-7, 9-10, 14, 16, 32
- AC-005 -> tasks 7, 9-10, 31-32
- AC-006 -> tasks 7, 9-10, 14-17, 30-33
- AC-007 -> tasks 7-10, 14-16, 32
- AC-008 -> tasks 7-10, 32
- AC-009 -> tasks 7, 9-10, 14, 16, 22, 24-25, 32
- AC-010 -> tasks 7-10, 32
- AC-011 -> tasks 4-5, 7, 9-13, 32
- AC-012 -> tasks 4-5, 7, 9, 11-13, 32-33
- AC-013 -> tasks 4-5, 7, 9-10, 13, 32
- AC-014 -> tasks 4-5, 7, 9, 11-13, 31-33
- AC-015 -> tasks 4-5, 11-13, 18-21, 32
- AC-016 -> tasks 4-6, 11-13, 18-21, 32
- AC-017 -> tasks 14, 16, 18-21, 22-25, 32
- AC-018 -> tasks 18-21, 27, 29, 32
- AC-019 -> tasks 18-21, 32
- AC-020 -> tasks 19, 21, 27, 29, 32
- AC-021 -> tasks 19, 21, 26-29, 32
- AC-022 -> tasks 26-29, 32
- AC-023 -> tasks 26-29, 32
- AC-024 -> tasks 26-29, 32
- AC-025 -> tasks 11-13, 14, 16, 26, 28-29, 32
- AC-026 -> tasks 4-6, 11-13, 26, 28-29, 32
- AC-027 -> tasks 11-13, 26, 28-29, 32
- AC-028 -> tasks 4-6, 11-13, 26, 28-29, 32
- AC-029 -> tasks 11-13, 26, 28, 32
- AC-030 -> tasks 4-6, 11-17, 26, 28-29, 32
- AC-031 -> tasks 11-13, 19, 21, 26, 28-29, 32
- AC-032 -> tasks 4-7, 9, 11-21, 22, 24, 26, 28, 32
- AC-033 -> tasks 2-3, 17, 31, 33
- AC-034 -> tasks 2-33
- AC-035 [Manual] -> tasks 30-31, 34
- AC-036 [Manual] -> tasks 11-13, 31, 34
- AC-037 [Manual] -> tasks 18-25, 30-31, 34
- AC-038 [Manual] -> tasks 11-17, 22-31, 34

## Verification

- Focused RED/GREEN: `npm test -- tests/core/worker-api-contracts.test.ts tests/auth/jira-auth-client.test.ts tests/storage/jira-settings-store.test.ts tests/jira/jira-worker-client.test.ts tests/background/jira-message-handler.test.ts tests/content-fetchers/jira-content-fetcher.test.ts tests/options/jira-options-controller.test.ts tests/ui/jira-action-controller.test.ts tests/ui/jira-action-card.test.ts tests/security/jira-security-boundaries.test.ts` and `npm run worker:test` after each test-first slice.
- Worker local proof: `npm run worker:migrate:local`, `npm run worker:typecheck`, `npm run worker:test`, `npm run worker:build`.
- Repository gate: `npm run check`.
- Distribution proof: `npm run zip`, built-manifest/ZIP inspection, and `npm audit --audit-level=high`.
- Manual, separately authorized: configure a real D1/database ID and four Worker secrets, deploy workers.dev, register exact Atlassian/Unlisted callback identities, then exercise connect/site binding/consent/real summary/confirmed transition/disconnect with user-owned test credentials.

## Review decisions

- Keep one repository and one package manager; the Worker is a subproject with isolated TypeScript/Vitest configs, not a second npm package.
- Use native runtime validators and Web Crypto; do not add a framework, ORM, validation dependency, UI framework, generic proxy, or one renderer class per field type.
- A test-mode reserved Worker origin and local-only D1 sentinel may support deterministic offline checks, but release build/deploy must fail closed until the exact workers.dev origin and real D1 ID are supplied.
- Plan approval explicitly authorizes the listed package/lock/config/migration writes and secret/configuration **names**, never any secret value or remote mutation.
- Sequential execution is intentional; no subagent or parallel unit is authorized by this plan.

## Decisions captured during review

- Approved as drafted.

## Skill provenance

sdcorejs-plan (approved on attempt 1 / 3)
