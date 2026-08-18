# Chrome Web Store publisher handoff

This folder contains the English listing copy and upload-ready artwork for **SdCoreJS Link Insight**.

## Product details

| Dashboard field | Value                                                        |
| --------------- | ------------------------------------------------------------ |
| Name            | `SdCoreJS Link Insight`                                      |
| Summary         | `AI summaries for supported work-item links in Google Chat.` |
| Category        | `Productivity`                                               |
| Language        | `English`                                                    |
| Visibility      | `Unlisted`                                                   |

## Description

Copy everything inside this block into the **Description** field:

```text
Work-item links in chat often interrupt focus. SdCoreJS Link Insight adds concise AI previews and carefully confirmed Jira workflow actions directly to Google Chat.

WHAT IT DOES

• Hover over a supported Jira or Confluence link for 500 ms.
• See a concise, three-bullet summary generated with Google Gemini.
• For a connected Jira Cloud issue, open a separate Jira actions card, choose an available transition, complete supported required fields, review the exact values, and explicitly confirm the change.
• Configure your Gemini API key and Jira connection from the extension Options page.

PRIVACY AND CONTROL

• Bring Your Own Key: your Gemini API key is stored locally in chrome.storage.local and restricted to trusted extension contexts.
• The Google Chat content script never receives your Gemini API key.
• Jira content is sent to Gemini only after you enable the separate Jira AI-summary consent setting.
• Gemini is called directly with your key. Google quota or pricing may apply.
• No telemetry or analytics are included.
• AI summaries may be inaccurate. Verify important details in the source work item.

CURRENT PREVIEW LIMITATIONS

• Jira features require a connection to an approved Jira Cloud site through the configured companion service.
• Confluence summaries currently use deterministic demo content; live Confluence authentication and API retrieval are not included in this version.
• GitLab and other providers are not included yet.

SUPPORTED GOOGLE CHAT PAGES

• https://chat.google.com/*
• https://mail.google.com/chat/*

SdCoreJS Link Insight is an independent extension and is not affiliated with or endorsed by Google or Atlassian.
```

## Graphic asset upload mapping

Upload files from [`final/`](./final/) in this order:

| Chrome Web Store field | File                                 | Size     |
| ---------------------- | ------------------------------------ | -------- |
| Store icon             | `sdcorejs-link-insight-icon-128.png` | 128×128  |
| Screenshot 1           | `screenshot-01-hover-summary.png`    | 1280×800 |
| Screenshot 2           | `screenshot-02-jira-transition.png`  | 1280×800 |
| Screenshot 3           | `screenshot-03-settings-privacy.png` | 1280×800 |
| Small promotional tile | `promo-small-440x280.png`            | 440×280  |

The files are 24-bit RGB PNGs with no alpha channel. All tenant, person, issue, and conversation data shown in the screenshots is fictional.

## Important publish gate

The Jira screenshots and Jira-action description are appropriate only when the release package points to a deployed companion Worker and its Jira OAuth flow has been manually verified. Before uploading that release:

1. Deploy and configure the Cloudflare Worker and D1 database.
2. Configure the Atlassian OAuth app for the final extension ID.
3. Build with the exact deployed origin using `WXT_WORKER_ORIGIN` and `npm run build:release`.
4. Verify Jira connect, context retrieval, transition fields, review, confirmation, and disconnect with a permitted test issue.

If that integration is not ready, save the listing as a draft. Do not submit a package that advertises Jira actions while using the reserved `https://link-insight.invalid` Worker origin.

## Regenerate and validate

Google Chrome must be installed. Then run:

```bash
npm run store:assets
```

To validate existing PNGs without regenerating them:

```bash
npm run store:assets:validate
```

The deterministic HTML/CSS compositions are under [`source/`](./source/). The marketing motif was created with the built-in image-generation tool and then composited behind deterministic HTML text so the visible copy remains exact.
