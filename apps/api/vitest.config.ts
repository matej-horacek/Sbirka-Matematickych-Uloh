// Vitest (replaces Jest). Tests live in test/, helpers in test/support/.
//   *.e2e-spec.ts  HTTP tests through the real AppModule (contract + store checks)
//   *.spec.ts      fast unit tests (helpers, pure domain rules)
// UNSKIP=1 (pnpm test:unskipped) runs it.skip tests too, see unskipPlugin below.
import swc from 'unplugin-swc';
import { defineConfig, type Plugin } from 'vitest/config';

// it.skip(…) → it(…), it.skip.each(…)(…) → it.each(…)(…). Proves which skipped tests fail today
// (a finding is real) and which already pass (the mock caught up: remove the `.skip`).
const SKIP = /\bit\.skip(?=[.(])/g;
const unskipPlugin: Plugin = {
  name: 'unskip-tests',
  enforce: 'pre',
  transform(code, id) {
    if (!process.env.UNSKIP || !id.endsWith('.ts')) return null;
    return { code: code.replace(SKIP, 'it'), map: null };
  },
};

export default defineConfig({
  plugins: [
    unskipPlugin,
    // esbuild (Vite's default) does not emit decorator metadata, which Nest's DI needs. SWC does.
    // It reads experimentalDecorators / emitDecoratorMetadata from tsconfig.json.
    swc.vite({ module: { type: 'es6' } }),
  ],
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.spec.ts', 'test/**/*.e2e-spec.ts'],
    // Separate processes (not threads), two at a time: memory guard, a runaway test once exhausted all RAM.
    pool: 'forks',
    maxWorkers: 2,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/main.ts', 'src/generated/**'],
      reportsDirectory: 'coverage',
    },
  },
});
