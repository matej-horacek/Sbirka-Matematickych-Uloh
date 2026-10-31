# Overnight run (safe version) — Komunitní sbírka úloh, mock backend

**Window:** Sat 2026-10-31 ~01:15 → 14:00 (Europe/Prague), resumed 10:40
**Owner:** Daniel. He reviews everything in the morning, with time to spare.

**What this repo is:** the `matematika/` pnpm monorepo.
- **API:** `apps/api`, a NestJS 11 **mock** backend. Data lives in memory (`MockDatabase`) and login is fake (`MockAuthGuard`: `Bearer jan` = trusted, `eva` = verified, `petr` = registered).
- **Spec:** `packages/shared/contracts/openapi.yaml`, now at **2.0.0 (block model)**. It covers 16 operations (problems, set children, copy/publish/dissolve, take-over/dismiss update, and the tag/chapter/licence pickers). Types and Zod schemas are **generated** from it with `@hey-api/openapi-ts` (`pnpm generate`).
- **The mock lags the spec.** The mock was built against spec 1.0.x (whole-set editing through `children`), and the committed generated code is from 1.0.x too. Expect operations that are new in 2.0.0 to be missing or different in the mock:
  - `/children`
  - take-over-update and dismiss-update
  - the `ids` and `updateAvailable` filters
  - the 412 If-Match response
  - the `IS_SET_CHILD` and `CANNOT_ADD_TO_SET` codes

  That gap is an expected result, not a failure of the run.
- **Do not run `pnpm generate` into the committed output.** The mock's source imports the 1.0.x types, so regenerating them would break the build. Regenerate only into a temp dir (T2.3). Build contract validation directly from `openapi.yaml`.
- **Phase B markers:** code that is planned to be replaced is marked `TODO Phase B`.

**Goal by morning:**
1. The spec is validated.
2. A test harness proves what the mock does, including that records are really created in the store.
3. One `verify` command runs everything.
4. Every open decision is written up as options, not decided.
5. A Phase B (Prisma + JWT) plan exists as a document.
6. `MORNING_REPORT.md` summarizes all of it.

---

## 0. Rules (read first, follow always)

### Hard limits

1. **Read-only:**
   - the spec (`packages/shared/contracts/**/*.yaml`)
   - all backend source in `apps/api/src/**`
   - any frontend code

   Permission rules enforce this. Tests go in `apps/api/test/` (or wherever the existing tests live), helpers in `apps/api/test/support/`, scripts in `scripts/`, and documents in `docs/overnight/`.
2. **No decisions.** Anything listed under §6 "Open" is **not** decided. Never pick an option, never write a test that assumes one, and never call a mismatch with an Open item a bug. Write it up as options in T6 instead.
3. **The spec is the reference for the mock.** If the mock and the spec disagree, that is a finding, unless the item is in §6 Open.
4. **No database, no Prisma code, no JWT code tonight.** Phase B is planned on paper only (T7).
5. **Branch `overnight/2026-10-31` only.** There is no remote. Never merge, rebase, reset, or rewrite history.
6. **No dependency major upgrades.** Only add dev dependencies needed for tests and tooling, and list each one in the report.
7. **No network calls to real services.** Package registries are fine.

### Commit & progress discipline

- **Commits:** small, one per task or sub-task, message format `[T3] add contract validation helper`.
- **After every task:** update `PROGRESS.md` (repo root) with:
  - task ID
  - status (done / partial / blocked)
  - one line on what happened
  - next task
- **Resuming:** a fresh session reads `PROGRESS.md` first and continues from the next unfinished task. Never redo finished tasks.
- **Stuck rule:** after 3 genuine attempts or about 45 minutes, mark the task `blocked` with the reason and move on.
- **Before every commit:** run `verify` once it exists. Never commit a broken harness.
  - Because the source is read-only, a test that fails due to a real mock bug is committed as `it.skip('… [R-0xx]')`, with a matching `REVIEW.md` entry.
- **Time:** check the current time with a shell command before each task.
  - At **13:15**, stop and do T10.
  - Everything must be committed by **14:00**.
- **Priority if time runs short:** T1 → T2 → T3 → T4 → T10 → T5 → T6 → T7 → T8 → T9. **T10 is mandatory.**

### Output files (in `docs/overnight/`)

| File | Purpose |
|---|---|
| `INVENTORY.md` | Repo map, baseline results, operation list |
| `SPEC_CHECK.md` | Spec validation results |
| `REVIEW.md` | Findings: ID R-0xx, severity, file:line, spec reference |
| `QUESTIONS.md` | Anything unclear, for Daniel (never answered by you) |
| `decisions/` | One file per Open item (T6) |
| `PHASE_B_PLAN.md` | T7 |
| `MORNING_REPORT.md` | T10 |

