# Overnight run progress

Runbook: `OVERNIGHT_RUN.md`. Branch: `overnight/2026-10-31`. Each session reads this first.

| Task | Status | Note | Time |
|---|---|---|---|
| T1.1 | done | Branch already checked out; created PROGRESS.md and docs/overnight/ | 01:48 |
| T1.2 | done | install OK; build FAILS against spec 2.0.0 (9 TS errors, mock imports 1.0.x types; generated code is gitignored, not committed). Added `pnpm baseline:build` (generates from 1.0.1 spec @fcd8b9c into gitignored dir) → build+typecheck OK. `node dist/main` CRASHES at startup: yaml "Excessive alias count" parsing spec 2.0.0 (→ R-001). With runtime shim `scripts/smoke/yaml-alias-shim.cjs`: /docs 200, /openapi.yaml 200, /api/v1 404 (no root route, RFC 9457 body), 11 routes mapped. Server stopped. | 01:53 |
| T1.3 | blocked | The 49 scenario checks do not exist (repo, original working copy, kit, zip all searched) → Q-001. Substitute baseline: replayed the 11 requests in `apps/api/requests.http` via `scripts/smoke/run-requests-http.mjs` against the 1.0.1 build: **11/11 2xx**. Note: public browse by chapter UkLWZ returns 0 items (check in T5). | 01:58 |

**Next task:** T1.4
