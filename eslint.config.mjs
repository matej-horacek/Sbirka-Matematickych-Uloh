// ESLint (flat config): typescript-eslint recommended rules for the API source, tests and scripts.
// Added by the overnight run so `verify` has a lint step; no project-specific style rules.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/dist/**', '**/coverage/**', 'packages/shared/contracts/src/generated/**'] },
  {
    files: ['apps/api/src/**/*.ts', 'apps/api/test/**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { globals: { ...globals.node, ...globals.jest } },
  },
  {
    files: ['scripts/**/*.{js,mjs,cjs}', 'apps/api/jest.config.js'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },
);
