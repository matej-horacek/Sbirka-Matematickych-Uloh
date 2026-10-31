#!/usr/bin/env node
// One command that checks everything, failing fast, in this order:
//   1. spec lint       (Redocly)
//   2. spec examples   (AJV)
//   3. spec drift      SKIPPED by default: drift is expected until the mock adopts 2.0.0
//                      and the contracts are regenerated (runbook T2.3). Opt in: --with-drift
//   4. typecheck       (contracts + API source + tests)
//   5. lint            (ESLint)
//   6. tests           (Jest: unit + e2e; --quick runs unit tests only)
//
// Before step 4 it makes sure the contracts package is built. If it is missing, it builds
// it from the 1.0.1 spec the mock was written for (scripts/build-baseline.mjs).
//
// Usage: pnpm verify | pnpm verify:quick | node scripts/verify.mjs [--quick] [--with-drift]
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const quick = process.argv.includes('--quick');
const withDrift = process.argv.includes('--with-drift') || process.env.VERIFY_DRIFT === '1';

const steps = [
  { name: 'spec lint', cmd: 'pnpm spec:lint' },
  { name: 'spec examples', cmd: 'pnpm spec:examples' },
  withDrift
    ? { name: 'spec drift', cmd: 'pnpm spec:drift' }
    : { name: 'spec drift', skip: 'expected 1.0.x→2.0.0 drift; see docs/overnight/SPEC_CHECK.md (opt in: --with-drift)' },
  {
    name: 'contracts built',
    cmd: 'node scripts/build-baseline.mjs --contracts-only',
    when: () => !existsSync(join(root, 'packages/shared/contracts/dist/index.cjs')),
    skip: 'packages/shared/contracts/dist exists',
  },
  { name: 'typecheck', cmd: 'pnpm -r typecheck && pnpm --filter @matematika/api typecheck:test' },
  { name: 'lint', cmd: 'pnpm lint' },
  quick
    ? { name: 'tests (unit only, --quick)', cmd: 'pnpm --filter @matematika/api test:unit' }
    : { name: 'tests (unit + e2e)', cmd: 'pnpm --filter @matematika/api test' },
];

const summary = [];
const started = Date.now();
for (const step of steps) {
  const shouldRun = step.cmd && (step.when ? step.when() : true);
  if (!shouldRun) {
    summary.push(`  SKIP  ${step.name} (${step.skip})`);
    console.log(`\n=== ${step.name}: skipped (${step.skip})`);
    continue;
  }
  console.log(`\n=== ${step.name}: ${step.cmd}`);
  const t = Date.now();
  const r = spawnSync(step.cmd, { cwd: root, stdio: 'inherit', shell: true });
  const secs = ((Date.now() - t) / 1000).toFixed(1);
  if (r.status !== 0) {
    summary.push(`  FAIL  ${step.name} (${secs}s)`);
    console.log(`\nverify FAILED at "${step.name}"\n${summary.join('\n')}`);
    process.exit(r.status ?? 1);
  }
  summary.push(`  ok    ${step.name} (${secs}s)`);
}
console.log(`\nverify${quick ? ':quick' : ''} PASSED in ${((Date.now() - started) / 1000).toFixed(1)}s\n${summary.join('\n')}`);
