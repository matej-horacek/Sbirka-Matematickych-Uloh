#!/usr/bin/env node
// O-8: info.version must equal the newest entry of the changelog in info.description.
// The changelog lines look like "- 2.0.0 (2026-10-29): ..."; the newest is the first one.
//
// Usage: pnpm spec:version
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parse } from 'yaml';

const root = resolve(import.meta.dirname, '..');
const spec = parse(readFileSync(join(root, 'packages/shared/contracts/openapi.yaml'), 'utf8'), { maxAliasCount: -1 });

const entries = [...String(spec.info.description).matchAll(/^- (\d+\.\d+\.\d+) \(\d{4}-\d{2}-\d{2}\)/gm)].map((m) => m[1]);
if (!entries.length) {
  console.error('spec version: no changelog entries found in info.description');
  process.exit(1);
}
if (spec.info.version !== entries[0]) {
  console.error(`spec version: info.version is ${spec.info.version}, newest changelog entry is ${entries[0]}`);
  process.exit(1);
}
console.log(`spec version: info.version ${spec.info.version} matches the newest changelog entry`);
