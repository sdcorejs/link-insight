import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '.output/**',
      '.wxt/**',
      '.wrangler/**',
      'coverage/**',
      'node_modules/**',
      'worker/dist/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.mjs'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
      },
    },
  },
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    files: ['worker/**/*.ts'],
    languageOptions: {
      globals: {
        crypto: 'readonly',
        fetch: 'readonly',
      },
    },
  },
  {
    files: ['worker/test/setup.ts'],
    rules: {
      '@typescript-eslint/no-namespace': 'off',
    },
  },
);
