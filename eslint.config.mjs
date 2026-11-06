// ESLint (flat config): typescript-eslint recommended rules for the API source, tests and scripts.
// Added by the overnight run so `verify` has a lint step; no project-specific style rules.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      'packages/shared/contracts/src/generated/**',
      // apps/web has its own ESLint config (Vue + oxlint); linted by `pnpm --filter web lint`.
      'apps/web/**',
    ],
  },
  {
    files: ['apps/api/src/**/*.ts', 'apps/api/test/**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { globals: { ...globals.node, ...globals.jest } },
  },
  {
    // The TODO-Daniel stubs keep their (unused) parameters so the signatures read like the interface.
    files: ['apps/api/src/**/prisma-*.repository.ts'],
    rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }] },
  },
  {
    files: ['scripts/**/*.{js,mjs,cjs}', 'apps/api/jest.config.cjs', 'apps/api/test/support/*.cjs'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },
);
