# Architecture of the backend (mock phase)

For the maturita: what the parts are, how a request flows through them, and how the contract and the checks fit together.
All references are `apps/api/src/…` unless stated otherwise. State as of 2026-10-31 (mock backend, spec 2.0.0 file, code written for 1.0.x).

## 1. Module map

A **modular monolith** (§6 Decided): one NestJS app, split into feature modules that talk to each other only through a
module's exported **facade** service.

```
AppModule (app.module.ts)
├── DatabaseModule  (@Global)   MockDatabase ── Phase B: PrismaService
├── UsersModule                 UsersService (refsByIds, findByMockToken)
├── LicensesModule              GET /licenses
├── TagsModule                  GET /tags
├── ChaptersModule              GET /chapters
├── ProblemsModule              GET/POST /problems, GET/PATCH/DELETE /problems/:id, /copy, /dissolve
│     exports only ProblemsService (the facade)
└── PublicationModule           POST /problems/:id/publish
      imports ProblemsModule → uses the facade only
+ APP_GUARD: MockAuthGuard (every route needs a login)
```

| Module | Folder | Owns | Depends on |
|---|---|---|---|
| problems | `modules/problems/` | problems, sets, copies, dissolve | users, tags, chapters, licenses (their services) |
| publication | `modules/publication/` | publishing rules | problems (facade), licenses |
| tags / chapters / licenses | `modules/{tags,chapters,licenses}/` | read-only pickers + lookups for other modules | database |
| users | `modules/users/` | user lookups, mock login | database |

Why a facade: `problems.module.ts` exports only `ProblemsService`, so `publication` cannot reach the repository or the
helper services. In Phase B, the boundary stays the same when the data layer changes.

## 2. Layers inside a module

```
controllers/   routing + validation (pipes) + exactly one service call       problems.controller.ts
services/      use cases; the facade + helpers                              problems.service.ts, problem-*.service.ts
domain/        pure rules, no Nest, no database (unit-testable)             visibility.ts, copy-rules.ts, set-rules.ts,
                                                                            content-fields.ts, publish-rules.ts
repositories/  the ONLY code that reads/writes the data store               problems.repository.ts
mappers/       row → API shape (Sqids, author-only fields)                  problem.mapper.ts
dto/           hand-written Zod for query strings (coercion of numbers)     list-problems.query.ts
```

Cross-cutting code in `common/`: guard, filter, pipes, errors, id and position utilities, the `CurrentUser` decorator.

## 3. Request lifecycle

Example: `PATCH /api/v1/problems/k3Xa9` with `Authorization: Bearer jan`.

1. **Express → Nest router.** The global prefix `api/v1` (`main.ts:12`) is stripped; the route `@Patch(':id')` in
   `problems.controller.ts` matches.
2. **Guard.** `MockAuthGuard` (`common/guards/mock-auth.guard.ts`, registered as `APP_GUARD` in `app.module.ts`) reads the
   header, finds the user by mock token and puts `{id, displayName, role, trust}` on `req.user`. No header → `ApiError.unauthorized()` → 401.
3. **Pipes.** `ParseIdPipe` turns the Sqid into an integer, or throws 404 for a malformed id (`common/pipes/parse-id.pipe.ts`).
   `ZodValidationPipe(zUpdateProblemBody)` validates the body with the **generated** Zod schema; the first issue → 400 `VALIDATION_FAILED`
   (`common/pipes/zod-validation.pipe.ts:14-20`).
4. **Controller.** `update()` calls `ProblemsService.update(user, id, body)` and sets 200 or 202 from the result.
5. **Service.** `findOwn` (visible? → else 404; own? → else 403), lock check (409 `LOCK_MISMATCH`), set rules, relation checks,
   the 202 decision (published + not trusted), then `repo.update(…)` with `version + 1`, `lockVersion + 1`.
