# Codebase walkthrough (reading order)

Read in this order. Each step builds on the previous one. Paths are under `apps/api/src/` unless stated.
About 1 700 lines in total; reading it all takes about two hours. For each file, "explain it" lists what you should be able to say about it without looking.

## Step 1: the contract (what the API promises)

1. **`packages/shared/contracts/openapi.yaml`**: read `info` (changelog), then `paths` top to bottom, then `components/schemas`.
   *Explain it:* the 16 operations, who may call each ("Who:" lines), the error codes, why `ProblemDetail` has author-only fields,
   the block model (`/children`), `lockVersion` vs `version`.
2. **`packages/shared/contracts/openapi-ts.config.ts`**, **`src/index.ts`**, **`src/error-codes.ts`**.
   *Explain it:* types and Zod schemas are generated; error codes are hand-kept and why.

## Step 2: start-up and wiring

3. **`main.ts`**: creates the app, sets the prefix `api/v1`, registers the error filter, serves `/openapi.yaml` and `/docs`.
   *Explain it:* why the filter is global; why docs come from the YAML (spec-first). Known issue: R-001.
4. **`app.module.ts`**: the list of modules and the global guard (`APP_GUARD`).
5. **`database/mock-database.ts`**, then **`database/mock-seed.ts`**, **`database/database.module.ts`**.
   *Explain it:* the row types (they mirror the future Prisma models), soft delete (`deletedAt`), the 3 mock users and their trust levels,
   why `DatabaseModule` is `@Global`, and what Phase B replaces.

## Step 3: cross-cutting pieces (`common/`)

6. **`common/utils/ids.ts`**: Sqids. *Explain it:* integer in the DB, string in the API; canonical decode (decode + re-encode must match);
   obfuscation, not security (permissions are checked in services).
7. **`common/guards/mock-auth.guard.ts`** + **`common/decorators/current-user.decorator.ts`**.
   *Explain it:* how the user gets onto the request, 401 without a header, what JWT replaces (B1), R-014.
8. **`common/pipes/parse-id.pipe.ts`**, **`common/pipes/zod-validation.pipe.ts`**.
   *Explain it:* a malformed path id is 404; a bad body is 400 with the first Zod issue.
9. **`common/errors/api-error.ts`**, **`common/filters/problem-details.filter.ts`**.
   *Explain it:* RFC 9457; one filter for all errors; why 404 hides private problems.
10. **`common/utils/position.ts`**: order of set children. *Explain it:* why strings; what fractional indexing will change (B2); R-020.

## Step 4: a simple module end to end (tags)

11. **`modules/tags/`**: `tags.module.ts` → `controllers/tags.controller.ts` → `dto/list-tags.query.ts` → `services/tags.service.ts`
    → `repositories/tags.repository.ts` → `mappers/tag.mapper.ts`.
    *Explain it:* the layer pattern on the smallest example: visibility (global + own), `q` case-insensitive, pagination.
12. **`modules/chapters/`**: the same pattern; `withDescendants` (filter by a parent includes its children).
13. **`modules/licenses/`** and **`modules/users/`**: lookups other modules use (`refsByIds`, `rowsByIds`).

## Step 5: the problems module (the core)

14. **`modules/problems/problems.module.ts`**: providers and the single export (the facade).
15. **`modules/problems/controllers/problems.controller.ts`**: 7 routes, one service call each; 200 vs 202 in `update`.
16. **`modules/problems/domain/`**: read all five small files:
    `visibility.ts` (`canView`), `content-fields.ts` (PATCH semantics: missing = unchanged, null = clear),
    `copy-rules.ts` (source on copy; O4), `set-rules.ts` (1.0.x child checks; a set has no result).
    *Explain it:* why these are pure functions (unit-testable, no Nest, survive Phase B unchanged).
17. **`modules/problems/repositories/problems.repository.ts`**: `alive` (soft delete), `findMany` (filters, top-level only), `insert`, `update`, `softDelete`.
18. **`modules/problems/mappers/problem.mapper.ts`**: `ProblemLookups` (batch-loaded relations, no N+1), `toListItem`, `toDetailCore`, `toDetail` (author-only fields).
19. **`modules/problems/services/problems.service.ts`**: the facade. Read `findVisible` / `findOwn` first (end of the file), then
    `list`, `get`, `create`, `update`, `remove`, `copy`, `dissolve`, then the facade methods for publication.
    *Explain it:* 404 vs 403, the lock check, the 202 rule, `version` vs `lockVersion`.
20. **`services/problem-relations.service.ts`** (tag/chapter ids → checked integers; global-only for foreign copies),
    **`services/problem-copies.service.ts`** (one copy routine, recursive for sets),
    **`services/problem-sets.service.ts`** (1.0.x whole-set editing: plan, then apply; dissolve).

## Step 6: publication

21. **`modules/publication/domain/publish-rules.ts`**: trust → status.
22. **`modules/publication/services/publication.service.ts`**: order of checks (child → blocked → idempotent → trust → licence), licence for a whole set.
    *Explain it:* why it goes through the problems facade, and how licences are irrevocable.

## Step 7: the tests (how you prove it works)

23. **`docs/TESTING.md`**, then **`apps/api/test/support/`**: `app.ts`, `api.ts`, `contract.ts`, `store.ts`, `factory.ts`.
24. One operation file, e.g. **`test/actions/copy.e2e-spec.ts`**: response + contract + store checks in one test.
25. One skipped 2.0.0 file, e.g. **`test/sets/add-child.e2e-spec.ts`**: the spec turned into a checklist.
26. **`scripts/verify.mjs`**: the one command.

## Step 8: where it goes next

27. **`docs/overnight/REVIEW.md`** (what is wrong), **`docs/overnight/PHASE_B_PLAN.md`** (what comes next), **`docs/overnight/decisions/`** (what is open).
