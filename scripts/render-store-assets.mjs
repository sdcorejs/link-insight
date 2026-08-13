import { spawn } from 'node:child_process';
import { constants as fsConstants } from 'node:fs';
import { access, mkdir, mkdtemp, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDocument = path.join(projectRoot, 'store-assets', 'source', 'listing-assets.html');
const outputDirectory = path.join(projectRoot, 'store-assets', 'final');

const assets = [
  ['icon', 128, 128, 'sdcorejs-link-insight-icon-128.png'],
  ['screenshot-01', 1280, 800, 'screenshot-01-hover-summary.png'],
  ['screenshot-02', 1280, 800, 'screenshot-02-jira-transition.png'],
  ['screenshot-03', 1280, 800, 'screenshot-03-settings-privacy.png'],
  ['promo-small', 440, 280, 'promo-small-440x280.png'],
];

const chromePath = await findChrome();
await access(sourceDocument, fsConstants.R_OK);
await mkdir(outputDirectory, { recursive: true });

for (const [id, width, height, filename] of assets) {
  const profileDirectory = await mkdtemp(path.join(os.tmpdir(), 'sdcorejs-link-insight-assets-'));
  const outputPath = path.join(outputDirectory, filename);
  const sourceUrl = new URL(pathToFileURL(sourceDocument));
  sourceUrl.searchParams.set('asset', id);

  try {
    await rm(outputPath, { force: true });
    await runChrome(chromePath, [
      '--headless=new',
      '--disable-background-networking',
      '--disable-default-apps',
      '--disable-extensions',
      '--disable-gpu',
      '--disable-sync',
      '--hide-scrollbars',
      '--no-first-run',
      '--run-all-compositor-stages-before-draw',
      '--force-device-scale-factor=1',
      '--virtual-time-budget=1000',
      `--user-data-dir=${profileDirectory}`,
      `--window-size=${width},${height}`,
      `--screenshot=${outputPath}`,
      sourceUrl.href,
    ]);

    const output = await stat(outputPath);
    if (!output.isFile() || output.size < 1_024) {
      throw new Error(`Chrome did not produce a usable screenshot for ${id}.`);
    }
    console.log(`Rendered ${filename} (${width}x${height})`);
  } finally {
    await rm(profileDirectory, { recursive: true, force: true });
  }
}

async function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    process.platform === 'win32'
      ? path.join(
          process.env.PROGRAMFILES ?? 'C:\\Program Files',
          'Google',
          'Chrome',
          'Application',
          'chrome.exe',
        )
      : undefined,
    process.platform === 'win32' && process.env['PROGRAMFILES(X86)']
      ? path.join(process.env['PROGRAMFILES(X86)'], 'Google', 'Chrome', 'Application', 'chrome.exe')
      : undefined,
    process.platform === 'win32' && process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe')
      : undefined,
    process.platform === 'darwin'
      ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
      : undefined,
    process.platform === 'linux' ? '/usr/bin/google-chrome' : undefined,
    process.platform === 'linux' ? '/usr/bin/google-chrome-stable' : undefined,
    process.platform === 'linux' ? '/usr/bin/chromium' : undefined,
    process.platform === 'linux' ? '/usr/bin/chromium-browser' : undefined,
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      await access(candidate, fsConstants.X_OK);
      return candidate;
    } catch {
      // Continue to the next well-known path.
    }
  }

  throw new Error(
    'Google Chrome was not found. Install Chrome or set CHROME_PATH to its executable.',
  );
}

function runChrome(executable, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';

    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `Chrome exited with code ${String(code)}.${stderr.trim() === '' ? '' : ` ${stderr.trim()}`}`,
        ),
      );
    });
  });
}
