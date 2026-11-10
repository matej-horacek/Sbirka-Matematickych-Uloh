# Morning report: overnight run 2026-10-31

Branch `overnight/2026-10-31`, 30 commits on top of `06b6dcb` (your spec 2.0.0 commit). Nothing pushed, merged or rewritten.
**No changes** to `apps/api/src`, the spec, `packages/shared/contracts/src`, or frontend code (`git diff 06b6dcb -- apps/api/src packages/shared/contracts` is empty).
The run had two sessions: 01:45–02:12, then resumed 10:40–11:21. About 20 minutes of reading.

---

## 1. Verdict

**`pnpm verify` passes** (about 20 s): spec lint → spec examples → (spec drift skipped on purpose) → typecheck → lint → tests.

| | T1 baseline | Now |
|---|---|---|
| Test runner | none | Jest 30 + ts-jest + supertest, 18 files |
| Scenario checks | "49 checks" not found (Q-001); `requests.http` replay 11/11 2xx | ported: 11/11 pass, with contract and store checks |
| Tests | 0 | **335: 203 pass, 0 fail, 132 skipped** |
| Skipped tests, un-skipped (`test:unskipped`) | n/a | 128 fail (each proves its finding), 4 pass by accident (explained in the files) |
| Build against spec 2.0.0 | fails (9 TS errors; mock is 1.0.x) | unchanged (expected); `pnpm baseline:build` builds against 1.0.1 |
| `node dist/main` with spec 2.0.0 | crashes (R-001) | unchanged (src is read-only) |
| Coverage of `src` | n/a | 99.2 % lines, 85.5 % branches (INVENTORY §6) |

Every response in every passing test is validated against `openapi.yaml` (strict: undeclared fields fail). Every happy path also checks the data store.

**Honest note:** commits `3994753` … `5533013` were made while one fast-check property was flaky (about 1 in 4 runs failed). `verify` happened to pass before `3994753`; before `f1515f0` it failed and a shell pipe hid the exit code.
The flakiness was a real bug (R-021). It is now a deterministic skipped test, the test suite then passed 5 runs in a row, and `verify` passed before every later commit.

## 2. Spec check: top issues (`SPEC_CHECK.md`)

1. **S-1 (high):** the 2.0.0 YAML uses generated anchors (`&id001`…), and `main.ts` crashes parsing it (= R-001, Q-003).
2. **S-13 (medium, new):** `ProblemCreate`'s `required: [name, assignment]` sits in an `allOf` branch without those properties, and the generator drops it (→ R-015).
3. **S-2 (medium):** `error-codes.ts` is missing `IS_SET_CHILD`, `CANNOT_ADD_TO_SET`, `NO_UPDATE_AVAILABLE` and still has `SET_CHILD_EDIT_VIA_PARENT`.
4. **S-3 (medium):** the `createProblem` 201 example still shows a set with children.
5. **S-4/S-5:** `takeOverUpdate` and `publishProblem` take a body but declare no 400.

Lint: valid (1 warning: `info.license`). All 144 `$ref`s resolve. All 47 examples match their schemas. Drift vs 1.0.x: 67 generated symbols (expected; the table by schema is the type list the mock must adopt).

## 3. Operation table

contract-valid = every response the tests got passed the strict contract check. store-verified = the tests assert the store, not only the response.

| operation | tested | contract-valid | store-verified | findings |
|---|---|---|---|---|
| listProblems | 36 (27 pass) | yes | yes (owner, top-level, status) | R-007, R-013, R-021 |
| createProblem | 22 (18 pass) | yes, except a body without a name (→ R-015) | yes (one row, owner, PRIVATE, OWN, v1/lv1) | R-015, R-011, R-008, R-021 |
| getProblem | 17 (14 pass) | yes | yes (children order, versions) | R-008, R-021 |
| updateProblem | 31 (26 pass) | yes | yes (fields, version/lockVersion, 202 changes nothing) | R-009 |
| deleteProblem | 13 (12 pass) | yes | yes (soft delete, set + children) | R-010 |
| addSetChild | 37 (all skipped) | written from the spec | written from the spec | **R-002 not in mock** |
| reorderSetChild | 21 (all skipped) | ″ | ″ | **R-003 not in mock** |
| removeSetChild | 18 (all skipped) | ″ | ″ | **R-004 not in mock** |
| copyProblem | 22 (20 pass) | yes | yes (new rows for parent + children, original unchanged) | R-008, R-007 |
| publishProblem | 19 (17 pass) | yes | yes (status by trust, licence) | R-021 |
| dissolveSet | 10 (9 pass) | yes | yes (same rows freed, parent soft-deleted) | R-010 |
| takeOverUpdate | 13 (all skipped) | written from the spec | ″ | **R-005 not in mock** |
| dismissUpdate | 6 (all skipped) | ″ | ″ | **R-006 not in mock** |
| updateAvailable (field + filter) | 10 (all skipped) | ″ | ″ | **R-007** |
| listTags / listChapters / listLicenses | 21 (20 pass) | yes | yes (visibility counts) | R-014 (auth) |

