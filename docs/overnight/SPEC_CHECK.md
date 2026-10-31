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
