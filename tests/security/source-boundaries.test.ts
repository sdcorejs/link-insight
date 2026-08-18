import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(import.meta.dirname, '../..');

describe('production source security boundaries', () => {
  it('keeps storage and geminiApiKey out of content-script code', async () => {
    const contentBoundaryFiles = [
      'entrypoints/content.ts',
      'src/ui/hover-controller.ts',
      'src/ui/popover.ts',
      'src/link-providers/atlassian-link-provider.ts',
      'src/link-providers/link-provider-registry.ts',
      'src/link-providers/link-provider.ts',
      'src/core/message-contracts.ts',
      'src/core/summary-validation.ts',
      'src/core/contracts.ts',
    ];

    for (const relativePath of contentBoundaryFiles) {
      const source = await readFile(path.join(ROOT, relativePath), 'utf8');
      expect(source, relativePath).not.toContain('chrome.storage');
      expect(source, relativePath).not.toContain('geminiApiKey');
    }
  });

  it('does not use unsafe HTML injection or dynamic code execution', async () => {
    const files = await productionFiles();

    for (const file of files) {
      const source = await readFile(file, 'utf8');
      expect(source, file).not.toMatch(/\.innerHTML\s*=/u);
      expect(source, file).not.toMatch(/\beval\s*\(/u);
      expect(source, file).not.toMatch(/\bnew\s+Function\s*\(/u);
    }
  });

  it('contains no remote executable script references', async () => {
    const html = await readFile(path.join(ROOT, 'entrypoints/options/index.html'), 'utf8');

    expect(html).not.toMatch(/<script[^>]+src=["']https?:\/\//iu);
  });

  it('contains no production console logging', async () => {
    const files = await productionFiles();

    for (const file of files.filter((candidate) => candidate.endsWith('.ts'))) {
      const source = await readFile(file, 'utf8');
      expect(source, file).not.toMatch(/\bconsole\./u);
    }
  });
});

async function productionFiles(): Promise<string[]> {
  return [
    ...(await walk(path.join(ROOT, 'src'))),
    ...(await walk(path.join(ROOT, 'entrypoints'))),
  ].filter((file) => /\.(?:ts|html)$/u.test(file));
}

async function walk(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(absolutePath)));
    } else {
      files.push(absolutePath);
    }
  }

  return files;
}