The details per file are in INVENTORY §5.

## 4. What the store checks proved (MockDatabase, through `StoreProbe`)

- **Create** writes exactly one row: caller as owner, PRIVATE, source OWN, no licence, `version 1`, `lockVersion 1`, no parent/original. A rejected request writes nothing (15 validation cases).
- **Copy** of a problem writes one new row (owner = caller, PRIVATE, `originalProblemId`/`originalProblemVersion` set). **Copy of a set** writes 1 + N new rows in the same order, each child linked to its original child. The originals are **deep-equal before and after**. Foreign copies keep only global tags/chapters; source OWN → LICENSED_USE with the licence inherited.
- **Update** changes exactly the sent fields (`null` clears, missing keeps), raises `version` and `lockVersion` by 1. A stale lock, a bad body or a foreign problem changes nothing. **202** (verified author, published problem) leaves the row unchanged, as the Phase B TODO says.
- **Delete** soft-deletes (`deletedAt` set, row kept); on a set, the parent and every child. A set child is refused and nothing is deleted.
- **Dissolve** creates **no** rows: the same child rows get `parentId null`, PRIVATE; the parent is soft-deleted.
- **Publish** sets PUBLISHED (trusted) or REVIEWING (verified) on the problem, or on the set and every child, and stores the licence only where none was set. Registered → 403 with nothing changed. Already published/reviewing → row deep-equal.

## 5. Open decisions (one file each, options only, nothing decided)

- [O-2](decisions/O-2.md): **notifications for copy holders.** A: flag only (reword "are notified") · B: flag + stored notification rows (+ endpoints, sketch) · C: flag now, rows later.
- [O-3](decisions/O-3.md): **PDF export.** A: client-side print (as decided) · B: BullMQ + Redis + Puppeteer queue (sketch) · C: synchronous server render.
- [O-4](decisions/O-4.md): **source type on copying your own problem.** A: keep LICENSED_USE citing yourself · B: stays OWN (owner exception, sketch) · C: exception depending on the licence.
- [O-5](decisions/O-5.md): **marking auto-approved revisions.** A: `problem_revision` with an AUTO marker · B: separate `system_action_log` · C: `moderation_log` with a nullable/system actor.
- [O-7](decisions/O-7.md): **deviations from the structure doc.** NestJS 11 vs 12, own `ZodValidationPipe` vs `nestjs-zod`, `licenses` module: each with 3 options.
- [O-8](decisions/O-8.md): **version bump.** A: `2.0.0` · B: `2.0.0` + a verify check that it matches the changelog · C: keep 1.x.

New questions for you: Q-008 … Q-011 in `QUESTIONS.md` (addSetChild edge cases, `updateAvailable` on non-copies, what counts as a new version, edits while REVIEWING). Q-001 (the missing 49 checks) is still open.

## 6. Findings (`REVIEW.md`, nothing fixed)

No critical findings. Ownership and visibility hold everywhere they were tested (T5.3).

**High**
- **R-001:** API crashes at startup with spec 2.0.0 (YAML alias limit), `main.ts:16`.
- **R-015 (new tonight):** `POST /problems` without `name` (or `assignment`) → 201 and a **nameless row is stored**. The generated Zod lost the `required`.
- **R-002 … R-006:** `addSetChild`, `reorderSetChild`, `removeSetChild`, `takeOverUpdate`, `dismissUpdate` are not in the mock (95 skipped tests are the checklist).
- **R-007:** no `ids`/`updateAvailable` filters and no `updateAvailable` field. `?ids=` silently returns the **unfiltered** list.
- **R-009:** set children can't be edited directly (409); a child edit can't raise the set's version.

**Medium**
- **R-021 (new, found by fast-check):** a crafted id such as `e50000AA0A` gives a **500** on every endpoint that takes an id (path, query or body). Fix: a `Number.isSafeInteger` guard in `decodeId`.
- **R-013:** a malformed `tagId`/`chapterId` is dropped and the filter **widens** to all problems.
- **R-008:** no `originalId`; children have no own `lockVersion`.
- **R-010:** set-child refusals use the old code `SET_CHILD_EDIT_VIA_PARENT` instead of `IS_SET_CHILD`.
- **R-012:** `error-codes.ts` out of sync.

**Low:**
- R-011 (1.0.x `children` still accepted)
- R-014 (any unknown token logs in as jan)
- R-016 (trust rule duplicated)
- R-017 (no 412 in the filter)
- R-018 (`requestId` echoes the client header)
- R-019 (Phase B data-access friction)
- **R-020** (found by fast-check): set children are sorted with `localeCompare` in the default cs-CZ locale, where "ch" sorts after "i" and case order is ignored. Harmless today; with Phase B fractional-indexing keys it would scramble set order. Use byte order and a C collation.

## 7. Phase B plan (`PHASE_B_PLAN.md`)

