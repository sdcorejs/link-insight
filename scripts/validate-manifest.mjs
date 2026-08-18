import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { URL } from 'node:url';

const testWorkerOrigin = 'https://link-insight.invalid';
const workerOrigin = parseWorkerOrigin(process.env.WXT_WORKER_ORIGIN ?? testWorkerOrigin);
if (process.argv.includes('--release-config')) {
  if (process.env.WXT_WORKER_ORIGIN === undefined || workerOrigin === testWorkerOrigin) {
    throw new Error(
      'Release build requires WXT_WORKER_ORIGIN set to the deployed HTTPS Worker origin.',
    );
  }
  process.stdout.write(`Validated release Worker origin: ${workerOrigin}\n`);
  process.exit(0);
}

const manifestPath = path.resolve('.output/chrome-mv3/manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

const expectedMatches = ['https://mail.google.com/chat/*', 'https://chat.google.com/*'];
const expectedPermissions = ['storage', 'identity'];
const expectedHosts = ['https://generativelanguage.googleapis.com/*', `${workerOrigin}/*`];

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Built manifest validation failed: ${message}`);
  }
}

assert(manifest.manifest_version === 3, 'manifest_version must be 3');
assert(manifest.name === 'SdCoreJS Link Insight', 'unexpected extension name');
assert(manifest.minimum_chrome_version === '102', 'minimum Chrome version must be 102');
assert(
  sameMembers(manifest.permissions ?? [], expectedPermissions),
  'permissions must contain only storage and identity',
);
assert(
  sameMembers(manifest.host_permissions ?? [], expectedHosts),
  'host_permissions must contain only Gemini and the configured Worker origin',
);
assert(
  typeof manifest.background?.service_worker === 'string',
  'background service worker missing',
);
assert(manifest.options_ui?.page === 'options.html', 'options page missing');
assert(manifest.options_ui?.open_in_tab === true, 'options page must open in a tab');
assert(
  manifest.action?.default_title === 'Open SdCoreJS Link Insight settings',
  'toolbar action title missing',
);
assert(Array.isArray(manifest.content_scripts), 'content script missing');
assert(manifest.content_scripts.length === 1, 'unexpected content script count');

const contentScript = manifest.content_scripts[0];
assert(
  sameMembers(contentScript.matches, expectedMatches),
  'content-script matches differ from the allowlist',
);
assert(contentScript.run_at === 'document_idle', 'content script must run at document_idle');
assert(contentScript.all_frames !== true, 'content script must not run in all frames');

const extensionCsp = manifest.content_security_policy?.extension_pages;
assert(
  typeof extensionCsp !== 'string' || !/https?:\/\//u.test(extensionCsp),
  'extension CSP unexpectedly allows remote executable sources',
);

process.stdout.write(`Validated built manifest: ${manifestPath}\n`);
process.exitCode = 0;

function sameMembers(actual, expected) {
  return (
    Array.isArray(actual) &&
    actual.length === expected.length &&
    [...actual].sort().every((value, index) => value === [...expected].sort()[index])
  );
}

function parseWorkerOrigin(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('WXT_WORKER_ORIGIN must be an absolute HTTPS origin.');
  }
  if (
    url.protocol !== 'https:' ||
    url.username !== '' ||
    url.password !== '' ||
    url.port !== '' ||
    url.pathname !== '/' ||
    url.search !== '' ||
    url.hash !== ''
  ) {
    throw new Error('WXT_WORKER_ORIGIN must be an exact HTTPS origin.');
  }
  return url.origin;
}
