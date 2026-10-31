# Review — mock vs spec 2.0.0 (findings only, nothing fixed)

Written by the overnight run (T4 + T5), 2026-10-31. The spec (`openapi.yaml`, 2.0.0) is the reference, and so is
§6 "Decided" in the runbook. Anything that touches a §6 **Open** item is not a finding; those are written up in `decisions/`.

**Severity:**
- **critical**: data loss or a security hole
- **high**: a spec operation is unusable or returns wrong data
- **medium**: wrong status or code, so a client would need a workaround
- **low**: cosmetic, docs, hygiene, or a Phase B concern

Every finding a test proves has `it.skip('… [R-0xx]')` tests that name it. `pnpm --filter @matematika/api test:unskipped`
runs them. A skipped test that starts passing means the mock caught up and the `.skip` can go. Four skipped 404 tests
pass today by accident (Nest's own 404 for a missing route looks like the spec's 404); each is marked in its file.

**Fix nothing** was the rule tonight: every "suggested fix" below is a suggestion, not applied.

## Summary

| ID | Severity | Summary | file:line | Spec / decision | Tests (skipped) |
|---|---|---|---|---|---|
| R-001 | high | API crashes at startup with spec 2.0.0 (YAML alias limit) | `apps/api/src/main.ts:16` | spec file; SPEC_CHECK S-1; Q-003 | none (startup; TESTING.md) |
| R-015 | high | `createProblem` without `name`/`assignment` → 201 and a nameless row is stored | `problems.service.ts:80`; generated `zProblemCreate` | `ProblemCreate.required: [name, assignment]` | `create` 1 |
| R-002 | high | `addSetChild` not in mock | (no route) | `POST /problems/{id}/children` | `sets/add-child` 37 |
| R-003 | high | `reorderSetChild` not in mock | (no route) | `PATCH /problems/{id}/children/{childId}` | `sets/reorder-child` 21 |
| R-004 | high | `removeSetChild` not in mock (incl. If-Match / 412) | (no route) | `DELETE /problems/{id}/children/{childId}` | `sets/remove-child` 18 |
| R-005 | high | `takeOverUpdate` not in mock | (no route) | `POST /problems/{id}/take-over-update` | `copies/update-available` 13 |
| R-006 | high | `dismissUpdate` not in mock | (no route) | `POST /problems/{id}/dismiss-update` | `copies/update-available` 6 |
| R-007 | high | `listProblems`: no `ids` / `updateAvailable` filters; no `updateAvailable` field anywhere | `dto/list-problems.query.ts:7`; `problem.mapper.ts:42` | `IdsFilter`, `UpdateAvailableFilter`, `ProblemListItem.updateAvailable`; §6 "computed on read" | `list` 4, `copy` 1, `copies` 10 |
| R-009 | high | `updateProblem` refuses set children (409); a child edit can't raise the set's version | `problems.service.ts:113-115` | updateProblem description; `ProblemDetail.version` | `update` 5 |
| R-008 | medium | `ProblemDetail` lacks `originalId`; children lack their own `lockVersion` | `problem.mapper.ts:66-76` | `ProblemDetail.originalId`, `ProblemDetailCore.lockVersion` | `get` 2, `create` 1, `copy` 1 |
| R-010 | medium | Set child on delete/dissolve → code `SET_CHILD_EDIT_VIA_PARENT`, spec says `IS_SET_CHILD` | `problems.service.ts:151,164` | deleteProblem, dissolveSet codes; changelog 2.0.0 | `delete` 1, `dissolve` 1 |
| R-012 | medium | `error-codes.ts` out of sync with spec 2.0.0 | `packages/shared/contracts/src/error-codes.ts:15` | `ErrorDetails.code` list | none (static) |
| R-013 | medium | `listProblems`: a malformed `tagId`/`chapterId` is dropped, so the filter **widens** to all problems | `problems.service.ts:48-49` | `TagIdFilter`/`ChapterIdFilter` items are Sqids; 400 VALIDATION_FAILED | `list` 1 |
| R-011 | low | `createProblem`/`updateProblem` still accept the 1.0.x `children` array (whole-set editing) | `problems.service.ts:69-74,106,119-129,144` | 2.0.0 changelog "children removed"; "Creates one problem" | `create` 1 |
| R-014 | low (mock) | Any unknown bearer token logs in as jan | `common/guards/mock-auth.guard.ts:22` | `Unauthorized` 401; Phase B B1 | `pickers` 1 |
| R-016 | low | Trust rule duplicated: "may change published content directly" in `ProblemsService.update`, "publish status by trust" in `publish-rules.ts` | `problems.service.ts:131`; `publication/domain/publish-rules.ts:4` | §6 trust levels | none |
| R-017 | low | `ProblemDetailsFilter` has no title for 412 and no code mapping for it | `common/filters/problem-details.filter.ts:7-21` | `PreconditionFailed` response | none (needed by R-004) |
| R-018 | low | Error `requestId` echoes the client's `X-Request-Id` header unchecked | `problem-details.filter.ts:32` | (hygiene) | none |
| R-019 | low (Phase B) | Data-access shapes that make the Prisma swap harder | see details | T5.2 | none |
| R-020 | low now, medium in Phase B | Set children are ordered with locale-dependent `localeCompare` (cs-CZ: "ch" after "i"; case order ignored) | `problems.repository.ts:32` | §6 "positions are string fractional-indexing values" | `properties` 1 |

