import { defineConfig } from 'wxt';

import { parseWorkerOrigin, TEST_WORKER_ORIGIN } from './src/config/runtime-config';

const workerOrigin = parseWorkerOrigin(process.env.WXT_WORKER_ORIGIN ?? TEST_WORKER_ORIGIN);

export default defineConfig({
  manifest: {
    name: 'SdCoreJS Link Insight',
    description: 'AI summaries for supported work-item links in Google Chat.',
    version: '0.1.0',
    minimum_chrome_version: '102',
    permissions: ['storage', 'identity'],
    host_permissions: ['https://generativelanguage.googleapis.com/*', `${workerOrigin}/*`],
    action: {
      default_title: 'Open SdCoreJS Link Insight settings',
    },
  },
});
