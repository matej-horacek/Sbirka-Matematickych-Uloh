#!/usr/bin/env node
// One command that checks everything, failing fast, in this order:
//   1. spec lint       (Redocly)
//   2. spec examples   (AJV)
//   3. spec version    (info.version = newest changelog entry, O-8)
//   4. contracts built (generates + bundles from openapi.yaml when missing)
//   5. spec drift      (generated code the API compiles against = what the spec generates)
//   6. typecheck       (contracts + API source + tests)
//   7. lint            (ESLint)
//   8. tests           (Jest: unit + e2e; --quick runs unit tests only)
//
// Usage: pnpm verify | pnpm verify:quick | node scripts/verify.mjs [--quick]
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const quick = process.argv.includes('--quick');

const steps = [
  { name: 'spec lint', cmd: 'pnpm spec:lint' },
  { name: 'spec examples', cmd: 'pnpm spec:examples' },
  { name: 'spec version', cmd: 'pnpm spec:version' },
  {
    name: 'contracts built',
    cmd: 'pnpm --filter @matematika/contracts build',
    when: () =>
      !existsSync(join(root, 'packages/shared/contracts/dist/index.cjs')) ||
      !existsSync(join(root, 'packages/shared/contracts/src/generated/types.gen.ts')),
    skip: 'packages/shared/contracts/dist and src/generated exist',
  },
  { name: 'spec drift', cmd: 'pnpm spec:drift' },
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
  // Cap each node process's heap so a runaway one dies instead of exhausting system RAM.
  const env = { ...process.env, NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --max-old-space-size=2048`.trim() };
  const r = spawnSync(step.cmd, { cwd: root, stdio: 'inherit', shell: true, env });
  const secs = ((Date.now() - t) / 1000).toFixed(1);
  if (r.status !== 0) {
    summary.push(`  FAIL  ${step.name} (${secs}s)`);
    console.log(`\nverify FAILED at "${step.name}"\n${summary.join('\n')}`);
    process.exit(r.status ?? 1);
  }
  summary.push(`  ok    ${step.name} (${secs}s)`);
}
console.log(`\nverify${quick ? ':quick' : ''} PASSED in ${((Date.now() - started) / 1000).toFixed(1)}s\n${summary.join('\n')}`);
