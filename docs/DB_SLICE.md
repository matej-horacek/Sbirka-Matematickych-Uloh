# DB slice: Prisma layer, ready for Daniel's queries

The Prisma layer is wired in and the mock keeps working. What is left is the query code itself: every
`Prisma…Repository` method (except the login lookup) throws `501 TODO Daniel` and has a doc comment saying what it must do.
Sources of truth (D-01): the schema is `apps/api/prisma/schema.prisma`, decisions are in `docs/DECISIONS-11-1.md`, the API is `openapi.yaml`.

## How it fits together

```
controller → service → repository interface (DI token) ─┬─ Mock…Repository    (MockDatabase, in memory)
                                                         └─ Prisma…Repository  (PrismaService, Postgres)
```

- Interfaces and tokens: `modules/<x>/repositories/<x>.repository.ts` (`TAGS_REPOSITORY`, …) for problems, tags, chapters, licenses, users.
- `DATA_SOURCE` (`src/config/data-source.ts`) picks the class for all five at startup: `mock` (default) or `prisma`.
  It is read when the modules load, so set it in the environment (or `apps/api/.env`) before the process starts.
- All repository methods are `async` (Prisma is), so services and controllers `await` them.
- Services and controllers do not know which implementation they get. Query code goes only into the `Prisma…Repository` files.
- Rows keep the mock's shape (`ProblemRow`, `TagRow`, … in `src/database/mock-database.ts`, camelCase, ids as integers,
  relations as id lists). The Prisma classes map the snake_case DB models onto them; the mapping is described at the top of
  `prisma-problems.repository.ts`. `toUserRow()` in `prisma-users.repository.ts` is a finished example.

## Mock mode (default, no database)

```
pnpm verify                      # whole pipeline, mock data (must stay green)
pnpm --filter @matematika/api dev
```

Log in with `Authorization: Bearer jan` (also `eva`, `petr`; any other name is `jan`).

## Prisma mode

```
docker compose -f docker-compose.dev.yml up -d          # run from the repo root; Postgres on host port 5434 (5432 is often taken by a local install), database "sbirka"
# apps/api/.env:  DATABASE_URL="postgresql://app:app@localhost:5434/sbirka"   DATA_SOURCE=prisma
pnpm --filter @matematika/api db:generate               # Prisma client + docs/db/schema.dbml (needed once after clone/schema change)
pnpm --filter @matematika/api exec prisma migrate deploy  # applies prisma/migrations (init)
pnpm --filter @matematika/api db:seed                   # only seeds an empty database
pnpm --filter @matematika/api dev
```

- Login is `Authorization: Bearer <username>` and is resolved through the user repository
  (`PrismaUsersRepository.findByUsername`, finished). Unknown username → 401 (mock mode falls back to `jan`).
- Seed (`prisma/seed.ts`): language `cs`; users `jan` (TRUSTED_TEACHER), `eva` (VERIFIED_TEACHER), `petr` (REGISTERED_TEACHER)
  with display names and a placeholder `password_hash`; the licences CC0 1.0, CC BY 4.0, CC BY-SA 4.0; global tags
  *lineární rovnice*, *kvadratické rovnice*, *geometrie*; global chapters *Rovnice* ⊃ *Lineární rovnice*, *Planimetrie*;
  and Jan's personal chapter *Rovnice – opakování 2.A* under *Rovnice*. On an empty database the ids are 1, 2, 3, …
- `pnpm --filter @matematika/api db:generate` also needs no `DATABASE_URL` (`prisma.config.ts` falls back to the dev compose URL),
  and `pnpm verify` runs it by itself when `src/generated/prisma` is missing.

## `pnpm test:prisma`

```
pnpm test:prisma            # leaves the test database running
pnpm test:prisma --down     # removes it afterwards
pnpm test:prisma -t "name"  # extra arguments go to Vitest
```

It recreates the throwaway Postgres of `docker-compose.test.yml` (port **5433**, tmpfs, never touches the dev database),
creates the schema (`prisma db push` on the empty database), seeds it, and runs the create, get, list and picker e2e files with
`DATA_SOURCE=prisma`, one file at a time (they share one database). The tests use `PrismaStoreProbe`
(`apps/api/test/support/prisma-store.ts`), which reads the tables directly, not through the repositories.

**Right now these tests fail with 501 `TODO Daniel`** (50 failed, 34 passed: the passing ones never reach a repository, e.g. 401s and validation).

Things to know:

- **The seed is smaller than the mock seed.** The get and list tests use `test/support/seed.ts`, which expects the mock data:
  seven problems (sets, published ones, an `LICENSED_USE` one), Jan's personal tag *opakování 2.A*, and a fourth licence
  *Všechna práva vyhrazena*. The Prisma seed has none of them, so those tests cannot go green on this seed alone.
  Either extend `prisma/seed.ts` to match the mock, or make the tests create what they need through the API.
- **The first migration exists** (`prisma/migrations/20261101204328_init`, includes the CHECK constraints). The dev database uses
  `prisma migrate deploy`, but `scripts/test-prisma.mjs` still runs `prisma db push`, so the test database does not get the CHECKs.
  Switch the script to `migrate deploy` to test against the same schema.
- **No reset between tests.** A fresh app per test file does not reset the database. Rows from one test stay for the next.
- `prisma db push --force-reset` is blocked by Prisma's safety guard (it wants explicit consent), so the script recreates the container instead.

## The schema and generator

- The only edits to `schema.prisma` are: `@updatedAt` on the three `updated_at` columns (D-02), `moduleFormat = "esm"` in the client generator
  (the API is an ESM package, and Vitest resolves the generated `./x.js` imports to the `.ts` files), and the `dbml` generator block.
- `docs/db/schema.dbml` is generated by `db:generate`; never edit it by hand. Paste it into dbdiagram.io.
- `src/generated/prisma` is gitignored.

## TODO Daniel: methods in the suggested order

Each method's doc comment lists what it must do (sorting, visibility, soft delete, …). Work top to bottom; each group unlocks tests.

| # | Method | Unlocks |
|---|---|---|
| 1 | `PrismaLicensesRepository.findPublishable`, `findByIds` | `listLicenses`; licence in every problem response |
| 2 | `PrismaTagsRepository.findVisible`, `findByIds` | `listTags` (sorted by name, `q`, visibility) |
| 3 | `PrismaChaptersRepository.findVisible`, `findByIds`, `findAll` | `listChapters`; the chapter filter with descendants |
| 4 | `PrismaUsersRepository.findByIds` | `author` in every problem response (use `toUserRow`) |
| 5 | `PrismaProblemsRepository.findById`, `findChildren`, `countChildren` | `getProblem` (children in byte order, `childCount`) |
| 6 | `PrismaProblemsRepository.insert` | `createProblem` (one transaction: content_source → problem → join rows) |
| 7 | `PrismaProblemsRepository.findMany` | `listProblems` (filters, newest first, total) |
| 8 | `PrismaProblemsRepository.update`, `softDelete` | update, delete, publish, copy, set operations (not part of `test:prisma` yet) |

Steps 1–3 are what the picker e2e tests need. `getProblem` and `listProblems` in `test:prisma` also depend on step 6 or on a larger seed (see above).