Counts: high 9, medium 4, low 7. No critical findings: the ownership and visibility checks hold everywhere the tests looked (see T5.3 below).

## Details

### R-001 — API crashes at startup with spec 2.0.0 (high)
- **Where:** `apps/api/src/main.ts:16`: `parse(readFileSync(…openapi.yaml))` with the `yaml` package defaults.
- **What:** spec 2.0.0 has 27 anchors / 58 aliases (`&id001` …). `yaml`'s default `maxAliasCount: 100` counts alias
  expansions and throws `ReferenceError: Excessive alias count`. `node dist/main` exits before listening.
- **Not affected:** the test harness (it builds the app without `main.ts`; `test/support/contract.ts` parses with a raised limit).
- **Suggested fix:** either `parse(text, { maxAliasCount: -1 })` in `main.ts`, or a spec without anchors (Q-003).

### R-015 — createProblem accepts a body without name/assignment (high)
- **Where:** the controller validates with the generated `zCreateProblemBody` (`problems.controller.ts:36`). In the spec,
  `ProblemCreate` is `allOf: [ProblemBase, {required: [name, assignment], properties: {tagIds, chapterIds}}]`. `name` and
  `assignment` are declared in `ProblemBase` (optional there), and `@hey-api/openapi-ts` drops a `required` entry whose
  property is not declared in the same branch. So `zProblemCreate` has `name`/`assignment` optional. The service then
  does `name: body.name!` (`problems.service.ts:80`) and stores `name: undefined`.
- **Proof:** `POST /problems {"assignment":"A"}` → 201; the response has no `name` (the contract check flags it); the row is stored.
- **Same pattern elsewhere:** checked: `ProblemPatch.required: [lockVersion]` survives because `lockVersion` is declared
  in the same branch. `ProblemChildInput` (1.0.x) was guarded by hand in `set-rules.ts:11`.
- **Suggested fix (not applied, src is read-only):** either declare `name`/`assignment` in the `ProblemCreate` branch of the spec
  (spec change, Daniel), or refine the schema in the controller, or check in the service. The 2.0.0 regeneration has the same shape.

### R-002 … R-006 — 2.0.0 operations missing in the mock (high)
Nest answers its own 404 (`Cannot POST …`) for these routes. The tests are written from the spec and skipped. They are
the implementation checklist for the mock's 2.0.0 catch-up (`PHASE_B_PLAN.md` T7.0). Spec rules with their own tests:
- **Move vs copy** (`add-child`): moved problem keeps its id, no new record, gets `parentId`; `copyFromId` creates a
  new record linked to the original, original row unchanged.
- **Positions** (`add-child`, `reorder-child`): `afterId` missing → end, null → first, id → right after; existing children keep their records.
- **Taking out** (`remove-child`): same record, standalone PRIVATE; last child out → `childCount 0`, and a result is allowed again.
- **If-Match** (`remove-child`): mismatch → 412 `LOCK_MISMATCH`; missing/malformed → 400.
- **Child edits** (`update`, R-009): own `lockVersion`; raises the set's `version`, not its `lockVersion`.
- **updateAvailable** (`copies`, R-007): true after the original's new version, cleared by take-over/dismiss, comes back
  on the next version, only on the set itself and only for the copy's author.

