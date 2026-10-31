# Testing — how to run everything (Windows)

Everything runs in **PowerShell** or **Git Bash** from the repo root. Node 22+ and pnpm 10 (`corepack enable`, or install pnpm directly).

## Quick start

```powershell
pnpm install
pnpm verify          # everything, about 15 s
pnpm verify:quick    # everything except the e2e (HTTP) tests
```

`verify` stops at the first failing step and prints a summary like this:

```
verify PASSED in 12.0s
  ok    spec lint (1.4s)
  ok    spec examples (0.6s)
  SKIP  spec drift (expected 1.0.x→2.0.0 drift; ...)
  SKIP  contracts built (packages/shared/contracts/dist exists)
  ok    typecheck (5.1s)
  ok    lint (1.6s)
  ok    tests (unit + e2e) (3.4s)
```

## The steps, and how to run each one alone

| Step | Command | What it checks |
|---|---|---|
| 1. spec lint | `pnpm spec:lint` | Redocly `recommended` rules on `openapi.yaml`; `$ref`s resolve. |
| 2. spec examples | `pnpm spec:examples` | Every `example`/`examples` value in the spec matches its schema (AJV, OpenAPI 3.0). `--json` for machine output. |
| 3. spec drift | `pnpm spec:drift` (`--diff` for a line diff) | Regenerates types + Zod from the spec into a temp dir and compares them with `packages/shared/contracts/src/generated`. **Skipped in `verify`** while the mock is on 1.0.x (it fails by design until then). Include it with `node scripts/verify.mjs --with-drift` or `$env:VERIFY_DRIFT=1`. |
| (contracts) | `pnpm baseline:build --contracts-only` | Runs only when `packages/shared/contracts/dist` is missing: builds the contracts from the **1.0.1** spec (commit `fcd8b9c`), because the mock doesn't compile against 2.0.0 yet. |
| 4. typecheck | `pnpm -r typecheck` and `pnpm --filter @matematika/api typecheck:test` | Contracts, API source, and the tests. |
| 5. lint | `pnpm lint` | ESLint, typescript-eslint `recommended`, over `apps/api/src`, `apps/api/test`, `scripts`. |
| 6. tests | `pnpm --filter @matematika/api test` | Jest. `test:unit` = `*.spec.ts` only, `test:e2e` = `*.e2e-spec.ts` only, `test:cov` = with coverage (`apps/api/coverage/`). |

Run one test file or one test by name:

```powershell
cd apps/api
pnpm test test/problems/copy.e2e-spec.ts
pnpm test -t "copies every child"
```

## Why the contracts are built from an old spec

`packages/shared/contracts/src/generated/` is gitignored, so a fresh clone has to generate it. Generating from the current `openapi.yaml` (2.0.0) breaks the API build, because the mock still imports 1.0.x types (`ProblemChildInput`, `children` on create/patch). Until the mock catches up:

- `pnpm baseline:build` generates from the 1.0.1 spec at `fcd8b9c` into the gitignored folder, bundles the contracts and builds the API.
- **Don't** run `pnpm --filter @matematika/contracts build` (or `generate`): it regenerates from 2.0.0 and the API stops compiling. If that happens, run `pnpm baseline:build` again.

Once the mock is on 2.0.0: regenerate normally, delete `baseline:build`, and remove the skip of step 3 in `scripts/verify.mjs`.

## Starting the server by hand

The API **crashes at startup** with spec 2.0.0 (finding R-001): `main.ts` parses `openapi.yaml` with the `yaml` package, whose default alias limit rejects the spec's many YAML anchors. To start it anyway without touching `src`:

```powershell
pnpm baseline:build
cd apps/api
node -r ../../scripts/smoke/yaml-alias-shim.cjs dist/main     # PORT=3000 by default
```

Then `node scripts/smoke/run-requests-http.mjs http://localhost:3000/api/v1` replays `apps/api/requests.http` (11 requests). Use `$env:VERBOSE=1` to print bodies.

## How the tests are built (`apps/api/test/`)

| File | Purpose |
|---|---|
| `support/app.ts` | `useTestApp()`: a fresh Nest app from the real `AppModule` **per test file** (fresh, seeded `MockDatabase`), with the same global prefix and error filter as `main.ts`. Nothing in `src` is mocked. |
| `support/api.ts` | HTTP client: `api.as('jan').get('/problems?scope=mine')`. Adds `/api/v1`, the login header, and **validates every response against `openapi.yaml`**. |
| `support/contract.ts` | The contract check: finds the operation, checks status, content type and body (AJV built from the spec). Strict: properties the spec doesn't declare fail. |
| `support/auth.ts` | Login headers: `jan` (TRUSTED), `eva` (VERIFIED), `petr` (REGISTERED), `none`. |
| `support/store.ts` | `StoreProbe`: `expectRecord`, `expectNoRecord`, `expectDeleted`, `countRecords`, `find`, `children`. Reads the `MockDatabase` instance from Nest DI. Accepts Sqids from responses. Async, so a Prisma version can replace it in Phase B. |
| `support/seed.ts` | Named Sqids of the seed rows (`seed.problems.set`, `seed.licenses.ccBy`…). |
| `*.e2e-spec.ts` | Tests through HTTP, by operation. |
| `*.spec.ts` | Unit tests (helpers, pure rules). |

Skipped tests:
- `it.skip('… [R-0xx]')`: the mock has a bug (see `docs/overnight/REVIEW.md`).
- `it.skip('… [R-0xx not in mock]')`: the operation is new in spec 2.0.0 and the mock doesn't have it yet. These tests are written from the spec and form the checklist for implementing 2.0.0: remove `.skip` as each part lands.
- `pnpm --filter @matematika/api test:unskipped` runs the skipped tests as normal tests (a Jest transformer,
  `support/unskip-transformer.js`, rewrites `it.skip` to `it`). A failure there is expected and proves the finding; a skipped test that
  **passes** there means the mock caught up, so drop its `.skip`. Today 4 pass by accident (Nest's 404 for a missing route); they are marked in their files.
- `support/factory.ts`: arrange helpers that go through the API only (`createProblem`, `createPublished`, `buildSet`), so they work against Prisma too.
  `buildSet` uses `POST /problems/{id}/children`, so only skipped tests use it until R-002 lands.

## Troubleshooting on Windows

- **`EPERM` from openapi-ts**: it empties its output folder first; that fails if a terminal or editor has the folder open as its current directory.
- **CRLF warnings from git**: harmless (`core.autocrlf`); the scripts read both line endings.
- **`npm warn Unknown project config "inject-workspace-packages"`**: harmless; it comes from `npx` reading the pnpm `.npmrc`. Prefer `pnpm exec`.
- **Port in use** when starting by hand: `$env:PORT=3917` before `node dist/main`.

## CI

`.github/workflows/verify.yml` runs `pnpm verify` on Ubuntu and Windows (Node 22). It needs `fetch-depth: 0`, because `baseline:build` reads the old spec from git history. The workflow is committed but has never run (no remote).
