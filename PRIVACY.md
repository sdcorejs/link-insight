# SdCoreJS Link Insight Privacy Notice

Last updated: August 13, 2026

SdCoreJS Link Insight runs in Google Chat and can summarize supported links or help a user perform a confirmed Jira workflow transition. It does not include telemetry, analytics, advertising, or an extension account system.

## Data processing

For Jira Cloud, the extension uses Atlassian OAuth through a dedicated Cloudflare Worker. The Worker requests only `offline_access`, `read:jira-work`, and `write:jira-work`. It calls Jira as the connected Atlassian user and limits its API surface to connection status, disconnect, issue context, transition discovery, and confirmed transition execution.

For a Jira summary, the Worker returns only the issue key, summary, description, issue type, status, priority, assignee display name, labels, and up to three newest comments. Comments are converted to plain text and limited to 1,000 characters each. Author details, email fields, account identifiers, attachment data, changelog data, and link targets are omitted. Obvious email-like strings are redacted and the complete summary context has a fixed size limit.

Jira data is sent to Google Gemini only after the user saves their own Gemini API key and explicitly enables **Allow Jira content in Gemini summaries**. The consent is off by default and can be disabled without disconnecting Jira. Transition form values and comments entered for a transition are never sent to Gemini.

Confluence content remains deterministic mock data in this version. The extension does not authenticate to or fetch from Confluence.

## Storage

The trusted extension context stores the user-provided Gemini API key, an opaque Worker installation session, selected Jira hostnames, and the Jira-to-Gemini consent setting in `chrome.storage.local`. Local storage is restricted to trusted extension contexts with `TRUSTED_CONTEXTS`; the Google Chat content script cannot read these values. Validated AI summaries are cached in `chrome.storage.session` for five minutes.

Cloudflare D1 stores opaque installation identifiers, hashes of session tokens, versioned AES-GCM encrypted rotating refresh tokens, approved Jira `cloudId`/site display metadata, timestamps, short-lived OAuth/exchange state, refresh leases, rate-limit windows, and opaque idempotency records. D1 does not store Jira issue content, issue URLs, transition field values, transition comments, Gemini prompts, Gemini output, Atlassian access tokens, or raw extension session tokens.

Inactive Worker installations are deleted after 30 days. Expired OAuth state, exchange codes, refresh leases, rate-limit windows, and idempotency records are cleaned separately. **Disconnect Jira** deletes the local installation session and asks the Worker to delete the associated installation, grant, and site records immediately.

## BYOK limitations

The Gemini key is stored locally for a local/internal MVP. `chrome.storage.local` is not a hardware-backed secret vault. A person with sufficient operating-system or Chrome-profile access may be able to recover local extension data. The installed extension, including a future compromised extension update, can also access locally stored credentials. Use an authorized key created through Google AI Studio, apply available restrictions, monitor usage, and revoke it if the device or extension is compromised.

Gemini requests use `store: false`, but Google still processes submitted content under the applicable Gemini API terms, policies, quota, and pricing. Confirm that sending your organization's Jira content to Google Gemini is permitted before enabling consent.

## User controls

- **Clear key** removes the Gemini API key from this Chrome profile.
- **Allow Jira content in Gemini summaries** independently enables or disables Jira-to-Gemini transfer.
- **Disconnect Jira** removes the trusted local Jira session and requests deletion of the Worker-side installation records.
- Atlassian access can also be revoked through the connected user's Atlassian account controls.

The public Worker privacy response contains the same high-level disclosures. No credentials are required to read it.