### R-007 — listProblems: new 2.0.0 filters and field missing (high)
- **Where:** `list-problems.query.ts:7-14` has no `ids` and no `updateAvailable`. Zod strips unknown keys, so `?ids=x`
  returns the **unfiltered** list (a batch read silently returns too much) and `updateAvailable` with `scope=public` is
  not rejected. `toListItem` (`problem.mapper.ts:42`) and `toDetail` never set `updateAvailable`.
- **Suggested fix:** add both params to the query DTO (or use the regenerated 2.0.0 query schema), filter in
  `ProblemsRepository.findMany`, compute `updateAvailable` from `originalProblemVersion` vs the original's current `version`
  (plus a stored "dismissed version", needed for R-006).

### R-008 — originalId and per-child lockVersion missing (medium)
- **Where:** `toDetail` (`problem.mapper.ts:66-76`) adds `status`, `version`, `lockVersion` for the author, but not
  `originalId`; children go through `toDetailCore` (`:75`), which has no `lockVersion`.
- **Effect:** the editor can't edit a child directly (R-009 needs the child's lockVersion) and can't open the original
  before a take-over. Contract-valid today, because these fields are optional in the schema.

### R-009 — set children cannot be edited directly (high)
- **Where:** `problems.service.ts:113-115` throws 409 `SET_CHILD_EDIT_VIA_PARENT`. Spec 2.0.0: "Works on any problem,
  including a set child … Editing a set child also raises the set's version … does not change the set's lockVersion."
- **Suggested fix:** drop the guard; in the child path bump the parent's `version` only; the 202 rule checks the parent's status.

### R-010 — wrong code for set-child refusals (medium)
- `problems.service.ts:151` (delete) and `:164` (dissolve) return `SET_CHILD_EDIT_VIA_PARENT`; 2.0.0 renamed it to `IS_SET_CHILD`.
  The 409 status is right (tested and passing); only the code is wrong (skipped tests).

### R-011 — 1.0.x `children` still accepted (low)
- The mock still builds/edits whole sets from `children` (`problems.service.ts:69-74,106` create, `:119-129,144` patch,
  `problem-sets.service.ts`). The 2.0.0 schemas don't declare `children`, so a 2.0.0 client never sends it. It still
  conflicts with "Creates one problem", and the code is dead weight for Phase B. Ported baseline scenarios 4 and 5
  (`requests-http.e2e-spec.ts`) document the current behaviour.

### R-012 — error-codes.ts out of sync (medium)
- `packages/shared/contracts/src/error-codes.ts`: missing `IS_SET_CHILD`, `CANNOT_ADD_TO_SET`, `NO_UPDATE_AVAILABLE`;
  still has `SET_CHILD_EDIT_VIA_PARENT` (`:15`). Same as SPEC_CHECK T2.4. Not in `apps/api/src`, but it is the mock's code list.

### R-013 — malformed filter ids widen the list (medium)
- **Where:** `problems.service.ts:48-49` maps `decodeId` and **filters out** nulls. `?tagId=!!!` becomes `tagIds: []`,
  and `findMany` treats an empty list as "no filter" (`problems.repository.ts:49-50`), so every problem in the scope is returned.
- **Why it matters:** a typo in a filter returns more, not less. Not a leak (scope rules still apply).
- **Suggested fix:** 400 `VALIDATION_FAILED` for a malformed Sqid (the list declares 400), or keep invalid ids as "matches nothing".

### R-014 — mock login accepts any token (low, mock by design)
- `mock-auth.guard.ts:22`: an unknown token falls back to jan (trusted). Documented in the guard. Listed so Phase B's JWT
  guard gets a test: the skipped test in `pickers.e2e-spec.ts` becomes the "invalid token → 401" check.

### R-016 — trust rule in two places (low, T5.2)
- "Who may change published content without review" is `user.trust !== 'TRUSTED' && user.role !== 'ADMIN'` inline in
  `ProblemsService.update` (`:131`), while the publish rule lives in `publication/domain/publish-rules.ts`. takeOverUpdate
  and the `/children` operations need the same 202 rule (four call sites in 2.0.0). Suggest one pure function in `domain/`.

### R-017 — filter not ready for 412 (low)
- `TITLES`/`CODE_BY_STATUS` (`problem-details.filter.ts:7-21`) have no 412 entry, so a 412 would get title `Error`.
  The spec's example title is `Precondition Failed`. Only matters once R-004 is implemented with `ApiError`.

