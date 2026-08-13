import { jsonResponse, securityHeaders } from './http';

const PRIVACY_HTML = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>SdCoreJS Link Insight privacy</title></head>
  <body>
    <main>
      <h1>SdCoreJS Link Insight privacy</h1>
      <p>Jira access uses Atlassian OAuth. OAuth credentials are kept by this Cloudflare Worker, not the Google Chat content script.</p>
      <p>Cloudflare D1 stores only opaque session hashes, encrypted rotating refresh tokens, selected Jira site metadata, and short-lived security records.</p>
      <p>When you explicitly enable Jira AI summaries, approved Jira fields and up to three newest plain-text comments are sent to Google Gemini using your locally stored API key.</p>
      <p>Inactive installation records are removed after 30 days. Use Disconnect Jira in the extension settings to delete the connected installation earlier.</p>
      <p>No telemetry is collected.</p>
    </main>
  </body>
</html>`;

export function createHealthResponse(): Response {
  return jsonResponse({ status: 'ok' });
}

export function createPrivacyResponse(): Response {
  const headers = securityHeaders();
  headers.set('Content-Type', 'text/html; charset=utf-8');
  headers.set(
    'Content-Security-Policy',
    "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  );
  return new Response(PRIVACY_HTML, { status: 200, headers });
}
