# Review — mock vs spec 2.0.0 (findings only, nothing fixed)

Written by the overnight run (T4 + T5). The spec (`openapi.yaml`, 2.0.0) is the reference; §6 Decided
of the runbook counts as correct too. Items that touch a §6 **Open** item are not findings; they are in
`decisions/`.

Severity: **critical** (data loss / security) · **high** (spec operation unusable or wrong data) ·
**medium** (wrong status/code, a client would have to work around it) · **low** (cosmetic, docs, hygiene).

Every finding that a test proves has `it.skip('… [R-0xx]')` tests that name it. `pnpm --filter @matematika/api test:unskipped`
runs them: a skipped test that starts passing means the mock caught up and the `.skip` can go.

| ID | Severity | Summary | file:line | Spec / decision | Tests |
|---|---|---|---|---|---|
| R-001 | high | API crashes at startup with spec 2.0.0 (YAML alias limit) | `apps/api/src/main.ts:16` | spec 2.0.0 file, S-1, Q-003 | — (startup, see TESTING.md) |
| R-002 | high | `addSetChild` not in mock | — (no route) | `POST /problems/{id}/children` | `sets/add-child.e2e-spec.ts` |
| R-003 | high | `reorderSetChild` not in mock | — (no route) | `PATCH /problems/{id}/children/{childId}` | `sets/reorder-child.e2e-spec.ts` |
| R-004 | high | `removeSetChild` not in mock | — (no route) | `DELETE /problems/{id}/children/{childId}` | `sets/remove-child.e2e-spec.ts` |
| R-005 | high | `takeOverUpdate` not in mock | — (no route) | `POST /problems/{id}/take-over-update` | `copies/update-available.e2e-spec.ts` |
| R-006 | high | `dismissUpdate` not in mock | — (no route) | `POST /problems/{id}/dismiss-update` | `copies/update-available.e2e-spec.ts` |
| R-007 | high | `listProblems`: no `ids` / `updateAvailable` filters, no `updateAvailable` field | `apps/api/src/modules/problems/dto/list-problems.query.ts:7` | `IdsFilter`, `UpdateAvailableFilter`, `ProblemListItem.updateAvailable` | `problems/list.e2e-spec.ts`, `copies/update-available.e2e-spec.ts` |

_Details below. Rows are added as the tests are written._

## Details

### R-001 — API crashes at startup with spec 2.0.0 (high)
- **Where:** `apps/api/src/main.ts:16`: `parse(readFileSync(…openapi.yaml))` with the `yaml` package defaults.
- **What:** spec 2.0.0 has 27 anchors / 58 aliases (`&id001` …). `yaml`'s default `maxAliasCount: 100` counts alias
  expansions and throws `ReferenceError: Excessive alias count`. `node dist/main` exits before listening.
- **Not affected:** the test harness (it builds the app without `main.ts`; `test/support/contract.ts` parses with a raised limit).
- **Suggested fix (not applied):** either `parse(text, { maxAliasCount: -1 })` in `main.ts`, or a spec without anchors (Q-003). Daniel's call.

### R-002 … R-006 — 2.0.0 operations missing in the mock (high)
Nest answers its own 404 (`Cannot POST …`) for these routes. The tests are written in full from the spec and skipped;
they are the implementation checklist for the mock's 2.0.0 catch-up (see `PHASE_B_PLAN.md` T7.0).

### R-007 — listProblems: new 2.0.0 filters missing (high)
- **Where:** `list-problems.query.ts:7-14` has no `ids` / `updateAvailable`. Zod strips unknown keys, so `?ids=x` returns the
  **unfiltered** list (a batch read silently returns too much) and `updateAvailable` with `scope=public` is not rejected.
  `toListItem` (`problem.mapper.ts:43`) never sets `updateAvailable`.
- **Suggested fix:** add both params to the query DTO (or use the regenerated `zListProblemsData` query schema), filter in
  `ProblemsRepository.findMany`, compute `updateAvailable` in the mapper from `originalProblemVersion` vs the original's `version`.
