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

## T2.3 Generated-code drift (expected tonight)

Command: `pnpm spec:drift` (summary per exported symbol; `--diff` adds a line diff). Exit 1 on any drift. **Not part of `verify`** until Daniel regenerates.

The runbook assumes a *committed* 1.0.x output to compare against, but `src/generated/` is gitignored and was never committed (Q-002). The script therefore compares the code the API is **actually compiled against** (the local `src/generated`, written by `pnpm baseline:build` from the 1.0.1 spec at `fcd8b9c`) with a fresh generation from the current `openapi.yaml`, written to a temp dir. `src/generated` is never touched.

Result: **67 symbols drift** (types: 1 removed, 32 added, 6 changed; Zod: 1 removed, 21 added, 6 changed).

### Drift by schema = the list of types the mock must adopt

| Schema / symbol | Change in 2.0.0 | Mock code that uses the 1.0.x shape |
|---|---|---|
| `ProblemChildInput` / `zProblemChildInput` | **removed** | `domain/set-rules.ts:1`, `services/problem-sets.service.ts:2` (and the whole `planChildren`/`applyChildren` flow) |
| `ProblemCreate` / `zProblemCreate` | `children` removed | `problems.service.ts:69` (`body.children`) |
| `ProblemPatch` / `zProblemPatch` | `children` removed | `problems.service.ts:119,122,129` |
| `ProblemListItem` / `zProblemListItem` | `updateAvailable?: boolean` added | `mappers/problem.mapper.ts` `toListItem` (never sets it) |
| `ProblemDetailCore` / `zProblemDetailCore` | `lockVersion?` **moved here** from `ProblemDetail` (so each child carries its own) | `mappers/problem.mapper.ts:57-64` `toDetailCore` |
| `ProblemDetail` / `zProblemDetail` | `lockVersion` moved to Core; `originalId?: string \| null` added | `mappers/problem.mapper.ts:66-77` `toDetail` |
| `ListProblemsData` / `zListProblemsQuery` | query `ids?: Sqid[]`, `updateAvailable?: boolean` added | `dto/list-problems.query.ts` (hand-written Zod; does not use `zListProblemsQuery`) |
| `AddChildRequest` / `zAddChildRequest`, `zAddSetChildBody`, `zAddSetChildPath`, `zAddSetChildResponse`, `AddSetChild*` | **new** (addSetChild) | none yet |
| `ReorderChildRequest` / `zReorderChildRequest`, `zReorderSetChild*`, `ReorderSetChild*` | **new** (reorderSetChild) | none yet |
| `RemoveSetChild*`, `zRemoveSetChildHeaders` (`If-Match`), `zRemoveSetChildPath`, `zRemoveSetChildResponse` | **new** (removeSetChild) | none yet |
| `TakeOverRequest` / `zTakeOverRequest`, `TakeOverUpdate*`, `zTakeOverUpdate*` | **new** (takeOverUpdate) | none yet |
| `DismissUpdate*`, `zDismissUpdatePath`, `zDismissUpdateResponse` | **new** (dismissUpdate) | none yet |
| `ChildId`, `IfMatch`, `IdsFilter`, `UpdateAvailableFilter` (+ `z…`) | **new** parameter types | none yet |
| `ErrorDetails` | doc comment only (code list); no type change | `error-codes.ts` is hand-kept and **not** covered by drift; see T2.4 |

Everything else (87 − 7 type symbols; 53 − 7 Zod symbols) is identical.

## T2.3b Internal consistency of the spec

Items marked **(O-x)** touch an Open decision. They are reported, not judged.

