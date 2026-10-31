# Overnight run progress

Runbook: `OVERNIGHT_RUN.md`. Branch: `overnight/2026-10-31`. Each session reads this first.

| Task | Status | Note | Time |
|---|---|---|---|
| T1.1 | done | Branch already checked out; created PROGRESS.md and docs/overnight/ | 01:48 |
| T1.2 | done | install OK; build FAILS against spec 2.0.0 (9 TS errors, mock imports 1.0.x types; generated code is gitignored, not committed). Added `pnpm baseline:build` (generates from 1.0.1 spec @fcd8b9c into gitignored dir) → build+typecheck OK. `node dist/main` CRASHES at startup: yaml "Excessive alias count" parsing spec 2.0.0 (→ R-001). With runtime shim `scripts/smoke/yaml-alias-shim.cjs`: /docs 200, /openapi.yaml 200, /api/v1 404 (no root route, RFC 9457 body), 11 routes mapped. Server stopped. | 01:53 |
| T1.3 | blocked | The 49 scenario checks do not exist (repo, original working copy, kit, zip all searched) → Q-001. Substitute baseline: replayed the 11 requests in `apps/api/requests.http` via `scripts/smoke/run-requests-http.mjs` against the 1.0.1 build: **11/11 2xx**. Note: public browse by chapter UkLWZ returns 0 items (check in T5). | 01:54 |
| T1.4 | done | INVENTORY.md: 6 modules, layers, 5 TODO Phase B markers (+4 untagged, 2 Phase C, 1 TODO decide=O4), 16 spec ops: 4 yes / 7 partial / 5 not in mock | 01:55 |
| T2.1 | done | Redocly recommended: valid, 1 warning (info-license); all 144 $refs resolve; added pnpm spec:lint + dev dep @redocly/cli | 01:56 |
| T2.2 | done | scripts/check-spec-examples.mjs + pnpm spec:examples: 47/47 examples valid (self-test with planted errors fails as expected); no undeclared props; dev deps ajv, ajv-formats, yaml | 01:58 |
| T2.3 | done | scripts/spec-drift.mjs + pnpm spec:drift (temp-dir regen vs local src/generated): 67 symbols drift (1 removed, 53 added, 12 changed across types+zod) — summary by schema in SPEC_CHECK.md; kept out of verify | 01:59 |
| T2.3b | done | 13 consistency items C-1..C-13 in SPEC_CHECK.md (C-1 version→O8, C-3 notified→O2, C-2 create example is a set, C-4 child lockVersion inconsistent in examples, C-5/C-6 missing 400 on takeOverUpdate/publish); 4 gaps → Q-004..Q-007 | 02:01 |
| T2.4 | done | Conventions: all pass except error-codes.ts vs spec (missing IS_SET_CHILD, CANNOT_ADD_TO_SET, NO_UPDATE_AVAILABLE; stale SET_CHILD_EDIT_VIA_PARENT); minor: nullable ids not Sqid refs | 02:01 |
| T2.5 | done | 12 issues S-1..S-12 with severity (1 high: YAML anchors crash startup; 3 medium); O8 + O2 listed under Open | 02:01 |
| T3.1 | done | No runner existed → Jest 30 + ts-jest 29 + supertest 7 + @nestjs/testing 11 (apps/api devDeps); jest.config.js, test/tsconfig.json; scripts test, test:unit, test:e2e, test:cov, typecheck:test | 02:06 |
| T3.2-T3.5 | done | test/support: app.ts (fresh AppModule app per file), auth.ts, contract.ts (AJV 2019 from openapi.yaml, strict unevaluatedProperties), api.ts (auto contract check on every request), store.ts (async StoreProbe + MockStoreProbe, Sqid decode), seed.ts; 15 tests pass | 02:06 |
| T3.6 | done | pnpm verify (12s, PASS): spec lint → spec examples → [spec drift skipped, opt-in --with-drift per T2.3] → contracts auto-built if missing → typecheck (src+tests) → lint → tests; verify:quick = unit tests only. Added ESLint 10 + typescript-eslint recommended (src lints clean). Fresh-clone path tested. | 02:09 |
| T3.7 | done | .github/workflows/verify.yml (ubuntu+windows, fetch-depth 0, never pushed) + docs/TESTING.md (Windows how-to). T3 done-criterion met: verify runs end to end. | 02:09 |
| (resume) | — | Session resumed 10:40 (runbook window edited to 13:15/14:00 in the working tree, not by the run; left uncommitted). Found uncommitted T4 work (list tests, test:unskipped): verified and committed. | 10:40 |
| T4.1 | done | The 49 checks don't exist (Q-001); ported the 11 requests.http scenarios to `test/requests-http.e2e-spec.ts` (contract + store checks). Old replay script kept. | 10:52 |
| T4.2 | done | Tests for every implemented operation (list, create, get, update, delete, copy, publish, dissolve, 3 pickers): contract + store + auth + validation + 404. New bug found: R-015 (create without name stores a nameless row, generated zod loses `required`). | 10:52 |
| T4.3 | done | O-items noted per file (O2 update/copies, O4 copy, O5 publish, O7 pickers); nothing from §6 Open is asserted. | 10:52 |
| T4.4 | done | Full spec tests, skipped, for addSetChild (37), reorderSetChild (21), removeSetChild (18), takeOver (13), dismiss (6), updateAvailable (10). test:unskipped: 122 fail as expected, 4 accidental passes marked. | 10:58 |
| T4.5 | done | Results table in INVENTORY §5: 189 pass / 0 fail / 126 skip. REVIEW.md R-001..R-019 (T5 folded in). QUESTIONS Q-008..Q-011. | 11:02 |
| T5 | done | REVIEW.md: 9 high, 4 medium, 6 low, 0 critical; T5.1 consistency list, T5.2 Phase B friction (R-016, R-019), T5.3 security checks that hold. | 11:02 |

| T6 | done | decisions/O-2,3,4,5,7,8.md: current state quoted from §6 + spec + mock, 3 options each with impacts, spec sketches for O2/O3/O4, one "look at first" line. No recommendation. | 11:10 |

| T7 | done | PHASE_B_PLAN.md: T7.1 data model (8 tables + Phase B additions), T7.0 mock→2.0.0 in 11 steps mapped to skipped tests, T7.2 swap per marker incl. atomic optimistic locking, T7.3 test reuse (StoreProbe + Docker Postgres), T7.4 risks per O-item. | 11:16 |

**Next task:** T10 is mandatory at 13:15; time remains → T8 (extra tests), then T10
