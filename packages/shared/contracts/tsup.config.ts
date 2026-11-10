import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  // tsup's declaration build injects `baseUrl`, which TypeScript 6 deprecates (TS5101). Silence it
  // for this build only, until tsup stops adding it.
  dts: { compilerOptions: { ignoreDeprecations: '6.0' } },
  clean: true,
});
