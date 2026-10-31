# Spec check — `packages/shared/contracts/openapi.yaml` (2.0.0 content)

The spec was **not edited**. Everything here is a report for Daniel.

## T2.1 Lint (Redocly CLI 2.72.1)

Command: `pnpm spec:lint` (= `redocly lint packages/shared/contracts/openapi.yaml`, built-in `recommended` rules, no config file).

| Check | Result |
|---|---|
| Parses as OpenAPI 3.0.3 | yes |
| `recommended` rules | **valid**, 1 warning |
| `minimal` rules | valid, 0 warnings |
| `recommended-strict` rules | 1 error (the same `info-license` rule, raised to error) |
| All `$ref`s resolve | yes: 144 `$ref`s in the file, 0 left after `redocly bundle --dereferenced` |
| Size | 12 paths, 16 operations, 25 component schemas, 12 parameters, 6 responses |

Warning:
- `openapi.yaml:2` `info-license`: the Info object has no `license` field. (Severity: info. Only matters if the spec is ever published.)

Not caught by the linter, but found while running it (see T2.3b):
- The file contains 27 YAML anchors and 58 aliases with generated names (`&id001` … `*id026`). Redocly and openapi-ts handle them. The `yaml` package used by `main.ts` refuses with its default `maxAliasCount: 100`, so **the API does not start** with this spec (R-001).

## T2.2 Examples vs schemas (AJV 8, OpenAPI 3.0 mode)

Command: `pnpm spec:examples` (= `node scripts/check-spec-examples.mjs`; add `--json` for machine output). Exit 1 on any invalid example.

How it works: the parsed spec is registered in AJV as one document, and each example is compiled against `spec#<JSON pointer of its schema>`, so `$ref`s resolve in place. `nullable` is AJV's built-in OpenAPI keyword, `example` and other OpenAPI-only keywords are ignored (`strict: false`), and formats come from `ajv-formats`.

Result: **47 examples checked, 47 valid, 0 invalid.**

| Location | Count |
|---|---|
| Schema-level `example` (components.schemas, incl. inside `allOf`) | 9 |
| Parameter schema `example` | 3 |
| Shared error responses (`components.responses`) | 6 |
| Request body `example`/`examples` | 9 |
| Operation response `example` | 20 |

Self-test: a copy of the spec with three planted errors (`childCount: -2`, `status: SECRET`, `createdAt: 'yesterday'`) fails with exit 1 and names each error (`must be >= 0`, `must be equal to one of the allowed values`, `must match format "date-time"`). Because the examples share YAML aliases, one planted error shows up in every example that reuses the node.

Extra one-off check (not part of the script): no example contains a property its schema does not declare. Every schema allows additional properties, so AJV alone would not catch that.

Schema-valid, but semantically inconsistent with the 2.0.0 text (details in T2.3b):
- `createProblem` 201 shows a set with 2 children.
- In the `getProblem` 200 example the children carry `lockVersion`, but in the `createProblem` 201, `updateProblem` 200 and `publishProblem` 200 examples (all author views) they don't.
- No example shows `updateAvailable` or a non-null `originalId`.