Two stages. **First the mock catches up with 2.0.0 (T7.0, 11 steps, each mapped to skipped tests), then Prisma + JWT (T7.2) under a green suite.**
T7.1 lists the 8 tables the spec needs (problem with `version`/`lock_version`/original link and a stored "dismissed version", `problem_part`, `content_source`, join tables…).
T7.3: all operation tests carry over once a `PrismaStoreProbe` exists. They need a Docker test Postgres with the same seed.
T7.4: O5 blocks the revision tables; O4, O2 and O3 change smaller parts.

First three steps:
1. **Fix startup and regenerate from 2.0.0** (`main.ts` alias option or anchor-free spec; delete the 1.0.x `children` paths). This fixes R-001 and R-011 and unblocks everything.
2. **Bring `error-codes.ts` up to date and close the validation gaps:** R-010/R-012, R-015 (`name`/`assignment`), R-021 (`decodeId` guard), R-013.
3. **Mapper fields, then child edits:** `originalId` + per-child `lockVersion` (R-008), then direct child edits with the parent `version` bump (R-009). After that, the `/children` operations (R-002…R-004) against the 76 ready tests.

## 8. What changed

**New dev dependencies** (no major upgrades, no runtime dependencies):
- **root:** `@redocly/cli`, `ajv`, `ajv-formats`, `yaml`, `eslint`, `@eslint/js`, `typescript-eslint`, `globals`
- **`apps/api`:** `jest`, `ts-jest`, `@types/jest`, `supertest`, `@types/supertest`, `@nestjs/testing`, `ajv`, `ajv-formats`, `fast-check`

**New files:**
- **tooling:** `scripts/verify.mjs`, `check-spec-examples.mjs`, `spec-drift.mjs`, `build-baseline.mjs`, `scripts/smoke/*`, `eslint.config.*`, `.github/workflows/verify.yml` (committed, not pushed)
- **tests:** `apps/api/jest.config.js`, `apps/api/test/**` (18 test files, `support/`)
- **docs:** `docs/TESTING.md`, `docs/overnight/*` (INVENTORY, SPEC_CHECK, REVIEW, QUESTIONS, decisions/, PHASE_B_PLAN, architecture, codebase-walkthrough, defense-questions, this report)
- **changed:** `.gitignore` (+`coverage/`)
- **scripts in `package.json`:** `verify`, `verify:quick`, `spec:lint`, `spec:examples`, `spec:drift`, `baseline:build`, `lint`, `typecheck`; in `apps/api`: `test`, `test:unit`, `test:e2e`, `test:cov`, `test:unskipped`, `typecheck:test`

**Not committed by the run:** `OVERNIGHT_RUN.md` has an uncommitted edit (window "resumed 10:40", deadlines 13:15/14:00) that was already in the working tree when the second session started. It was left for you.

**Commits** (oldest first):
```
c2df890 [T1.1] add PROGRESS.md
d715c31 [T1.2] baseline build script and startup smoke shim
f09c919 [T1.3] scenario checks not found; replay requests.http as substitute baseline
9c1556e [T1.4] inventory: modules, layers, Phase B markers, operation list
d6aeb3a [T2.1] spec lint with Redocly
7f4967e [T2.2] validate spec examples against schemas with AJV
899f88c [T2.3] spec drift check and drift summary by schema
a220987 [T2.3b] spec internal consistency report
51e2bf2 [T2.4][T2.5] spec convention check and issue list
3e40365 [T3.1] add Jest + ts-jest + supertest test runner
4613829 [T3.2-T3.5] test app factory, login helpers, contract validation, StoreProbe
7d3e558 [T3] progress
7d74dc2 [T3.6] verify and verify:quick scripts, ESLint config
123f860 [T3.7] CI workflow and TESTING.md
8596642 [T4.2] listProblems tests, test:unskipped, REVIEW.md skeleton
4593d17 [T4.2] create/get/update/delete tests (R-008..R-011, R-015 skipped)
6e3b59a [T4.1/T4.2] copy/publish/dissolve, pickers, requests.http port
907fe3c [T4.4] set children tests from spec 2.0.0 (R-002..R-004, skipped)
eebea23 [T4.4] copy-update tests: updateAvailable, take-over, dismiss (R-005..R-007, skipped)
fa773de [T4.5/T5] results table, REVIEW.md findings R-001..R-019, questions Q-008..Q-011
dd8b629 [T6] decision files O-2, O-3, O-4, O-5, O-7, O-8 (options only)
4937b4b [T6] progress
389a1be [T7] Phase B plan (document only)
3994753 [T8] property tests (fast-check), pagination edge cases, coverage; R-020 found
6fbe86e [T8] progress
f1515f0 [T9] architecture, codebase walkthrough, 30 defense questions
5533013 [T9] progress
34600e6 [T8] R-021: overflowing Sqids give 500 (found by fast-check); deterministic skipped tests
…       [T10] morning report (this commit)
```
