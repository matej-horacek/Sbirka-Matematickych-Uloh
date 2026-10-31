# Decisions — 2026-10-31

The decisions Daniel made on the overnight run's decision files (`docs/overnight/decisions/`). Put this file in `docs/` in the repo.

## Decided

| ID | Topic | Decision | Applied in |
|---|---|---|---|
| O-8 | Spec version | Bump `info.version` to `2.0.0`. Add a `verify` check that `info.version` matches the newest changelog entry. The API path stays `/api/v1`. | spec + `scripts/` |
| O-4 | Source type when copying your own problem | **Your own copy stays OWN**, with no citation; the licence is still inherited. This is the same owner exception that tags and chapters already have. It applies to `copyProblem` and to `copyFromId` in `addSetChild`. | spec wording + mock `copy-rules.ts` |
| O-2 | Notifications for copy holders | Copies get **only the computed `updateAvailable` flag**; nothing is stored on edit. Reword "copy holders are notified" to "copy holders see `updateAvailable`". A `notification` table comes later, for **moderation and review results** to authors, specced together with moderation. | spec wording now; table later |
| O-5 | Marking auto-approved revisions | Every applied change to published content writes a `problem_revision`. Trusted and admin changes get `approval = AUTO` with `approved_by = NULL`, plus a DB check that `AUTO ⇔ approved_by IS NULL`. `moderation_log.actor_id` stays an admin, NOT NULL. | Phase B schema |

## Parked (current state stays until revisited)

| ID | Topic | Current state |
|---|---|---|
| O-3 | PDF export | Client-side printing. No export endpoint, no Redis/BullMQ. |
| O-7 | Deviations from the structure doc | NestJS 11, the own `ZodValidationPipe`, a separate `licenses` module. To revisit: NestJS 12 after Phase B. |

## Still open

- **Q-008 to Q-011** (`QUESTIONS.md`):
  - `addSetChild` edge cases
  - `updateAvailable` on problems that aren't copies
  - what counts as a new version
  - edits while a problem is REVIEWING
- **Q-001** (the "49 checks"): closed. They weren't in the zip, and the new test suite replaces them.

## Spec fixes queued with the version bump (no behaviour change)

- Remove the YAML anchors (`&id001`…). They crash the API at startup (R-001, S-1).
- `ProblemCreate`: put `required: [name, assignment]` in the same object as the properties it names (R-015, S-13).
- `createProblem` 201 example: one problem without children (S-3).
- `takeOverUpdate` and `publishProblem`: declare the 400 response (S-4, S-5).
