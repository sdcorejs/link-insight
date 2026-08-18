# Chrome Web Store Listing Assets Design

## Goal

Create a truthful, polished English Chrome Web Store listing package for SdCoreJS Link Insight that a publisher can copy into the dashboard and upload without additional image editing.

## Approved direction

- Language: English.
- Visual direction: **Insight Signal**.
- Palette: deep navy (`#080f24`, `#111c3a`) with cyan and blue accents (`#67e8f9`, `#60a5fa`).
- Personality: focused productivity tool, professional rather than playful, readable at thumbnail sizes.
- Asset scope: one 128×128 store icon, three 1280×800 screenshots, and one 440×280 small promotional tile.
- Third-party logos are intentionally omitted. Product surfaces may be named in truthful copy, but the artwork must not imply endorsement by Google or Atlassian.

## Store fields

### Name

`SdCoreJS Link Insight`

### Summary

`AI summaries for supported work-item links in Google Chat.`

### Category and language

- Category: Productivity
- Language: English

### Description

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

## Asset story

### Store icon — 128×128

A compact link-and-spark mark on a navy field. It must remain recognizable at small sizes, contain no text, and use generous edge padding.

### Screenshot 1 — Understand work in seconds

- Headline: `Understand work-item links without leaving the conversation.`
- Supporting line: `Hover. Pause. Get three concise bullets.`
- Show a sanitized conversation surface, a fictional `acme.atlassian.net/browse/DEV-142` link, and a Link Insight popover with exactly three bullets.
- This is the primary screenshot and must make the 500 ms hover-summary behavior immediately understandable.

### Screenshot 2 — Complete Jira transitions safely

- Headline: `Move Jira work forward from the conversation.`
- Supporting line: `Supported fields are completed before anything changes.`
- Show the separate Jira action card with a transition selector, destination status, a required field, an optional comment, and `Review transition`.
- Do not imply one-click or automatic Jira changes.

### Screenshot 3 — Keep credentials and consent under your control

- Show the real Options-page concepts: concealed Gemini API-key input, Save and Clear key controls, connected Jira site, disconnect control, and explicit Jira-to-Gemini consent.
- Never include a realistic credential, OAuth token, personal data, or production tenant.

### Small promotional tile — 440×280

- Brand line: `SdCoreJS Link Insight`
- Headline: `Understand links. Move work forward.`
- Supporting line: `AI summaries and confirmed Jira actions inside Google Chat.`
- Use an image-generated abstract link/spark motif on the right, with deterministic HTML/CSS text composited on top so spelling remains exact.

## Production approach

- Generate one abstract, text-free navy/cyan marketing motif with the built-in image-generation tool.
- Build the icon, screenshot layouts, and text overlays as deterministic HTML/CSS source under `store-assets/source/`.
- Render each canvas with local headless Chrome at its exact output dimensions.
- Flatten screenshot and promotional PNGs to 24-bit RGB with no alpha channel.
- Keep final uploadable files under `store-assets/final/` and include a README with field copy and upload mapping.

## Validation

- Inspect every rendered asset visually.
- Verify exact pixel dimensions and PNG color type.
- Verify screenshot and promo images have no alpha channel.
- Verify all visible text matches this design and no secrets or personal data appear.
- Verify the listing description discloses Confluence demo content and Gemini BYOK limitations.
- Run the repository formatting check after adding source and documentation files.
