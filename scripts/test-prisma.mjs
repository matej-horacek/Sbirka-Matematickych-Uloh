#!/usr/bin/env node
// Runs ALL e2e tests against a real Postgres through the Prisma repositories.
//   1. recreates the throwaway Postgres of docker-compose.test.yml (port 5433, tmpfs = always empty) and waits until healthy
//   2. applies prisma/migrations (migrate deploy), so the schema is the same as in production
//   3. runs every *.e2e-spec.ts with DATA_SOURCE=prisma, one file at a time (shared database). Each file starts by
//      truncating all tables and re-seeding (test/support/db-reset.ts), so no seeding step is needed here.
//
// Usage: pnpm test:prisma [--down] [extra vitest args]
//   --down  stop and remove the test database afterwards
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const apiDir = resolve(root, 'apps/api');
const args = process.argv.slice(2);
const down = args.includes('--down');
const testArgs = args.filter((a) => a !== '--down');

const env = {
  ...process.env,
  DATA_SOURCE: 'prisma',
  // Fixed on purpose: this script recreates and pushes the schema, so it must only ever touch the throwaway database.
  DATABASE_URL: 'postgresql://app:app@localhost:5433/sbirka_test',
};

function run(label, cmd, cmdArgs, cwd, shell = false) {
  console.log(`\n=== ${label}`);
  const r = spawnSync(cmd, cmdArgs, { cwd, env, stdio: 'inherit', shell });
  return r.status ?? 1;
}

function finish(code) {
  if (down) run('stop test database', 'docker', ['compose', '-f', 'docker-compose.test.yml', 'down'], root);
  process.exit(code);
}

const steps = [
  ['remove old test database', 'docker', ['compose', '-f', 'docker-compose.test.yml', 'down'], root, false],
  [
    'start test database (port 5433)',
    'docker',
    ['compose', '-f', 'docker-compose.test.yml', 'up', '-d', '--wait'],
    root,
    false,
  ],
  ['apply migrations (prisma migrate deploy)', 'pnpm', ['exec', 'prisma', 'migrate', 'deploy'], apiDir, true],
  [
    'e2e: all e2e-spec files (DATA_SOURCE=prisma)',
    process.execPath,
    [
      resolve(root, 'scripts/test-capped.mjs'),
      '--maxWorkers=1', // one test file at a time: they share one database
      'e2e-spec', // Vitest file filters are substrings of the path (not regexes)
      ...testArgs,
    ],
    root,
    false,
  ],
];

for (const [label, cmd, cmdArgs, cwd, shell] of steps) {
  const code = run(label, cmd, cmdArgs, cwd, shell);
  if (code !== 0) {
    console.error(`\ntest:prisma stopped at "${label}" (exit ${code}).`);
    finish(code);
  }
}
finish(0);