6. **Repository.** `ProblemsRepository.update` writes to `MockDatabase` (Phase B: Prisma).
7. **Mapper.** `toDetail` builds the `ProblemDetail`: ids → Sqids, author-only fields (`status`, `version`, `lockVersion`) only for the author.
8. **Response.** Nest serialises the object as JSON.

## 4. Error handling flow

- Services throw **`ApiError`** only (`common/errors/api-error.ts`): a Nest `HttpException` that carries the spec's `code`
  (`ErrorCode` from `packages/shared/contracts/src/error-codes.ts`). Static helpers: `badRequest`, `unauthorized`, `forbidden`, `notFound`, `conflict`.
- One global filter, **`ProblemDetailsFilter`** (`common/filters/problem-details.filter.ts`, registered in `main.ts:13`),
  catches everything and writes an RFC 9457 body (`application/problem+json`): `type`, `title`, `status`, `code`, `detail`, `requestId`.
  - `ApiError` → its own status/code/detail.
  - Other `HttpException` (Nest's own: unknown route, malformed JSON) → status + a code mapped from the status.
  - Anything else → 500, logged, no internal details in the body.
- Visibility rule in errors: a problem you may not see is **404**, the same body as a missing id (no existence leak);
  a published problem you may see but not change is **403**.

## 5. Spec-first generation

```
packages/shared/contracts/openapi.yaml        ← the contract, edited by hand (source of truth)
        │  pnpm --filter @matematika/contracts generate   (@hey-api/openapi-ts, openapi-ts.config.ts)
        ▼
src/generated/types.gen.ts   (TypeScript types: ProblemDetail, ProblemCreate, …)
src/generated/zod.gen.ts     (Zod schemas: zCreateProblemBody, zProblemDetail, …)
        │  tsup → dist/  (ESM + CJS), exported as @matematika/contracts
        ▼
apps/api imports the types (return types of controllers/services) and the Zod schemas (ZodValidationPipe)
apps/api/main.ts serves openapi.yaml at /openapi.yaml and an API reference at /docs (Scalar)
```

- If the spec changes a schema, regeneration changes the types, and the TypeScript compiler shows every place in the API that must follow.
  That is exactly what happened with 2.0.0: 9 compile errors (INVENTORY §2).
- `src/generated/` is gitignored (Q-002). Tonight the API is built against the 1.0.1 spec with `pnpm baseline:build`.
- `error-codes.ts` is hand-kept, because the spec lists codes in a description, not an enum (R-012).
- Known generator gap: `required` in an `allOf` branch for properties declared in another branch is dropped (R-015).

## 6. How `verify` works

`pnpm verify` = `node scripts/verify.mjs`, fail-fast, prints a summary:

| # | Step | Command | Checks |
|---|---|---|---|
| 1 | spec lint | `redocly lint` | the spec is valid OpenAPI, every `$ref` resolves |
| 2 | spec examples | `scripts/check-spec-examples.mjs` | every example in the spec matches its schema (AJV) |
| 3 | spec drift | `scripts/spec-drift.mjs` | generated code = fresh generation (**skipped** until the mock moves to 2.0.0; `--with-drift`) |
| 4 | contracts built | `scripts/build-baseline.mjs --contracts-only` | only if `dist/` is missing |
| 5 | typecheck | `pnpm -r typecheck` + tests' tsconfig | contracts, API source, tests |
| 6 | lint | `eslint .` | typescript-eslint recommended |
| 7 | tests | `jest` in `apps/api` | unit tests + e2e tests (`verify:quick`: unit only) |

The e2e tests (`apps/api/test/`, see `docs/TESTING.md`):
- `useTestApp()` builds the real `AppModule` per test file (fresh seeded store);
- `api.as('jan')…` validates **every response** against `openapi.yaml` (strict: undeclared fields fail);
- `store` (`StoreProbe`) checks the data store directly: records created, copied, soft-deleted, with the right owner, status and versions.
- `it.skip('… [R-0xx]')` marks a proven mock bug or a 2.0.0 operation the mock lacks; `test:unskipped` runs them.
