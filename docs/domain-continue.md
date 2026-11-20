# Where to continue

The working plan for the round that started 2026-11-20. Tick the boxes as steps land; delete this file when every step is done or has moved somewhere else.
Decisions and their reasons are in `DECISIONS-11-1.md`; how the domain behaves is in `DOMAIN.md`.

## Context

The design review (2026-11-15/16, decisions D-15–D-39) is done. It is uncommitted, and parts of it were stale: steps 2–4 of the old resume file and §5 of `DOMAIN.md` still described the 202 path that D-25 replaced. Daniel's direction for this round:

- **The real work:** get **sets** and **worksheets** working correctly. Publishing, sharing and copy updates come later.
- **Docs:** short. Write this plan into the repo, fix the one real hole (pulling must not cut the public copy loose), and cut the rest.
- **Code split for worksheets:** I write the spec and the scaffolding. Daniel writes `WorksheetsService` and the two repositories against TODOs. Then I review.

This file replaced the resume point of the 2026-11-15/16 design review; `domain-review-notes.md` was folded in and deleted.

Baseline (`pnpm verify --quick`): everything passes except **lint**, which fails on `prisma-problems.repository.ts:270` (`_ignored`).

---

## Phase 0 — Docs, minimal (me)

- [x] `docs/domain-continue.md` ← this plan. The round-3 open items move into a short "Later" list at the end.
- [x] `docs/DECISIONS-11-1.md`, section "2026-11-20 (sets and private worksheets)": **proposed** rows waiting for Daniel's confirmation.
  - D-40–D-45: private worksheets (scope, adding, removing, counters, order, deleted problems).
  - D-46: pulling never deletes the public copy (status `WITHDRAWN`, link and history kept; revises D-26, D-34, D-39).
  - D-47–D-49: confirm the current set behaviour (the 4 `DOMAIN-REVIEW` rules, Q-008, a removed child is PRIVATE).
  - D-50: the 202 path stays until D-25.
- [x] `docs/DOMAIN.md`: a banner at §5.2 and on the 202 rows of §6 ("replaced by D-25, rewrite pending"), §8 points to D-36/D-46, and a short §9 Worksheets (D-40–D-45). No full rewrite now.
- [x] Delete `docs/domain-review-notes.md`. Everything in it is applied or carried over: the A-01/A-05 wording and "in code, not written down" go into the Later list.
- [x] Lint fix: `ignoreRestSiblings: true` (and `argsIgnorePattern: '^_'`) on `@typescript-eslint/no-unused-vars` for all API source in `eslint.config.mjs`. That covers exactly the `{ lockVersion: _ignored, ...rest }` pattern and the `_`-parameters of TODO stubs.

**The 202 path (D-50):** it stays as it is in this round. Removing it before D-25 exists would let a non-trusted author change published content directly (breaks G-1). It goes away together with D-25 in spec 4.0.0. Worksheets are private, so they never return 202.

---

## Phase 1 — Sets work correctly (me; tests first)

Files: `modules/problems/services/problem-sets.service.ts`, `services/problems.service.ts`, `repositories/problems.repository.ts`, `mock-problems.repository.ts`, `prisma-problems.repository.ts`, `database/mock-database.ts`.

