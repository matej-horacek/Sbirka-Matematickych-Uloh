#!/usr/bin/env node
// Replays apps/api/requests.http (JetBrains HTTP client format) against a running API, in order,
// and prints one line per request. Used as the T1.3 substitute baseline (the "49 scenario checks"
// named in the runbook do not exist in the repo; see docs/overnight/QUESTIONS.md Q-001).
//
// Usage: node scripts/smoke/run-requests-http.mjs [baseUrl]   (default http://localhost:3000/api/v1)
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const file = resolve(import.meta.dirname, '../../apps/api/requests.http');
const base = process.argv[2] ?? 'http://localhost:3000/api/v1';
const text = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

const blocks = text.split(/^###.*$/m).map((b) => b.trim()).filter(Boolean);
const titles = [...text.matchAll(/^###(.*)$/gm)].map((m) => m[1].trim());
let results = [];
let n = 0;
for (const [i, block] of blocks.entries()) {
  const lines = block.split('\n').filter((l) => !l.startsWith('@'));
  const reqIdx = lines.findIndex((l) => /^(GET|POST|PATCH|PUT|DELETE)\s/.test(l));
  if (reqIdx < 0) continue;
  const [method, rawUrl] = lines[reqIdx].split(/\s+/);
  const url = rawUrl.replace('{{base}}', base);
  const headers = {};
  let j = reqIdx + 1;
  for (; j < lines.length && lines[j].trim() !== ''; j++) {
    const [k, ...v] = lines[j].split(':');
    headers[k.trim()] = v.join(':').trim();
  }
  const body = lines.slice(j).join('\n').trim() || undefined;
  const res = await fetch(url, { method, headers, body });
  const json = await res.text();
  n++;
  const title = titles[blocks.length === titles.length ? i : i + (titles.length - blocks.length)] || '';
  const summary = json.length > 160 ? json.slice(0, 160) + '…' : json;
  results.push({ n, method, path: rawUrl.replace('{{base}}', ''), status: res.status, title, summary });
  console.log(`${String(n).padStart(2)} ${res.status} ${method} ${rawUrl.replace('{{base}}', '')}  # ${title}`);
  if (process.env.VERBOSE) console.log(`     ${summary}`);
}
const failed = results.filter((r) => r.status >= 400);
console.log(`\n${results.length} requests, ${results.length - failed.length} returned 2xx, ${failed.length} returned 4xx/5xx`);
