import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(import.meta.dirname, '../..');

describe('Jira trusted-context boundaries', () => {
  it('keeps Jira sessions, Worker fetches, and storage APIs outside content/UI source', async () => {
    const paths = [
      'entrypoints/content.ts',
      'src/ui/hover-controller.ts',
      'src/ui/popover.ts',
      'src/ui/jira-action-controller.ts',
      'src/ui/jira-action-card.ts',
      'src/core/message-contracts.ts',
    ];
    for (const relativePath of paths) {
      const source = await readFile(path.join(ROOT, relativePath), 'utf8');
      expect(source, relativePath).not.toContain('jiraInstallationSession');
      expect(source, relativePath).not.toContain('chrome.storage');
      expect(source, relativePath).not.toContain('Authorization');
      expect(source, relativePath).not.toMatch(/\bfetch\s*\(/u);
    }
  });

  it('keeps runtime request and idempotency orchestration out of the Jira card view', async () => {
    const card = await readFile(path.join(ROOT, 'src/ui/jira-action-card.ts'), 'utf8');
    const controller = await readFile(path.join(ROOT, 'src/ui/jira-action-controller.ts'), 'utf8');

    expect(card).not.toContain('JiraRuntimeRequest');
    expect(card).not.toContain('sendMessage');
    expect(card).not.toContain('createIdempotencyKey');
    expect(controller).toContain('JIRA_TRANSITION_EXECUTE_REQUEST');
  });

  it('uses valid typography and 44px minimum interactive targets in the Jira action UI', async () => {
    const css = await readFile(path.join(ROOT, 'src/ui/jira-action-card.css'), 'utf8');

    expect(css).not.toContain('font: 700 13px/1.25 inherit');
    expect(css).not.toMatch(/min-height:\s*(?:32|36|40)px/u);
  });
});
