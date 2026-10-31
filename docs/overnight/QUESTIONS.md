# Questions for Daniel

Open questions found during the overnight run. None of these were answered or decided by the run.

| ID | Question | Context | Raised in |
|---|---|---|---|
| Q-001 | Where are the **49 existing scenario checks**? | The runbook (T1.3/T4.1) says to find and port them. They are not in this repo (any ref, stash or reflog), not in `C:\dev\matematika` (tracked or untracked), not in the overnight kit, not in `matematika(1).zip`. The only existing scenario artifact is `apps/api/requests.http` (11 manual requests). The run replayed those 11 as a substitute baseline (`scripts/smoke/run-requests-http.mjs`) and ported them in T4.1. If the 49 checks live elsewhere, they still need porting. | T1.3 |
| Q-002 | Should the generated contracts code be committed? | The runbook says "the committed generated code is from 1.0.x" and "don't run `pnpm generate` into the committed output". In fact `packages/shared/contracts/src/generated/` is in `.gitignore` and has never been committed. So a fresh clone builds the API only by generating from the **current** spec (2.0.0), and that build fails (9 TS errors). The run added `pnpm baseline:build`, which generates from the 1.0.1 spec at `fcd8b9c` into the gitignored folder. That's a stopgap for tonight, not a proposal. | T1.2 |
| Q-003 | Was the YAML anchor style in spec 2.0.0 intentional? | Spec 2.0.0 contains 27 anchors and 58 aliases with PyYAML-style generated names (`&id001`, `*id001`), mostly inside examples. That suggests the file was round-tripped through a YAML dumper. `main.ts` parses it with `yaml`'s default `maxAliasCount: 100` and crashes on startup (R-001). The fix is either in the spec (plain YAML, no anchors) or in `main.ts` (parse option). Both files are read-only tonight. | T1.2 |
