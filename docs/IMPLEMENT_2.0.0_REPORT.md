# Implementation report: mock backend → spec 2.0.0

Branch `overnight/2026-10-31`, steps I1–I7 of `IMPLEMENT_2.0.0.md`, one commit per step (`c448656` … `991e2a9`), plus `81d85f3` and `4f17274` (memory caps).

## 1. `verify`

`pnpm verify` **PASSED** in 17.7 s: spec lint, spec examples, spec version, spec drift, typecheck (src + tests), lint, tests.

| | Before (start of I1) | After |
|---|---|---|
| Test suites | 18 (1 skipped) | 18 (1 skipped) |
| Passing | 203 | **287** |
| Skipped | 132 | **48** |
| Failing | 0 | 0 |
| Total | 335 | 335 |

84 tests were un-skipped: 37 `addSetChild`, 21 `reorderSetChild`, 18 `removeSetChild`, 4 R-008 (`originalId`, per-child `lockVersion`), the R-015 create validation test and the R-021 create/property tests. The 2 `requests.http` scenarios (4, 5) were skipped in I1 and replaced in I7, so the total stays 335.

## 2. `DOMAIN-REVIEW` locations

Business rules I picked where the spec is silent or ambiguous. A human should confirm each one.

| Where | Rule |
|---|---|
| `apps/api/src/modules/problems/domain/copy-rules.ts:11` | O-4: a copy of your own `OWN` problem stays `OWN` with no citation; the licence is still inherited. Copying someone else's problem is `LICENSED_USE` with "Převzato od: …". |
| `apps/api/src/modules/problems/services/problem-sets.service.ts:59` | Move: only your own `PRIVATE` standalone problem can move into a set (same record, no copy). Someone else's problem → 409 `CANNOT_ADD_TO_SET`. |
| `…/problem-sets.service.ts:71` | `afterId` on add: missing = end, `null` = first, a child id = right after that child. |
| `…/problem-sets.service.ts:82` | Inheritance on add: the child takes the set's status. In a `PUBLISHED` set a child without a licence takes the set's licence; a licence that forbids publication is refused. |
| `…/problem-sets.service.ts:119` | Reorder: `afterId` is required; `null` = first, a child id = right after that child. |
| `…/problem-sets.service.ts:152` | Remove: the child becomes a standalone `PRIVATE` problem; when it was the last child the set is a plain problem again. |

## 3. Tests whose expectations changed

| Test | Change | Why |
|---|---|---|
| `actions/copy.e2e-spec.ts` | Added "O4: copying your own OWN problem stays OWN…" (was a "not tested" comment). | O-4 decided. |
| `test/properties.spec.ts` | Order property now checks `comparePositions` (byte order) instead of `localeCompare`. | R-020: `localeCompare` under cs-CZ breaks position order. The mock now sorts by byte order. |
| `test/requests-http.e2e-spec.ts` | Scenarios 4–5 (1.0.x whole-set `children` body) replaced by the 2.0.0 flow; scenario 8 expects 2 children. | R-011: `children` removed from create/patch in 2.0.0. |
| `problems/create.e2e-spec.ts` | R-015 and R-021 tests un-skipped. | Fixed by regenerating contracts from 2.0.0 and the `decodeId` safe-integer guard. |
| `problems/list.e2e-spec.ts` | The R-021 list variant stays skipped, now labelled "needs R-013". | The unparseable id is dropped and the filter widens to everything; that is filter widening, out of scope. |
| `get.e2e-spec.ts`, `list.e2e-spec.ts` | R-008 tests un-skipped. | `originalId` and per-child `lockVersion` added to the mapper (I3). |
| `sets/*.e2e-spec.ts` | All un-skipped; "[R-00x not in mock]" removed from titles. | The three routes now exist. |
| `test/tsconfig.json` | `isolatedModules: true`. | Memory and speed. |

## 4. Still skipped (48), and why

All of this is out of scope for this run (per `IMPLEMENT_2.0.0.md`):

- 29 in `copies/update-available.e2e-spec.ts` + 1 in `actions/copy.e2e-spec.ts`: take-over-update, dismiss-update, the `updateAvailable` field and filter, the `ids` filter (R-005 to R-007).
- 5 in `problems/update.e2e-spec.ts`: editing a set child directly and its bump of the set's version (R-009).
- 6 in `problems/list.e2e-spec.ts`: filter widening (R-013) and related.
- 1 in `pickers.e2e-spec.ts`: mock login (R-014).
- Edge cases that need other work: R-021 on get/list/publish (list needs R-013), R-010 `IS_SET_CHILD` on dissolve/delete, R-011 create with `children`, one publish test that needs a set built via R-002.

`pnpm --filter @matematika/api test:unskipped` runs 293 passing, 42 failing. So **6 skipped tests already pass** and probably just need their `.skip` removed (most likely the R-010 and R-002-dependent ones). I did not check which ones, this is a follow-up.

## 5. Questions

- **Q-004 (open):** `addSetChild`, reorder and remove raise the set's `lockVersion` but not its `version`. Should structure changes raise `version`? It decides whether copy holders get `updateAvailable`.
- **Q-008 (open):** `problemId` = another teacher's PRIVATE problem: the mock returns 409 `CANNOT_ADD_TO_SET`; the spec could also mean 400 "not found" (hides existence). `copyFromId` = a child of another set: allowed in the mock.
- The 202 path of `addSetChild` (untrusted teacher into a `PUBLISHED` set: nothing stored) is implemented but no test reaches it.
- Positions are renumbered on every structure change (fine for the mock; Phase B should use fractional indexing, see `PHASE_B_PLAN.md`).
- `openapi.yaml` still has YAML anchors; `main.ts` parses with `maxAliasCount: -1` as a workaround (R-001 / Q-003).
- Memory: Jest now always runs through `scripts/jest-capped.mjs` (1536 MB heap, 2 workers) after a `node` process exhausted RAM; do not run bare `jest`.
