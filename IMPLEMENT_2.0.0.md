# Implementation run — mock backend → spec 2.0.0 (create problems, then nest them in sets)

**Repo:** `C:\dev\matematika-overnight`, branch `overnight/2026-10-31`.
**Owner:** Daniel. He reviews every `DOMAIN-REVIEW` spot himself.

**Goal:** the mock backend (in memory, mock login) serves spec 2.0.0 for this flow:
- create problems one at a time
- add them to a set: move your own, copy a foreign one
- reorder children inside the set
- take a child out of the set

All of it is proven by the existing tests (un-skipped as features land), with `pnpm verify` green.

**Read first:** `docs/DECISIONS-2026-10-31.md`, `docs/overnight/REVIEW.md`, `docs/overnight/PHASE_B_PLAN.md` (T7.0), and the tests in `apps/api/test/`.

---

## Rules

1. **The spec is read-only:** `packages/shared/contracts/openapi.yaml`. If it looks wrong, write the problem in `docs/overnight/QUESTIONS.md` and stop that step.
2. **Generated code changes only through `pnpm generate`.** Never edit it by hand.
3. **`apps/api/src` is now editable,** but only for the steps below. No Prisma, no JWT, no new runtime dependencies.
4. **The tests are the checklist.** Un-skip a test when its feature is done.
   - Change a test's expectations only if it contradicts the spec. Log every such change in `REVIEW.md`, citing the spec line.
   - If a test needs behaviour that's out of scope (see below), leave it skipped and add a note.
5. **Mark substantive rules for Daniel's review.** Every business rule you write gets a `// DOMAIN-REVIEW: <rule>` comment: move vs copy, `afterId` positions, the status/licence inheritance on add, the last child out, and the O-4 rule.
6. **Commits and progress:**
   - Run `pnpm verify` before every commit. Never commit red.
   - Make small commits: `[I3] addSetChild: move own private problem`.
   - After each step, update `PROGRESS.md` under a new heading `## Implementation 2.0.0`.
7. **Stuck rule:** after 3 genuine attempts or about 45 minutes, mark the step blocked, write why, and move on.
8. **Git:** never push, merge, rebase or reset.

## Steps (in order)

- [ ] **I1 Regenerate and build.**
  - Run `pnpm generate` from the 2.0.0 spec.
  - Fix the build: adapt the mock to the new types, and remove `children` from create and patch (R-011). The 1.0.x whole-set editing goes away.
  - Put `spec:drift` back into `verify`.
- [ ] **I2 Small fixes:**
  - Sync `error-codes.ts`: add `IS_SET_CHILD`, `CANNOT_ADD_TO_SET`, `NO_UPDATE_AVAILABLE`; remove `SET_CHILD_EDIT_VIA_PARENT` (R-010, R-012).
  - Confirm R-015 is gone after regenerating, and un-skip its tests.
  - Add the `decodeId` safe-integer guard (R-021).
  - Sort set children by byte order, not `localeCompare` (R-020). Reordering depends on it.
  - Add the O-4 rule: a copy of your own problem stays OWN, with no citation. Add assertions in the copy tests.
  - Add the O-8 check: a `verify` step that fails if `info.version` ≠ the newest changelog entry.
- [ ] **I3 Mapper fields (R-008).** `originalId` for the author, and a `lockVersion` on each child. Only what the spec and the `/children` tests need.
- [ ] **I4 `addSetChild`** (`POST /problems/{id}/children`, 37 tests). Follow the spec text exactly:
  - exactly one of `problemId` (move) or `copyFromId` (copy)
  - `afterId` missing → end, `null` → first, an ID → right after that child
  - the set lock
  - a standalone problem becomes a set with its first child
  - no result on the set
  - the child takes the set's status and, in a published set, its licence
  - the 202 path for untrusted teachers on published sets (store nothing, as today)
  - all the error codes the spec lists
- [ ] **I5 `reorderSetChild`** (`PATCH /problems/{id}/children/{childId}`, 21 tests).
- [ ] **I6 `removeSetChild`** (`DELETE /problems/{id}/children/{childId}`, 18 tests):
  - the lock travels in `If-Match`, and a mismatch is 412
  - the child becomes a standalone PRIVATE problem
  - after the last child, the set is a plain problem again
  - returns 200 with the whole set
- [ ] **I7 Requests file.** Add example requests for the new flow to `apps/api/requests.http`: create two problems → create a set parent → add one child by move, one by copy → reorder → remove.
- [ ] **I8 Report.** Write `docs/IMPLEMENT_2.0.0_REPORT.md`:
  - `verify` result and pass/skip counts before and after
  - every `DOMAIN-REVIEW` location as file:line plus the rule
  - tests whose expectations changed, and why
  - what is still skipped, and why
  - questions

  Set `PROGRESS.md` to `IMPLEMENTATION COMPLETE`.

## Out of scope (leave skipped, don't build)

- take-over-update, dismiss-update, the `updateAvailable` field and filter, the `ids` filter (R-005 to R-007)
- editing a set child directly, and its bump of the set's version (R-009)
- filter widening (R-013), the mock login (R-014), `requestId` (R-018)
- Prisma, JWT, notifications, revisions, PDF
