import { defineConfig } from '@hey-api/openapi-ts';

// Generates TypeScript types and Zod schemas from the API spec.
// Change openapi.yaml, then run `npm run generate`.
export default defineConfig({
  input: './openapi.yaml',
  output: { path: './src/contracts/generated' },
  plugins: ['@hey-api/typescript', 'zod'],
});
