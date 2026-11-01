#!/usr/bin/env node
// Runs the data-layer e2e tests against a real Postgres through the Prisma repositories.
//   1. recreates the throwaway Postgres of docker-compose.test.yml (port 5433, tmpfs = always empty) and waits until healthy
//   2. creates the schema from schema.prisma (db push on the empty database: there are no migration files yet)
//   3. seeds it (prisma/seed.ts)
//   4. runs the create, get, list and picker e2e tests with DATA_SOURCE=prisma, one file at a time (shared database)
// Until the Prisma…Repository classes are implemented, these tests fail with 501 (TODO Daniel).
//
// Usage: pnpm test:prisma [--down] [extra jest args]
//   --down  stop and remove the test database afterwards
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const apiDir = resolve(root, 'apps/api');
const args = process.argv.slice(2);
const down = args.includes('--down');
const jestArgs = args.filter((a) => a !== '--down');

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
  ['start test database (port 5433)', 'docker', ['compose', '-f', 'docker-compose.test.yml', 'up', '-d', '--wait'], root, false],
  ['create schema (prisma db push)', 'pnpm', ['exec', 'prisma', 'db', 'push', '--skip-generate'], apiDir, true],
  ['seed (prisma db seed)', 'pnpm', ['exec', 'prisma', 'db', 'seed'], apiDir, true],
  [
    'e2e: create, get, list, pickers (DATA_SOURCE=prisma)',
    process.execPath,
    [
      resolve(root, 'scripts/jest-capped.mjs'),
      '--maxWorkers=1', // one test file at a time: they share one database
      '--testPathPatterns',
      '[\\\\/](create|get|list|pickers)\\.e2e-spec\\.ts$',
      ...jestArgs,
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
