# Matematika API (mock backend)

NestJS backend for the community collection of math problems. The data lives **in memory**
and returns to the seed state on every restart. Login is fake. `openapi.yaml` is the contract.

## Run

```bash
npm install        # also generates src/contracts/generated from openapi.yaml
npm run dev        # http://localhost:3000, restarts on change
```

- API: `http://localhost:3000/api/v1`
- Docs (Scalar): `http://localhost:3000/docs`, raw spec: `http://localhost:3000/openapi.yaml`
- Other port: `PORT=3001 npm run dev` (PowerShell: `$env:PORT=3001; npm run dev`)
- Production-like: `npm run build && npm start`

## Use it from the Vue app

- Base URL: `http://localhost:3000/api/v1`
- CORS is on for any origin. Restrict it with `CORS_ORIGIN=http://localhost:5173` if you like.
- Every route needs a login: send `Authorization: Bearer jan` (trusted teacher),
  `eva` (verified) or `petr` (registered). No header returns 401.
  Any other token currently logs in as `jan`.
- Ids are short strings (e.g. `UkLWZ`), never numbers. Treat them as opaque.
- Edits send the `lockVersion` you last received. A mismatch returns 409 `LOCK_MISMATCH`.
  Removing a set child sends it as `If-Match: "4"` instead.
- `200` means applied, `202` means accepted but waiting for review (the mock stores nothing then).
- Errors are RFC 9457 `application/problem+json` with a stable `code` field.
- Seed ids to start with: set `UkLWZ` (children `gbHJd`, `EfhxL`), chapter "Rovnice" `UkLWZ`,
  licence CC BY 4.0 `gbHJd`. More examples in `requests.http` (JetBrains HTTP client / VS Code REST Client).
- Want typed calls in the frontend? Generate them from `openapi.yaml`
  (e.g. `npx openapi-typescript ../api/openapi.yaml -o src/api/schema.d.ts`, adjust the path).

## Contract

`openapi.yaml` is the single source of truth. After changing it run `npm run generate`; TypeScript
then shows what in the code has to follow. `src/contracts/error-codes.ts` is kept by hand
(the spec lists the codes in a description, not an enum).

## Tests

```bash
npm test
```

Every e2e test validates each response against `openapi.yaml` and checks the in-memory store.
Tests marked `it.skip` are known gaps (see below), not failures.

## Layout

```
openapi.yaml            API contract
requests.http           ready-made requests
src/main.ts             prefix api/v1, CORS, error filter, /docs
src/common/             errors (RFC 9457), guard, pipes, ids (Sqids), positions
src/database/           MockDatabase + seed (replaced by Prisma later)
src/modules/<name>/     controllers -> services -> repositories, domain/ (pure rules), mappers/
src/contracts/          generated types + Zod schemas, error codes
test/                   e2e + unit tests, helpers in test/support/
```

Modules: `problems` (the core), `publication`, `chapters`, `tags`, `licenses`, `users`.
Modules talk to each other only through a module's exported facade service.

## Not done yet

- Not in the mock: `takeOverUpdate`, `dismissUpdate`, and the `ids` / `updateAvailable` list filters
  (they are in the spec, so `/docs` shows them, but the server does not serve them).
- Prisma/Postgres and real JWT auth: places are marked `TODO Phase B`.
- Reviewing a published problem as an untrusted teacher returns 202 but stores no revision.
- A set's `version` does not change when its children change (undecided).
- Spots marked `DOMAIN-REVIEW` in `src/` are domain decisions that still need a human look.
