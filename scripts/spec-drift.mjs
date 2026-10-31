#!/usr/bin/env node
// Drift check: does the generated contracts code the API is compiled against match openapi.yaml?
//
// Regenerates types + Zod schemas from the current spec into a temp dir (never into src/generated)
// and compares them with packages/shared/contracts/src/generated, per exported symbol.
// Note: src/generated is gitignored (nothing is committed), so the reference is whatever was
// generated locally last — after `pnpm baseline:build` that is the 1.0.1 spec the mock uses.
//
// Usage: pnpm spec:drift            summary per symbol, exit 1 on any drift
//        pnpm spec:drift --diff     also print a unified line diff of each changed file
import { execSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const contracts = join(root, 'packages/shared/contracts');
const current = join(contracts, 'src/generated');
const showDiff = process.argv.includes('--diff');
const FILES = ['types.gen.ts', 'zod.gen.ts'];

if (!existsSync(join(current, 'types.gen.ts'))) {
  console.error(`No generated code at ${current}. Run \`pnpm baseline:build\` first.`);
  process.exit(2);
}

const tmp = mkdtempSync(join(tmpdir(), 'spec-drift-'));
// openapi-ts empties its output folder first; on Windows that fails if it is also the cwd.
const out = join(tmp, 'generated');
try {
  execSync(
    `"${join(contracts, 'node_modules/.bin/openapi-ts')}" -i "${join(contracts, 'openapi.yaml')}" -o "${out}" -p @hey-api/typescript zod -s`,
    { cwd: tmp, stdio: ['ignore', 'ignore', 'inherit'], shell: true },
  );

  // Split a generated file into exported symbols: name -> normalised source text.
  const symbols = (text) => {
    const map = new Map();
    const parts = text.replace(/\r\n/g, '\n').split(/\n(?=export )/);
    for (const part of parts) {
      const m = part.match(/^export (?:type|const|interface|enum) (\w+)/);
      if (m) map.set(m[1], part.replace(/\/\*\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim());
    }
    return map;
  };

  let drift = 0;
  for (const file of FILES) {
    const a = symbols(readFileSync(join(current, file), 'utf8'));
    const b = symbols(readFileSync(join(out, file), 'utf8'));
    const removed = [...a.keys()].filter((k) => !b.has(k));
    const added = [...b.keys()].filter((k) => !a.has(k));
    const changed = [...a.keys()].filter((k) => b.has(k) && a.get(k) !== b.get(k));
    drift += removed.length + added.length + changed.length;
    console.log(`\n## ${file}: ${a.size} symbols in use, ${b.size} from spec`);
    console.log(`removed (${removed.length}): ${removed.join(', ') || '-'}`);
    console.log(`added   (${added.length}): ${added.join(', ') || '-'}`);
    console.log(`changed (${changed.length}): ${changed.join(', ') || '-'}`);
    if (showDiff && (removed.length || added.length || changed.length)) {
      try {
        execSync(`git diff --no-index --stat --patch -- "${join(current, file)}" "${join(out, file)}"`, { stdio: 'inherit' });
      } catch {
        // git diff --no-index exits 1 when files differ
      }
    }
  }
  console.log(drift ? `\nDRIFT: ${drift} symbol(s) differ between src/generated and openapi.yaml` : '\nNo drift.');
  process.exitCode = drift ? 1 : 0;
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
