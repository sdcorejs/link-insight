import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },
});