| # | Where | What the spec says | Inconsistency |
|---|---|---|---|
| C-1 | `info.version` (line 21) | `version: 1.0.0` | The changelog's top entry is **2.0.0**. The version also went *down*: the previous commit (`fcd8b9c`) had `1.0.1`. `packages/shared/contracts/package.json` says `1.0.1`. **(O8)**: Daniel fixes it himself. |
| C-2 | `createProblem` 201 example (lines 157–225) | A set: `childCount: 2` plus two `children` | The 2.0.0 description says create makes **one** problem, and `ProblemCreate` has no `children`. A fresh problem always has `childCount: 0` and `children: []`. The example is a leftover from 1.0.x. |
| C-3 | `updateProblem` description (line 320) | "Editing a set child also raises the set's version (**copy holders of the set are notified**)" | Decided: `updateAvailable` is computed on read, not stored. "Are notified" can mean just that flag, or stored notification rows. **(O2)**: not judged here; see `decisions/O-2.md`. |
| C-4 | Author views of children | `getProblem` 200 example: each child has `lockVersion`. `createProblem` 201, `updateProblem` 200, `publishProblem` 200 examples (also author views): children have **no** `lockVersion`. | 2.0.0 moved `lockVersion` to `ProblemDetailCore` ("each child has its own lockVersion for editing its content"), so author views should show it on children too. The examples disagree with each other. (Schema-valid, because the field is optional.) |
| C-5 | `takeOverUpdate` | `requestBody.required: true` (`lockVersion` required) | No `400` response is declared, and the "Codes:" line has no `VALIDATION_FAILED`. A missing or wrong-typed `lockVersion` has no specified answer. |
| C-6 | `publishProblem` | Optional body `{ licenseId: Sqid }` | No `400` response declared. A wrong-typed `licenseId` (e.g. a number) or malformed JSON has no specified answer (the mock returns 400 `VALIDATION_FAILED`). An unknown licence is specified as 409 `LICENSE_REQUIRED`. |
| C-7 | `ErrorDetails.code` description | `409 IS_SET_CHILD - delete, dissolve or add-children sent to a set child` | `takeOverUpdate` also lists `IS_SET_CHILD`, which this list does not mention. (A child copy is never flagged with `updateAvailable`, per `ProblemListItem.updateAvailable`, so take-over on a child may be unreachable; then the code is unnecessary there.) |
| C-8 | Tag `Problems` description (line 32) | "Create, read, update and delete problems and **whole sets**." | 1.0.x wording; 2.0.0 removed whole-set editing. |
| C-9 | `AddChildRequest` | "Exactly one of `problemId` or `copyFromId`" | Only stated in prose; the schema doesn't express it (no `oneOf`/`not`), so generated Zod accepts both or neither. The server has to check it in code. (Fine for 3.0, but worth knowing: contract validation won't catch it.) |
| C-10 | `afterId` (`AddChildRequest`, `ReorderChildRequest`) | `type: string, nullable: true` | Every other id uses `$ref: Sqid`. `afterId` is an inline string, so generators produce `string \| null`, not `Sqid`. Cosmetic, but inconsistent. |
| C-11 | Example ids | Most examples use invented ids (`k3Xa9`, `a1B2c`) | `addSetChild` `copyAfter` uses `VqXmZ`, and the `afterId` examples use `gbHJd`: real Sqids from the mock seed. Cosmetic. |
| C-12 | `SourceRef.license` | `anyOf: [LicenseRef, {type: object, nullable: true, enum: [null]}]` | A valid OpenAPI 3.0 workaround for a nullable `$ref`, but unusual. openapi-ts turns it into `LicenseRef \| null` correctly. Informational. |
| C-13 | `listChapters`, `listLicenses` | "Not paginated" | Deliberate exceptions to "one shared pagination", stated in the spec. Informational. |

### Unclear points where the spec is silent (→ `QUESTIONS.md`)

These are gaps, not contradictions. They are not Open items in §6, so they went to QUESTIONS (Q-004…Q-007):
- Does `addSetChild` / `reorderSetChild` / `removeSetChild` raise the set's **`version`**? (It changes `lockVersion`, per "the editor gets the new lockVersion".) This decides whether copy holders of a set see `updateAvailable` after a structure change.
- Does `takeOverUpdate` raise the copy's `version` / `lockVersion`, and does it set `originalProblemVersion` to the original's current version?
- A child copied in with `copyFromId` keeps `originalId`, but `updateAvailable` is "never on its children". Is that child's link ever used?
- What does `takeOverUpdate` / `getProblem` report when the **original was deleted** (soft delete) or made private again?
