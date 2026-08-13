import { Buffer } from 'node:buffer';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = path.join(projectRoot, 'store-assets', 'final');

const assets = [
  ['sdcorejs-link-insight-icon-128.png', 128, 128],
  ['screenshot-01-hover-summary.png', 1280, 800],
  ['screenshot-02-jira-transition.png', 1280, 800],
  ['screenshot-03-settings-privacy.png', 1280, 800],
  ['promo-small-440x280.png', 440, 280],
];

const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

for (const [filename, expectedWidth, expectedHeight] of assets) {
  const assetPath = path.join(outputDirectory, filename);
  const metadata = await stat(assetPath);
  const bytes = await readFile(assetPath);

  assert(metadata.isFile(), `${filename} is not a file.`);
  assert(metadata.size >= 1_024, `${filename} is unexpectedly small.`);
  assert(bytes.subarray(0, 8).equals(pngSignature), `${filename} is not a PNG file.`);
  assert(bytes.toString('ascii', 12, 16) === 'IHDR', `${filename} has no leading IHDR chunk.`);

  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  const bitDepth = bytes[24];
  const colorType = bytes[25];

  assert(
    width === expectedWidth && height === expectedHeight,
    `${filename} is ${width}x${height}; expected ${expectedWidth}x${expectedHeight}.`,
  );
  assert(bitDepth === 8, `${filename} must use 8-bit channels; found ${bitDepth}.`);
  assert(
    colorType === 2,
    `${filename} must be 24-bit RGB with no alpha; found color type ${colorType}.`,
  );

  console.log(`Valid ${filename}: ${width}x${height}, 24-bit RGB, ${metadata.size} bytes`);
}

const sourcePaths = [
  path.join(projectRoot, 'store-assets', 'source', 'listing-assets.html'),
  path.join(projectRoot, 'store-assets', 'source', 'listing-assets.css'),
];
const source = (
  await Promise.all(sourcePaths.map((sourcePath) => readFile(sourcePath, 'utf8')))
).join('\n');

assert(
  !/<(?:script|link)[^>]+(?:src|href)=["']https?:\/\//iu.test(source),
  'Store assets must not load remote scripts or styles.',
);
assert(!/AIza[\w-]{20,}/u.test(source), 'Store assets contain a credential-shaped API key.');
assert(!/Bearer\s+[\w.-]{20,}/iu.test(source), 'Store assets contain a bearer-token-shaped value.');
assert(
  countMatches(source, /<li>/gu) === 3,
  'The hover-summary screenshot must contain exactly three bullet items.',
);
assert(source.includes('Review transition'), 'The Jira screenshot must show a review step.');
assert(
  source.includes('acme.atlassian.net'),
  'Screenshots must use the approved fictional Atlassian hostname.',
);

console.log('Store asset source security and content checks passed.');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function countMatches(value, pattern) {
  return [...value.matchAll(pattern)].length;
}
