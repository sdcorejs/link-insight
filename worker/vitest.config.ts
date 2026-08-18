import path from 'node:path';

import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

const workerRoot = import.meta.dirname;

export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      wrangler: {
        configPath: path.join(workerRoot, 'wrangler.jsonc'),
      },
      miniflare: {
        bindings: {
          TEST_MIGRATIONS: await readD1Migrations(path.join(workerRoot, 'migrations')),
          ATLASSIAN_CLIENT_ID: 'unit-test-only',
          ATLASSIAN_CLIENT_SECRET: 'unit-test-only',
          TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
          SESSION_HMAC_KEY: Buffer.alloc(32, 11).toString('base64'),
        },
      },
    })),
  ],
  test: {
    clearMocks: true,
    restoreMocks: true,
    include: ['worker/test/**/*.test.ts'],
    setupFiles: ['worker/test/setup.ts'],
  },
});
