import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'SdCoreJS Link Insight',
    description: 'AI summaries for supported work-item links in Google Chat.',
    version: '0.1.0',
    minimum_chrome_version: '102',
    permissions: ['storage'],
    host_permissions: ['https://generativelanguage.googleapis.com/*'],
    action: {
      default_title: 'Open SdCoreJS Link Insight settings',
    },
  },
});