---

## T1 — Baseline (no changes)

- [ ] **T1.1** Check out the branch and create `PROGRESS.md` and `docs/overnight/`.
- [ ] **T1.2** Run `pnpm install`, `pnpm generate`, the build, and a typecheck. Start the API and confirm that `/api/v1`, `/docs` and `/openapi.yaml` respond. Stop the server afterwards.
- [ ] **T1.3** Find the existing **49 scenario checks**. Note where they live and how to run them, run them, and record the results.
- [ ] **T1.4** Write `INVENTORY.md`:
  - the modules (problems, publication, chapters, tags, licenses, users)
  - the layers (controllers → services → repositories, `domain/`, `mappers/`)
  - every `TODO Phase B` marker with file:line
  - the list of spec operations, as `operationId | method path | implemented in mock?`

## T2 — Spec validation (results to `SPEC_CHECK.md`; the spec is never edited)

- [ ] **T2.1** Lint the spec with Redocly CLI (default rules). Check that it parses and every `$ref` resolves.
- [ ] **T2.2** Write a script, `scripts/check-spec-examples`, that validates every `example`/`examples` value against its schema with AJV, OpenAPI 3.0 mode. Add it as `pnpm spec:examples`.
- [ ] **T2.3** Check the generated code for drift: regenerate it into a temp dir and diff with the committed output. Add this as `pnpm spec:drift`.
  - Drift **is expected tonight** (1.0.x vs 2.0.0). Summarize the diff by schema in `SPEC_CHECK.md`. That summary is the list of types the mock must adopt.
  - Keep `spec:drift` out of `verify` until Daniel regenerates.
- [ ] **T2.3b** Check the spec for internal consistency and report what you find (the spec is never edited). Known items:
  - `info.version` says `1.0.0`, but the changelog says 2.0.0.
  - The `createProblem` 201 example shows a set with children, although create makes one problem only.
  - The `updateProblem` description says copy holders "are notified". Check whether that matches the `updateAvailable` flag (computed on read) or implies stored notifications. See O2.
- [ ] **T2.4** Convention check against §6 Decided:
  - `/api/v1` prefix
  - PATCH only
  - action endpoints as `POST /{id}/verb`
  - one-level nesting
  - one shared pagination and error format (RFC 9457 with `code`)
  - every operation states who may call it
  - IDs are Sqids strings
  - error `code` values in the spec match `error-codes.ts`
- [ ] **T2.5** List every issue with a severity. Anything that touches an Open item is listed under that item, not as an error.

## T3 — Test harness

- [ ] **T3.1** Use the test runner the repo already has; if there is none, use Jest with ts-jest, which matches NestJS defaults. Add supertest.
- [ ] **T3.2** Build an app factory for tests. It creates a fresh Nest app from the real `AppModule` **for each test file**, so each file gets a clean `MockDatabase`. This must not change anything in `src`.
- [ ] **T3.3** Add login helpers that return headers for `jan`, `eva`, `petr`, and for no token at all.
- [ ] **T3.4** Add a contract validation helper. Every response's status and body are validated automatically against `openapi.yaml` (AJV, built from the spec). Any drift fails the test.
- [ ] **T3.5** Add store assertion helpers. They read the `MockDatabase` instance from the Nest DI container (`app.get(...)`) and expose:
  - `expectRecord(collection, id, fields)`
  - `expectNoRecord`
  - `countRecords`
  - `expectDeleted`

  Put them behind a small interface (`StoreProbe`), so that in Phase B a Prisma version can replace the mock one without rewriting the tests. Each helper decodes Sqids from API responses before looking up records.
- [ ] **T3.6** Add a root `verify` script that fails fast, in this order:
  1. spec lint
  2. spec examples
  3. spec drift
  4. typecheck
  5. lint
  6. tests

  Also add `verify:quick` (everything except the e2e tests).
- [ ] **T3.7** Add a CI workflow `.github/workflows/verify.yml`. Commit it but don't push. Write `docs/TESTING.md` explaining how to run everything on Windows.

**Done when:** `verify` runs end to end.

## T4 — Test every operation (API + store)

