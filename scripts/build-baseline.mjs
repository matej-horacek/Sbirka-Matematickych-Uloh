#!/usr/bin/env node
// Builds contracts + API against the spec the mock was written for (1.0.1, commit fcd8b9c).
//
// Why: src/generated is gitignored, and generating it from the current openapi.yaml (2.0.0)
// breaks the API build (the mock still imports 1.0.x types such as ProblemChildInput).
// This script writes the old spec to a temp file, generates into the (gitignored)
// src/generated, bundles contracts with tsup and builds the API. It edits no tracked file.
//
// Usage: pnpm baseline:build            (from the repo root)
//        MOCK_SPEC_REF=<commit> pnpm baseline:build
import { execSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const contracts = join(root, 'packages/shared/contracts');
const ref = process.env.MOCK_SPEC_REF ?? 'fcd8b9c';

const run = (cmd, cwd = root) => execSync(cmd, { cwd, stdio: 'inherit', shell: true });

const tmp = mkdtempSync(join(tmpdir(), 'mock-spec-'));
try {
  const specFile = join(tmp, 'openapi.yaml');
  const spec = execSync(`git show ${ref}:packages/shared/contracts/openapi.yaml`, { cwd: root });
  writeFileSync(specFile, spec);
  console.log(`[baseline] generating contracts from ${ref} spec`);
  // Run from the temp dir so the package's openapi-ts.config.ts (which points at 2.0.0) is not picked up.
  run(
    `"${join(contracts, 'node_modules/.bin/openapi-ts')}" -i "${specFile}" -o "${join(contracts, 'src/generated')}" -p @hey-api/typescript zod`,
    tmp,
  );
  run('pnpm exec tsup', contracts);
  run('pnpm --filter @matematika/api build');
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