### R-018 — requestId echoes the client header (low)
- `problem-details.filter.ts:32` uses `X-Request-Id` from the request as is (any length, any content) in the body.
  Harmless in JSON, but in Phase B logs it lets clients choose log correlation ids. Suggest validating or always generating one.

### R-019 — Phase B friction in data access (low, T5.2)
- `ProblemsRepository.update` mutates and returns the live row (`problems.repository.ts:63-67`); services rely on
  object identity (e.g. `update()` then `applyChildren(updated)`). Prisma returns copies.
- `source` is embedded in the problem row; in the DB it's `content_source` (1:1). Tag/chapter links are id arrays on the
  row; in the DB they are join tables. The repository is the only place that needs to change, but `findMany`'s
  tag/chapter filters become relation filters (`some: { tagId: { in } }`).
- `ChaptersService.withDescendants` loads all chapters and loops; in Postgres that is a recursive CTE or a cached tree.
- `countChildren` scans all problems; in Prisma a `_count` or `groupBy`.
- `ProblemSetsService.planChildren/applyChildren` relies on "check everything, then write" without a transaction
  (`problem-sets.service.ts:31` says so). Every multi-row operation (copy of a set, dissolve, publish of a set,
  take-over of a set) needs `prisma.$transaction` in Phase B.
- `positionAt(i)` renumbers every child on each save (B2). With the 2.0.0 single-child operations, real fractional
  indexing (insert between neighbours) is needed so a move touches one row.

### R-020 — locale-dependent ordering of positions (low now, medium in Phase B)
- **Where:** `ProblemsRepository.findChildren` (`problems.repository.ts:32`) sorts by `position.localeCompare(other)` with
  **no locale**, so the result depends on the server's default ICU locale. On this machine it is `cs-CZ`.
- **Found by:** fast-check (T8, `test/properties.spec.ts`). Under cs-CZ, "ch" is one letter sorted after "h" and even after "i":
  `positionAt(583200) = "aci00"` sorts before `positionAt(581904) = "ach00"`. localeCompare also puts `"ab"` before `"aB"`;
  fractional-indexing keys need byte order (`"aB" < "ab"`).
- **Today:** harmless in practice (needs > 580 000 children, because `positionAt` pads to 4 base-36 digits).
- **Phase B (B2):** real fractional-indexing keys are short, mixed-case base62 strings ("a0", "a0V", "Zz"…), so a set's
  order would come out wrong, and differently on servers with different locales. Postgres `ORDER BY position` also depends on
  the column collation: use `COLLATE "C"` (or a `bytea`/C-collated column) for positions.
- **Suggested fix:** compare with `<`/`>` (byte order) in the repository; in Prisma, a C-collated column. The test StoreProbe
  (`test/support/store.ts`) had copied the same comparator and was switched to byte order tonight (test code only).

## T5.1 — what else was checked and found consistent with the spec

- Response shapes: every response in 189 passing tests passes the strict contract check (undeclared fields fail).
- Status codes and error codes: 401/403/404/409 and their codes match the spec on all implemented operations, apart from R-010.
- Pagination: `page`/`limit` defaults, max 100, empty page past the end with the real `total` (list and tags).
- Filters: several `tagId`/`chapterId` = ANY; different filters = AND; **a parent chapter includes its child chapters** (and not the reverse).
- Author-only fields: `status`, `version`, `lockVersion` only for the author; never on list items.

## T5.3 — security-relevant behaviour that must survive into Phase B (all hold today, all tested)

- A foreign PRIVATE problem: 404 on get/patch/delete/copy/publish/dissolve, and the 404 body is identical to a missing id's (no existence leak).
- A foreign PUBLISHED problem: 403 on patch/delete/publish/dissolve; readable and copyable.
- Set children of a foreign private set are invisible (404), including via copy.
- Personal tags/chapters of another teacher are neither listed nor attachable (400).
- Copies of a foreign original keep only global tags/chapters; the original is never modified by a copy.
- Raw integer ids are never accepted in paths (`/problems/4` → 404) and never appear in responses (every id is a Sqid; the contract check plus `toDbId` decoding in the store probe).
- Malformed ids never cause a 500 (path → 404; body → 400), except R-013's widening.
