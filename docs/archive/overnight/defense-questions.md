# Defense questions: 30 likely examiner questions about this backend

Quiz yourself first: the answers are at the end, numbered the same way. File references are `apps/api/src/…` unless stated.
Line numbers are from 2026-10-31.

## Questions

**Architecture**
1. What is a modular monolith, and where do you see the module boundaries in the code?
2. Why does `ProblemsModule` export only one service?
3. Name the layers of a module and what each is (and isn't) allowed to do.
4. Why are some rules in `domain/` as plain functions instead of in services?
5. What does `@Global()` on `DatabaseModule` do, and why is it there?

**Contract / spec-first**
6. What does "spec-first" mean in this project, concretely?
7. Where do the TypeScript types and Zod schemas come from, and what happens when the spec changes?
8. Why is `error-codes.ts` written by hand when everything else is generated?
9. How do the tests know that a response matches the contract?

**Request handling**
10. Walk through what happens on `PATCH /api/v1/problems/{id}` from the HTTP request to the JSON response.
11. How does the backend know who is calling? What changes in Phase B?
12. How is request input validated, and what does the client get when it is invalid?
13. What is RFC 9457 and how is it implemented here?

**Security / visibility**
14. Why does a teacher get 404, not 403, for someone else's private problem?
15. When do they get 403?
16. Why are IDs strings like `k3Xa9` in the API? Is that a security measure?
17. What stops a teacher from attaching another teacher's personal tag?

**Data and rules**
18. What is the difference between `version` and `lockVersion`?
19. How does optimistic locking work here, and what is its weakness in the mock?
20. What does soft delete mean and where is it implemented?
21. What happens to tags, chapters, source and licence when a problem is copied?
22. How do the trust levels affect publishing and editing?
23. Why can't a licence be changed once set, and how does the code enforce it?
24. What is a set, and how does dissolve differ from delete?
25. How are set children ordered, and what will change in Phase B?

**Testing and quality**
26. How do you prove that a copy really creates new records in the store?
27. Why are many tests skipped, and how do you know they are not just broken tests?
28. What does `pnpm verify` run, and why in that order?

**Phase B and limits**
29. What exactly changes when `MockDatabase` is replaced by Prisma, and what stays?
30. Name three known problems of the current backend and how you would fix them.

---

## Answers

1. One deployable app, internally split into feature modules (problems, publication, tags, chapters, licenses, users) that
   talk only through exported services. Boundaries: `app.module.ts` (the module list); each `*.module.ts` with `imports`/`exports`,
   e.g. `modules/problems/problems.module.ts`.
2. It is a **facade**: other modules (publication) may only call `ProblemsService`, never the repository or helper services,
   so the problems module can change internally without breaking others. See `problems.module.ts` (`exports: [ProblemsService]`) and
   `PublicationService` using `findOwnWithChildren`/`applyPublication` (`problems.service.ts:176,182`).
3. Controllers: routing, pipes, one service call (`problems.controller.ts`). Services: use cases and rules orchestration
   (`problems.service.ts`). Domain: pure rules (`domain/*.ts`). Repositories: the only data access (`problems.repository.ts`).
   Mappers: row → API shape (`problem.mapper.ts`). Controllers never touch the store; repositories never decide.
4. Pure functions have no dependencies: easy to unit-test, easy to explain, and they survive the Prisma swap unchanged.
   Examples: `canView` (`domain/visibility.ts:4`), `statusAfterPublish` (`publication/domain/publish-rules.ts:4`),
   `contentFields` (`domain/content-fields.ts:10`).
5. It makes `MockDatabase` injectable in every module without importing `DatabaseModule` each time
   (`database/database.module.ts`). Phase B swaps it for `PrismaService` in that one place.
6. `packages/shared/contracts/openapi.yaml` is written first and is the source of truth. The backend's types and validation
   schemas are generated from it, `/docs` is rendered from it, and the tests validate every response against it.
7. `@hey-api/openapi-ts` (`packages/shared/contracts/openapi-ts.config.ts`) generates `types.gen.ts` and `zod.gen.ts`;
   `src/index.ts` re-exports them. After a spec change, `pnpm generate` + build, and the TypeScript compiler lists every
   place in the API that no longer matches (spec 2.0.0 produced 9 such errors: INVENTORY §2).
8. The spec lists codes in a description (not an enum, so new codes don't break clients), so the generator has nothing
   to generate. Downside: it can go stale (R-012: 2.0.0 codes missing).
9. `apps/api/test/support/api.ts` attaches `contract().assertResponse(...)` to every request; `support/contract.ts` finds the
   operation in `openapi.yaml`, checks the status is declared, the content type, and validates the body with AJV in strict
   mode (undeclared fields fail).
10. Prefix `api/v1` (`main.ts:12`) → `MockAuthGuard` sets `req.user` → `ParseIdPipe` decodes the Sqid (404 if malformed) →
    `ZodValidationPipe` validates the body (400) → `ProblemsController.update` → `ProblemsService.update` (`problems.service.ts:111`):
    `findOwn` (404/403), lock check (409), result rule, relations, 202 decision, `repo.update` with version bumps →
    `toDetail` mapper → JSON (200 or 202). Errors at any step → `ProblemDetailsFilter`.
11. `common/guards/mock-auth.guard.ts:18-24`: `Authorization: Bearer jan|eva|petr` selects a seed user; no header → 401. The
    `CurrentUser` decorator reads `req.user`. Phase B: a JWT guard (access + refresh tokens) fills the same `CurrentUserData`
    shape, so services don't change.
12. Body/query: Zod schemas through `ZodValidationPipe` (`common/pipes/zod-validation.pipe.ts:14-20`); path ids: `ParseIdPipe`;
    relation ids: `ProblemRelationsService` (`problem-relations.service.ts:15,22`). Invalid → 400 `VALIDATION_FAILED` with a `detail`
    naming the field (path ids → 404).
13. "Problem Details for HTTP APIs": a standard JSON error body (`type`, `title`, `status`, `detail`) with media type
    `application/problem+json`. Here plus `code` and `requestId`. One global filter, `common/filters/problem-details.filter.ts`;
    services throw `ApiError` (`common/errors/api-error.ts`).
14. So the API does not reveal that the problem exists. `findVisible` throws `notFound()` when the row is missing **or** not
    visible (`problems.service.ts:199-203`); the test compares both 404 bodies (`test/problems/get.e2e-spec.ts`).
15. When they can see the problem (it is published) but are not the author and try to change it: `findOwn`
    (`problems.service.ts:206-210`) → 403 `FORBIDDEN`.
16. Sqids (`common/utils/ids.ts`): integers in the DB, short strings in the API, so ids are not sequential-looking. It is
    **obfuscation, not security**: every access is still checked in services. `decodeId` accepts only canonical strings
    (`ids.ts:16-20`), so `/problems/4` does not reach row 4.
17. `ProblemRelationsService.tagIds` (`problem-relations.service.ts:15-20`) checks every id with `TagsService.findNotUsable`
    (usable = global or own); otherwise 400. Tested in `test/problems/create.e2e-spec.ts`.
18. `version` = content version (copy holders compare it for "update available"; author-only). `lockVersion` = optimistic-lock
    counter the client must send back on PATCH. In 2.0.0 each child has its own `lockVersion`, and a child edit raises the
    set's `version` but not its `lockVersion`.
19. The client sends the `lockVersion` it loaded; if it differs from the stored one → 409 `LOCK_MISMATCH`
    (`problems.service.ts:116-118`); on success both counters go up (`:141-142`). Weakness: check and write are separate
    steps; in a real DB two concurrent requests could both pass. Phase B: one atomic `UPDATE … WHERE lock_version = ?` (PHASE_B_PLAN T7.2).
20. Rows are not removed; `deletedAt` is set (`problems.repository.ts:69-72`), and every read goes through `alive`
    (`:21-23`), which filters them out. Deleting a set soft-deletes its children too (`problems.service.ts:148-154`).
21. A new PRIVATE record owned by the caller, linked to the original and its version (`problem-copies.service.ts:31-47`).
    Tags/chapters: only global ones unless the caller owns the original (`problem-relations.service.ts:30-33`). Source:
    OWN → LICENSED_USE citing the author; others keep type and citation; licence inherited (`domain/copy-rules.ts:10-15`).
    Copying your own problem's source is open (O4). Copying a set copies all children (`problem-copies.service.ts:52-56`).
22. Publish: trusted/admin → PUBLISHED, verified → REVIEWING, registered → 403 `TRUST_TOO_LOW`
    (`publication/domain/publish-rules.ts:4-8`, `publication.service.ts:28-29`). Edit of published content: trusted → applied (200),
    otherwise 202 waiting for review (`problems.service.ts:131-134`; Phase B stores a revision).
23. A licence is a legal promise to everyone who already copied the problem. Code: the publish service only sets a
    licence where none exists (`problems.service.ts:182-190`, `publication.service.ts:41-51`); there is no endpoint that changes it.
24. A set is a problem with ordered child problems (one level only). Delete soft-deletes the set **and** its children;
    dissolve soft-deletes only the parent and turns each child into a standalone PRIVATE problem (`problem-sets.service.ts:108-112`).
25. By a string `position` per child, sorted (`problems.repository.ts:29-33`); the mock renumbers all children on save
    (`common/utils/position.ts:5`). Phase B: real fractional indexing (a new key between two neighbours, one row per move,
    B2) and byte-order sorting (R-020 found that `localeCompare` breaks under the Czech locale).
26. With the `StoreProbe` (`apps/api/test/support/store.ts`): count rows before/after, `expectRecord` on each new id with
    `originalProblemId`, owner, status, and deep-compare the original row before/after. See `test/actions/copy.e2e-spec.ts` ("a set" block).
27. They are tests of what the spec requires but the mock does not do yet (2.0.0 operations) or does wrong (`[R-0xx]`).
    `pnpm --filter @matematika/api test:unskipped` runs them: 128 fail for the stated reason, and the 4 that pass are explained in the files.
    Each skip names a finding in `docs/overnight/REVIEW.md`.
28. `scripts/verify.mjs`: spec lint → spec examples → (spec drift, skipped for now) → typecheck → lint → tests. Cheapest and
    most fundamental first: a broken spec makes everything after it meaningless; tests are the slowest step.
29. Changes: `DatabaseModule` provides `PrismaService`; every repository keeps its methods but uses Prisma; multi-row writes get
    transactions; the guard becomes JWT. Stays: controllers, services, domain rules, mappers, the contract, and the tests
    (a `PrismaStoreProbe` implements the same interface). See `docs/overnight/PHASE_B_PLAN.md` T7.2/T7.3.
30. Examples, all in `docs/overnight/REVIEW.md`: R-001 the server crashes at startup with spec 2.0.0 (YAML alias limit, fix the parse option
    or the spec); R-015 create without a name is accepted (a generator gap: validate `name`/`assignment` explicitly); R-002…R-007 the
    2.0.0 operations are missing (implement them against the skipped tests, PHASE_B_PLAN T7.0).