- [ ] **T4.1** Port the 49 existing scenario checks into the harness, so they run in `verify`. If the old script is still useful, keep it as well; don't delete it.
- [ ] **T4.2** For **every spec operation**, add tests that cover:
  - **Happy path:** the response passes contract validation, **and** the store assertion shows the record exists with the right fields, owner, positions and version.
  - **Side effects in the store:**
    - copies create new records for the parent and every child
    - the original is unchanged after a copy
    - dissolve and delete leave the expected records
    - publish changes status according to trust level, and the 202 path stays as it is today (it's a Phase B TODO)
  - **Auth:**
    - 401 without a token
    - the spec's response for each role (jan/eva/petr)
    - another user's private problem is not visible or editable
  - **Validation:** a bad body or an invalid Sqid returns the spec's error with the right `code`, never a 500.
  - **Not found:** returns the spec's 404.
- [ ] **T4.3** Do **not** test behavior from §6 Open. If an operation touches an Open item, test only the parts the spec states plainly, and note in the test file which item is left untested.
- [ ] **T4.4 Operations the mock doesn't implement yet** (new in 2.0.0): still write their full tests from the spec, then mark them `it.skip('… [R-0xx not in mock]')`. Group them under one finding per operation.
  - Tomorrow these tests become the ready-made checklist for implementing 2.0.0. **Write these tests carefully; they are worth more than anything else tonight.**
  - Spec 2.0.0 rules worth their own tests:
    - **Moving a child in:** a problem moved in with `problemId` keeps its ID, no new record is created, and it gets `parentId` set.
    - **Copying a child in:** `copyFromId` creates a new record.
    - **Positions:** `afterId` missing → end, null → first, an ID → right after that child.
    - **Taking a child out:** the child becomes a standalone PRIVATE problem; the last child out makes the set a plain problem again.
    - **Optimistic locking:** the If-Match lock on `DELETE …/children/{childId}` returns 412.
    - **Child edits:** a child is edited with its own `lockVersion`, and that raises the set's `version` but not the set's `lockVersion`.
    - **`updateAvailable`:** true when the original has a newer version, cleared by take-over or dismiss, and reported only on the set itself, never on its children.
- [ ] **T4.5** Write a short results table in `INVENTORY.md`: `operation | in mock? | tests | passing | skipped (finding IDs)`.

## T5 — Review: mock vs spec (findings only, to `REVIEW.md`)

- [ ] **T5.1** Check the mock against the spec: response shapes, status codes, error codes, pagination, filters (including "a parent chapter includes its child chapters"), and author-only fields.
- [ ] **T5.2** Look at code quality where it affects Phase B:
  - logic in controllers that belongs in `domain/`
  - duplicated rules
  - places where swapping in Prisma will be hard
- [ ] **T5.3** Look at security-relevant mock behavior that must survive into Phase B: ownership checks, visibility rules, and no raw integer IDs leaking.
- [ ] **T5.4** For every finding, record: ID, severity, file:line, the spec or decision reference, and a suggested fix. **Fix nothing.**

## T6 — Decision prep: one file per Open item (`docs/overnight/decisions/O-x.md`)

For each item in §6 Open:
- **Current state:** what the spec says, what the mock does, and what the conflicting decision says, quoted from §6.
- **Options:** 2–3, each with pros, cons, and impact on the spec, the mock code, the tests, and Phase B.
- **A sketch:** for options that change the spec, a sketch of the changed operations, written in the file and **not applied** to the spec.
- **"What I'd look at first":** one line at most. No recommendation presented as a decision.

## T7 — Phase B plan (document only: `PHASE_B_PLAN.md`)

- [ ] **T7.1 Data model the mock implies:** every entity and field the mock and the spec use, with types, nullability and relations. Daniel will compare this with his dbdiagram schema tomorrow, so list exactly what a Prisma schema must contain to serve the current spec.
- [ ] **T7.0 Mock → 2.0.0 plan:** before Prisma, the mock must catch up with spec 2.0.0. List the changes per module in implementation order, using the T4.4 skipped tests and the T2.3 drift summary, with the files affected.
- [ ] **T7.2 Swap plan:** go through the `TODO Phase B` markers one by one: `MockDatabase` → PrismaService plus transactions, `MockAuthGuard` → JWT with refresh tokens, the 202 path storing a `problem_revision`, `minor_version` for trusted edits, real fractional indexing, and attachments on copy. For each marker, give the files affected and the order of work.
- [ ] **T7.3 Test reuse:** which T4 tests carry over unchanged once a Prisma `StoreProbe` exists, and which will need a real DB (Docker test Postgres).
- [ ] **T7.4 Risks:** decisions from §6 Open that block Phase B steps.

## T8 — Extra tests (only if T1–T7 are done)

- [ ] Property-based tests (fast-check) for:
  - Sqids round-trip
  - position ordering, through the existing helper's public behavior
- [ ] Pagination and filter edge cases:
  - an empty page and the last page
  - the maximum page size
  - combined filters
- [ ] A coverage report (lcov), plus the 5 least-covered files in `src`.

## T9 — Docs for the maturita (only if time remains)

- [ ] Write `architecture.md`:
  - module map
  - request lifecycle (guard → pipe → controller → service → repository)
  - error handling flow
  - how spec-first generation works
  - how `verify` works
- [ ] Write `codebase-walkthrough.md`: the code in reading order, so Daniel can explain every part himself.
- [ ] Write `defense-questions.md`: 30 likely examiner questions about this backend, with short answers pointing to file:line. Put the answers in a separate section at the end, so Daniel can quiz himself first.

## T10 — Morning report (mandatory, start by 13:15)

Write `docs/overnight/MORNING_REPORT.md`, readable in about 20 minutes:
1. **Verdict:** does `verify` pass? Give pass/fail/skip counts compared with the T1 baseline.
2. **Spec check:** the top issues.
3. **Operation table:**
   `operation | tested | contract-valid | store-verified | findings`
4. **What the store checks proved:** which records are created, copied, deleted, and published correctly.
5. **Open decisions:** one line per `decisions/O-x.md`, with a link to the file.
6. **Findings:** critical and high first.
7. **Phase B plan:** a summary plus the first 3 steps.
8. **What changed:** commit list and new dev dependencies.

Make a final commit and set `PROGRESS.md` to `RUN COMPLETE`.

---

## 6. Decisions

### Decided (use these as "correct" together with the spec)

- **Stack:** NestJS + TypeScript, PostgreSQL via Prisma (Phase B), JWT with refresh tokens (Phase B), Cloudflare R2 for images, Docker. Monorepo, modular monolith.
- **Spec-first:** `openapi.yaml` leads, and Zod schemas and types are generated from it.
- **IDs:** integer in the DB, Sqids in the API. Ordered positions are string fractional-indexing values.
- **Scope:** a closed system for teachers. Anonymous users get access only via a share code (Phase C).
- **Trust levels:**
  - registered (unverified) teachers can view public content and create their own, but cannot publish
  - untrusted verified teachers go through review on first publish and on edits to published content
  - trusted teachers and admins publish directly
- **Problem content:** result is nullable; language is nullable and is an independent filter. Solution exists only as a later extension.
- **Licences:** irrevocable once set, and shown on problems.
- **Chapters:**
  - a personal chapter may sit under a global one
  - filtering by a parent includes its child chapters
  - chapters are ordered by name
- **Copies:** copies are new records. Only global tags and chapters are copied, unless the caller owns the original. Copies point to the same stored images.
- **API conventions:**
  - `/api/v1` prefix
  - plural nouns
  - nesting max one level
  - PATCH only
  - actions as `POST /resource/{id}/verb`
  - shared pagination
  - RFC 9457 errors with `code`
  - every operation states who may call it
- **Block model (spec 2.0.0):**
  - problems are created one at a time
  - sets are built with `POST/PATCH/DELETE /problems/{id}/children`
  - your own PRIVATE standalone problem is **moved** in (`problemId`); any visible problem can be **copied** in (`copyFromId`)
  - positions use `afterId`
- **Copy updates (spec 2.0.0):**
  - `updateAvailable` is **computed on read, not stored**
  - the author acts on it with `take-over-update` or `dismiss-update`
- **Filters (spec 2.0.0):** several `tagId`/`chapterId` values match problems having **any** of them.

### Open — do NOT decide, do NOT test, do NOT treat as bugs (write up in T6)

- **O2 Notifications for copy holders.** `updateAvailable` is decided (computed on read). Still open: the `updateProblem` description says copy holders "are notified". Does that mean only the flag, or also stored notification rows? Older notes planned notifications.
- **O3 PDF export.** Client-side printing was decided, but older notes plan a BullMQ + Redis + Puppeteer export queue.
- **O4 Source type when copying your own problem.** The spec says OWN → LICENSED_USE citing the original author, with no exception for copying your own problem. The mock does the same. It probably should stay OWN.
- **O5 Marking auto-approved revisions.** How to mark one is undecided. `moderation_log.actor_id` is meant for admins only. Automatic actions may go to a separate table.
- **O7 Deviations from the structure doc** (to confirm):
  - NestJS 11 instead of 12
  - an own `ZodValidationPipe` instead of `nestjs-zod`
  - a new `licenses` module
- **O8 Version bump.** `info.version` is still `1.0.0` although the changelog describes 2.0.0. Report it in `SPEC_CHECK.md`; Daniel fixes it himself.

(O1 and O6 were settled by spec 2.0.0 and moved to Decided. Don't create files for them in T6.)