1. [x] **Atomic set lock (D-11 for sets).** Replace "check against the earlier read, then renumber, then `update(+1)`" with one repository call: `restructureIfLockVersion(setId, expectedLockVersion, orderedChildIds, placement)`.
   - In one transaction: a guarded `updateMany … WHERE lock_version = ? AND deleted_at IS NULL` that sets `lock_version+1` and `version+1`, then the problem_part changes (insert or delete the part row for a move in or out, update the moved child's status and licence) and the two-pass renumber.
   - 0 rows → `null` → 409 `LOCK_MISMATCH` (412 on remove).
   - The mock does the same with no `await` between the check and the write, the same pattern as `updateIfLockVersion`.
2. [x] **Q-004:** add, reorder and remove raise the set's `version` (inside item 1).
3. [x] **D-15:** `update()` raises `version` only when a content field (from `domain/content-fields.ts`) actually changed. A tags- or chapters-only change raises `minor_version`. Both as in-place increments (no "read + 1"); the parent set's `incrementVersion` only on a content change.
   - Add `minorVersion` to `ProblemRow`, the mock seed and the Prisma mapping.
   - The repository gets `incrementVersion(id, 'version' | 'minor')`, or a flag in `updateIfLockVersion`.
4. [x] **Mock/Prisma parity on reorder:** the mock's `renumberChildren` stops going through `update()`, so `updatedAt` of the children stays the same, as in Prisma.
5. [x] Spec wording only (goes in the 3.1.0 changelog): `ProblemDetail.version` says "only content changes; a structure change of a set raises it too".
6. [x] Tests:
   - in `test/sets/*.e2e-spec.ts`, `version+1` on add, reorder and remove;
   - two concurrent structure changes with the same `lockVersion` (`Promise.all`) → exactly one 200 and one 409/412, with consistent positions in the store;
   - in `test/problems/update.e2e-spec.ts`, a tags-only PATCH leaves `version` alone and raises `minorVersion` (store);
   - fix any existing assertions that expect the old behaviour;
   - run `pnpm test` and `pnpm test:prisma` (the Prisma repo is where atomicity really matters).
   - Done, kept small: `version` asserted in the existing lockVersion tests of add/reorder/remove; one race test each in `add-child` (copy-in, the loser's copy is removed) and `reorder-child`; two D-15 tests in `update.e2e-spec.ts`. `pnpm verify` green on the mock.
     **Still to run:** `pnpm test:prisma` (needs Docker Desktop running).
   - As built: the repository method is `restructureIfLockVersion(setId, expected, { order, attach?, detach? })`, and `updateIfLockVersion` takes a `bump: 'version' | 'minorVersion'`. A copy made for a `copyFromId` request that then loses the lock race is soft-deleted again. Removal now renumbers the remaining children too.

---

## Phase 2 — Worksheets (spec 3.1.0)

### 2a. Spec, contracts, schema (me)

> **Done 2026-11-20.** Spec 3.1.0 applied (the contracts deny rules in `.claude/settings.json` were lifted for the edit, then restored). Contracts rebuilt with no drift, `ALREADY_IN_WORKSHEET` added to `error-codes.ts`, `contract.spec.ts` now counts 29 operations.

- [x] `packages/shared/contracts/openapi.yaml` → `version: 3.1.0` plus a changelog line, tag `Worksheets`, and an example for every operation:
  - `GET /worksheets` (own, `page`/`limit`) → `WorksheetPage`
  - `POST /worksheets` → 201 `WorksheetDetail`
  - `GET`, `PATCH` and `DELETE /worksheets/{id}` (204, soft delete)
  - `POST /worksheets/{id}/items` `{lockVersion, problemId, afterId?}`
  - `PATCH /worksheets/{id}/items/{itemId}` `{lockVersion, afterId}`
  - `DELETE /worksheets/{id}/items/{itemId}` + `If-Match` → 200 `WorksheetDetail`
- [x] Schemas:
  - `WorksheetBase` (`name`, `difficulty`, `language`), `WorksheetCreate` (`name` required, `tagIds`, `chapterIds`), `WorksheetPatch` (`lockVersion` required).
  - `WorksheetListItem` (`id`, `name`, `difficulty`, `language`, `author`, `tags`, `chapters`, `itemCount`, `updatedAt`).
  - `WorksheetDetail`: the list item plus `createdAt`, `status`, `version`, `lockVersion`, `items: ProblemDetail[]`.
  - `WorksheetPage`, the `ItemId` parameter, and the `IfMatch` wording made general.
  - `ALREADY_IN_WORKSHEET` in the `ErrorDetails` description and in `contracts/src/error-codes.ts`.
- [x] Regenerate: `pnpm --filter @matematika/contracts build && pnpm install --frozen-lockfile`.
- [x] `schema.prisma`: `worksheet.lock_version Int @default(1)`. Hand-written migration `prisma/migrations/20261120…_worksheet_lock_version` (`ALTER TABLE "worksheet" ADD COLUMN "lock_version" INTEGER NOT NULL DEFAULT 1;`), then `db:generate`.

### 2b. Scaffolding (me)

> **Done 2026-11-20**, except `requests.http`: its requests are executed by `requests-http.e2e-spec.ts`, so they go in once the service works (2d). Worksheet e2e suites: 14 `it.skip` tests in `test/worksheets/`, one per rule; run `pnpm test:unskipped` (today they fail only on the TODO 500s).

Patterns: `modules/tags` (small module) and `modules/problems` (facade, lookups, locks).

- [x] `mock-database.ts`:
  - `WorksheetRow` and `WorksheetItemRow {worksheetId, problemId, position}` (mirrors `worksheet_problem`), plus `worksheets`, `worksheetItems` and `newWorksheetId()`;
  - seed one worksheet for `jan` (a standalone problem and the seeded set) in `mock-seed.ts` and `prisma/seed-database.ts`.
- [x] `repositories/worksheets.repository.ts`: token, `NewWorksheet` and a documented interface:
  - `findById`, `findMany(authorId, page, limit)`, `countItems(ids)`, `findItems(id)` (byte order, `comparePositions`), `insert`;
  - `updateIfLockVersion(id, expected, data)`;
  - `replaceItemsIfLockVersion(id, expected, orderedProblemIds)`: the lock guard, positions and `version+1` in one step;
  - `softDelete`.
- [x] `mappers/worksheet.mapper.ts`, `dto/list-worksheets.query.ts`, and `controllers/worksheets.controller.ts` (renamed from `worksheet.controller.ts`; 8 routes; `ZodValidationPipe` with the generated schemas; `ParseIdPipe`).
- [x] `parseIfMatch` moves from `problems.service.ts` to `common/utils/if-match.ts`.
- [x] `worksheets.module.ts` uses `repositoryProvider(...)` and imports `ProblemsModule`, `UsersModule`, `TagsModule` and `ChaptersModule`. Register it in `app.module.ts`.
- [x] `ProblemsService` facade gets `findForWorksheet(user, id)` (404 like `findVisible`), `copyForWorksheet(user, row)` (via `ProblemCopiesService.copy`) and `detailsFor(user, ids)` (in the given order, deleted ones skipped).
- [x] Tag and chapter checks reuse the logic of `problem-relations.service.ts`. Export it from the problems module rather than duplicating it.
- [x] Tests:
  - `test/support/store.ts` and `prisma-store.ts` get the `worksheets` and `worksheetItems` collections, and `db-reset.ts` covers the worksheet tables;
  - `factory.ts` gets `createWorksheet`;
  - `test/worksheets/crud.e2e-spec.ts` and `items.e2e-spec.ts` cover D-40–D-45 and every error code. They start **skipped** and are unskipped part by part.
- [ ] A few worksheet requests in `apps/api/requests.http`.

### 2c. Daniel writes

The TODO above each method names the rule it implements.

- `services/worksheets.service.ts`: `list`, `get`, `create`, `update`, `remove`, `addItem`, `reorderItem`, `removeItem`, plus the `findOwn`, `detail` and `lookups` helpers.
- `repositories/mock-worksheets.repository.ts`, modelled on `mock-problems.repository.ts`.
- `repositories/prisma-worksheets.repository.ts`, modelled on `prisma-problems.repository.ts`: an `include` constant plus `toWorksheetRow`, `updateMany … WHERE lock_version` as the guard, and a two-pass renumber because of the `(worksheet_id, position)` unique index.

Until then the methods `throw new Error('TODO')`, so typecheck and lint stay green.

### 2d. Review (me)

- [ ] Unskip the worksheet tests, run `pnpm verify` and `pnpm test:prisma`, and `/code-review` Daniel's diff. Fix things together.
- [ ] Change the §9 tags in `DOMAIN.md` to `[code]`.

---

## Later (not this round)

- D-25 publishing (working row and public copy), D-46 pull, and removing the 202 path (spec 4.0.0).
- Revisions and `WITHDRAWN`, copy updates (`updateAvailable`, take-over, dismiss), D-36.
- Publishing, copying and sharing worksheets, D-39 cascade.
- Still open from round 3:
  - shared pending requests (D-22 + D-32);
  - worksheet copies in the catalogue;
  - the version of a published worksheet;
  - Q-009 and Q-010;
  - `system_event` and `license_id`;
  - a minor edit of a set child;
  - CI (`verify.yml` deleted?) and terminology ("úloha").
- Spec wording A-01 (Secure only in production) and A-05 (PUT).
- In code, not written down: blocked refresh → 403 + family revoked; CORS origins; the login dummy hash.

## Verification

- After Phase 0 and 1: `pnpm verify` is green, including lint and the new set tests. `pnpm test:prisma` is green, with the concurrency test passing against Postgres.
- After 2a and 2b: `pnpm verify` is green: spec 3.1.0, no drift, worksheet suites skipped.
- After 2c and 2d: `pnpm verify` and `pnpm test:prisma` are green with the worksheet suites unskipped. Smoke test with `requests.http` against `pnpm dev:api`.

## Commits (only when Daniel asks; branch `daniel`)

1. `docs(domain): plan, worksheet decisions D-40–D-45, pull keeps the public copy (D-46), set confirmations D-47–D-50`
2. `fix(sets): atomic structure lock, version on structure changes (Q-004, D-11, D-15)` with the lint fix
3. `feat(spec): worksheets API 3.1.0` with the contracts and the migration
4. `feat(worksheets): module scaffolding and e2e tests`
5. Daniel's `feat(worksheets): service and repositories`
