#!/usr/bin/env node
// Runs Jest for apps/api with hard memory limits, so a runaway test dies instead of
// exhausting system RAM (this froze the PC twice). Every jest script goes through here.
//   --max-old-space-size  caps the heap of the Jest parent AND of each worker (NODE_OPTIONS is inherited)
//   maxWorkers / workerIdleMemoryLimit live in apps/api/jest.config.js
// Usage: node scripts/jest-capped.mjs [jest args]   [--unskip]  (--unskip runs it.skip tests too)
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';

const apiDir = resolve(import.meta.dirname, '../apps/api');
const jestBin = resolve(dirname(createRequire(resolve(apiDir, 'package.json')).resolve('jest/package.json')), 'bin/jest.js');
const HEAP_MB = process.env.JEST_HEAP_MB ?? '1536';

const args = process.argv.slice(2);
const unskip = args.includes('--unskip');
const env = { ...process.env };
if (unskip) env.UNSKIP = '1';
env.NODE_OPTIONS = `${env.NODE_OPTIONS ?? ''} --max-old-space-size=${HEAP_MB}`.trim();

const r = spawnSync(process.execPath, [jestBin, '--maxWorkers=2', ...args.filter((a) => a !== '--unskip')], {
  cwd: apiDir,
  stdio: 'inherit',
  env,
});
process.exit(r.status ?? 1);
