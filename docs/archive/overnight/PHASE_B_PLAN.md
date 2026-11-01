# Phase B plan (Prisma + JWT), document only

Written by the overnight run (T7), 2026-10-31. Nothing here is implemented, and there is no Prisma or JWT code in the repo.
Where an Open item (§6) decides a step, the step is marked **blocked by O-x** and gives the options rather than a choice.

Order of work: **T7.0** first (the mock catches up with spec 2.0.0, tests turn green), then **T7.2** (swap the
data and auth layers under green tests). T7.1 is the data model both steps need. T7.3 says which tests carry over.
T7.4 lists the risks.

---

## T7.1 Data model the mock and spec 2.0.0 imply

Source: `apps/api/src/database/mock-database.ts` (row shapes, comments on the real DB), the spec's schemas, and the
behaviour the tests pin down. Types are PostgreSQL-level. "API" = how the field leaves the API (all ids as Sqids).
Daniel will compare this with the dbdiagram schema. Listed = what a Prisma schema must contain to serve the current spec.

### user
| Field | Type | Null | Notes / API |
|---|---|---|---|
| id | int PK, autoincrement | no | `UserRef.id` (Sqid) |
| display_name | text | no | `UserRef.displayName` |
| role | enum `TEACHER`, `ADMIN` | no | trust rules: admin publishes directly |
| trust_level | enum `REGISTERED`, `VERIFIED`, `TRUSTED` | no | publish → 403 / REVIEWING / PUBLISHED |
| (auth fields) | email, password_hash, … | | not in this spec; JWT phase (refresh tokens, see B1) |

### license
| Field | Type | Null | Notes |
|---|---|---|---|
| id | int PK | no | `LicenseRef.id` |
| name | text | no | |
| description | text | yes | `License.description` |
| url | text | yes | |
| requires_attribution, allows_modification, requires_share_alike | bool | no | `License` |
| allows_publication | bool | no | **not in the API**; filters `listLicenses`, checked by publish |

### tag
| Field | Type | Null | Notes |
|---|---|---|---|
| id | int PK | no | |
| name | text | no | `q` filter: case-insensitive contains, Czech collation (mock: `localeCompare(…, 'cs')`) |
| is_global | bool | no | API `scope: global/personal` |
| owner_id | int FK → user | yes (null when global) | visibility: global or own |

### chapter
| Field | Type | Null | Notes |
|---|---|---|---|
| id | int PK | no | |
| name | text | no | sorted by name within each parent |
| is_global | bool | no | |
| owner_id | int FK → user | yes | |
| parent_id | int FK → chapter (self) | yes | a personal chapter may sit under a global one; filter by parent includes descendants |

### problem
| Field | Type | Null | Notes / API |
|---|---|---|---|
| id | int PK | no | |
| name | text | no | min length 1 |
| assignment | text | no | min length 1 |
| result | text | yes | must be null on a set parent (409 `SET_PARENT_HAS_RESULT`) |
| language_id | FK → language (or text code) | yes | mock stores the code (`languageCode`); API `language` is the code; independent filter |
| difficulty | smallint | yes | 1–10 |
| author_id | int FK → user | no | owner; all author-only checks |
| publish_status | enum `PRIVATE`, `REVIEWING`, `PUBLISHED`, `WITHDRAWN`, `BLOCKED` | no | API `status` (author only) |
| version | int | no | content version; raised by applied edits and **by any child edit** (on the parent); compared for `updateAvailable` |
| lock_version | int | no | optimistic lock; **each child has its own**; raised on the parent by structure changes (`/children`), not by child edits |
| original_problem_id | int FK → problem | yes | API `originalId` (author only); set by copy / copyFromId |
| original_problem_version | int | yes | original's `version` at copy / take-over time |
| dismissed_original_version | int | yes | **needed by `dismissUpdate`** ("hides the notice until the original gets another new version"). Name and form are open; any stored "dismissed up to version N" works |
| created_at, updated_at | timestamptz | no | API `createdAt`/`updatedAt`; list sorted by `updated_at desc` in the mock (the spec states no order) |
| deleted_at | timestamptz | yes | soft delete; every read filters `deleted_at is null` |

`updateAvailable` (computed on read, §6 Decided) = `original_problem_id is not null` and
`original.version > max(original_problem_version, dismissed_original_version)`, only for the copy's author, only on top-level problems.

### problem_part (set membership)
The mock keeps `parentId` + `position` on the problem row; its comment says the real DB has `problem_part`.
| Field | Type | Null | Notes |
|---|---|---|---|
| parent_id | int FK → problem | no | the set |
| child_id | int FK → problem, **unique** | no | a problem is in at most one set; one-level nesting (a set can't be a child) |
| position | text | no | fractional index (§6 Decided: string fractional-indexing values); unique per parent |
(Alternative with the same semantics: nullable `parent_id` + `position` on `problem`, as the mock does. Either serves the spec.)

### content_source (1:1 with problem, each copy gets its own)
| Field | Type | Null | Notes / API `SourceRef` |
|---|---|---|---|
| problem_id | int PK/FK → problem | no | |
| origin_type | enum `OWN`, `LICENSED_USE`, `FREE_USE` | no | `type`; copy rule: OWN → LICENSED_USE (**O4** open for own copies) |
| source_citation_text | text | yes | `citation` (null for OWN) |
| license_id | int FK → license | yes | `license`; null until first publish; **irrevocable once set**; inherited by copies |
| license_note | text | yes | `licenseNote` |
| citation_audience | enum `PUBLIC`, `TEACHER_ONLY` | no | not in the API yet (share codes, Phase C) |
| show_in_web, show_in_pdf | bool | no | `showInWeb`, `showInPdf` |

### problem_tag, problem_chapter (join tables)
`(problem_id, tag_id)` / `(problem_id, chapter_id)`, both PK pairs. Order: the mock keeps insertion order and the API
returns tags in that order (tests assert it), so a `position` or the insertion id may be needed if order matters.

### Phase B additions (from the TODO markers, not in the API)
- **problem_revision** (B3, B5): pending content change of a published problem by a non-trusted author (the 202 path):
  `problem_id`, `author_id`, proposed content fields (+ tag/chapter lists, + set structure for `/children` 202s),
  `base_version`, `status` (PENDING/APPROVED/REJECTED), timestamps. How auto-approvals are marked is **O5**.
- **minor_version** on problem (B4): a trusted user's minor edit. Interacts with `updateAvailable` (Q-010).
- **moderation_log** (§6 O5 context): admin actions; `actor_id` admins only.
- **refresh_token** (B1): `user_id`, token hash, expiry, revoked_at.
- **attachment** (Phase C, C1): rows point to the same stored image (R2 key); copies duplicate rows, not files.
- Notification rows: only if **O2** chooses them.

---

## T7.0 Mock → spec 2.0.0 (before Prisma)

Goal: every skipped `[R-0xx]` test passes, so the swap in T7.2 happens under a full green suite. Order chosen so each
step unblocks the next steps' tests. "Tests" = the skipped tests to un-skip.

| # | Step | Files | Tests | Finding |
|---|---|---|---|---|
| 0 | Fix startup (alias limit) and regenerate contracts from 2.0.0 (`pnpm generate`); fix the 9 compile errors by deleting the 1.0.x `children` paths | `main.ts:16`; `set-rules.ts`, `problem-sets.service.ts` (`planChildren`/`applyChildren` go), `problems.service.ts:69-74,106,119-129,144`; regenerate `packages/shared/contracts/src/generated` | create R-011; then `requests-http` scenarios 4/5 must be rewritten to the 2.0.0 flow | R-001, R-011, Q-002 |
| 1 | `error-codes.ts`: add `IS_SET_CHILD`, `CANNOT_ADD_TO_SET`, `NO_UPDATE_AVAILABLE`; rename `SET_CHILD_EDIT_VIA_PARENT` | `packages/shared/contracts/src/error-codes.ts`, `problems.service.ts:151,164` | delete/dissolve R-010 | R-010, R-012 |
| 2 | Validation gap: require `name`/`assignment` on create | spec branch or controller/service check | create R-015 | R-015 |
| 3 | Mapper: `lockVersion` on `toDetailCore` (author only, so children get theirs), `originalId` on `toDetail` | `problem.mapper.ts:57-76` | get/create/copy R-008 | R-008 |
| 4 | Child edits: drop the set-child guard in `update`; bump the parent's `version` on a child edit; 202 rule checks the parent's status; extract the trust rule into `domain/` | `problems.service.ts:111-145`, new `domain/review-rules.ts` (or similar) | update R-009 | R-009, R-016 |
| 5 | `addSetChild`: controller route, service `addChild` (move vs copy via `ProblemCopiesService.copy` with `parentId`), status/licence inheritance, position insert | `problems.controller.ts`, new `problem-sets.service.ts` methods, `position.ts` (insert between neighbours) | `sets/add-child` (37); `publish` licence-in-set test | R-002 |
| 6 | `reorderSetChild` | same files | `sets/reorder-child` (21) | R-003 |
| 7 | `removeSetChild` with `If-Match` → 412; filter gets a 412 title | same files, `problem-details.filter.ts` (412), maybe a small `IfMatch` pipe | `sets/remove-child` (18) | R-004, R-017 |
| 8 | `updateAvailable` computed in mapper/service; `ids` + `updateAvailable` list filters; malformed filter ids → 400 | `dto/list-problems.query.ts` (or regenerated `zListProblemsQuery`), `problems.repository.ts` `findMany`, `problem.mapper.ts`, `problems.service.ts:47-62` | list R-007/R-013, `copies` field + filter (10) | R-007, R-013 |
| 9 | `dismissUpdate` (stores the dismissed version) | new row field, controller + service | `copies` dismiss (6) | R-006 |
| 10 | `takeOverUpdate` (content replace; on a set, fresh copies of the original's children) | controller + service, reuses `ProblemCopiesService` | `copies` take-over (13) | R-005 |

After step 10: `pnpm --filter @matematika/api test:unskipped` should report 0 failures; then remove the `.skip`s
(and the 4 "passes by accident" notes) and turn `spec:drift` on in `verify` (`--with-drift`, see T2.3).

Decisions that change this list: O4 changes one rule in step 5/10 (copy rules); Q-004 (does a structure change
raise `version`?), Q-005 (versions after take-over), Q-008 (addSetChild edge cases), Q-010 (what counts as a new version).

---

## T7.2 Swap plan: the Phase B markers one by one

| Marker | Today | Phase B | Files | Order |
|---|---|---|---|---|
| B6/B7 `database.module.ts:4`, `mock-database.ts:4` | `MockDatabase` arrays, seeded in the constructor | `PrismaService` (extends `PrismaClient`, `onModuleInit` connect); migrations; a seed script with the same data as `mock-seed.ts` (tests rely on it, see T7.3) | `database/`, new `prisma/schema.prisma`, `prisma/seed.ts` | 1 |
| B8 `problems.repository.ts:16` (and the tags/chapters/licenses/users repositories) | array filters | same public methods, Prisma inside; `findMany` → `where` with `some` on join tables; chapters `withDescendants` → recursive CTE (`$queryRaw`) or load-and-walk (the chapter table is small) | all `repositories/`, `chapters.service.ts:21` | 2 |
| B9 `problem-sets.service.ts:31` + every multi-row write | plan-then-apply, no transaction | `prisma.$transaction` around: copy of a set (parent + N children + sources + links), dissolve, publish of a set, delete of a set, take-over of a set, `/children` operations (lock check + move + position) | `problem-copies.service.ts`, `problem-sets.service.ts`, `publication.service.ts`, `problems.service.ts` | 3 (with 2) |
| Optimistic locking | read, compare `lockVersion`, write | atomic: `updateMany({ where: { id, lockVersion }, data: { lockVersion: { increment: 1 } … } })` and check `count === 1` → else 409/412. Without this, two concurrent saves can both pass the check | `problems.service.ts` update; T7.0 steps 5–7, 10 | 3 |
| B2 `position.ts:2` | `positionAt(i)` renumbers all children | real fractional indexing (e.g. the `fractional-indexing` package: `generateKeyBetween(prev, next)`), one row updated per move; unique `(parent_id, position)` | `common/utils/position.ts`, set services | 4 (needed by T7.0 step 5 already) |
| B1 `mock-auth.guard.ts:8` | `Bearer jan` etc.; unknown token = jan (R-014) | `auth` module: login → access JWT (short) + refresh token (stored hashed, rotation); global `JwtAuthGuard` → 401 on missing/invalid/expired; `CurrentUser` keeps the same shape (`id`, `displayName`, `role`, `trust`) so services don't change | `common/guards/`, new `modules/auth/`, `users` (lookup by id/email) | 5 |
| B3 `problems.service.ts:132` (202 path) + B5 `publication.module.ts:7` | 202 returns the unchanged problem and stores nothing | store a `problem_revision` (PENDING) with the proposed change; returned problem unchanged; admin approve/reject endpoints (new spec operations, not in 2.0.0); apply on approve (raises `version`, so copy holders see `updateAvailable`) | `problems.service.ts`, `publication/` (review service), new admin controller; **blocked by O5** for how auto-approvals are recorded | 6 |
| B4 `problems.service.ts:136` | every applied edit: `version + 1` | trusted minor edit → `minor_version + 1`, `version` unchanged (so no copy update notice); what counts as minor is open (Q-010) | `problems.service.ts`, `content-fields.ts` | 7 |
| C1 `problem-copies.service.ts:48` (Phase C) | no attachments | attachment rows copied, pointing to the same R2 object | `problem-copies.service.ts` | Phase C |

Rule for the whole swap: services and controllers stay as they are; only repositories, the database module, the guard
and the transaction boundaries change. The `StoreProbe` interface is the test-side twin of that rule (T7.3).

---

## T7.3 Test reuse

The tests talk to the app through HTTP (`api`) and to the data through `StoreProbe` (`test/support/store.ts`), never to `MockDatabase` directly.

**Carry over unchanged once a `PrismaStoreProbe` exists** (it implements the same 7 async methods, mapping the row
fields below onto the Prisma models and decoding Sqids the same way):
- every operation test in `problems/`, `actions/`, `sets/`, `copies/`, `pickers`, `requests-http`: all assertions are HTTP + `StoreProbe`;
- `support/contract.ts` and `contract.spec.ts` (spec-only);
- `support/factory.ts` (API-only arrange helpers).

**What has to change around them:**
- `support/app.ts`: today a fresh `MockDatabase` per file comes for free. With Prisma: a **real database** per test run
  (Docker test Postgres, e.g. `docker compose -f docker-compose.test.yml up`), migrations, and the **same seed** as `mock-seed.ts`
  before each file (truncate + seed, or one schema per Jest worker). Tests refer to seed rows by id (`seed.problems.set` = id 1),
  so the seed must insert fixed ids, or `seed.ts` must look ids up after seeding.
- `support/auth.ts`: `authHeaders('jan')` builds a real JWT for user 1 (the file already says so). Tests keep `as('jan')`.
- `StoreProbe` field names: tests match mock row fields (`publishStatus`, `parentId`, `source.originType`, `tagIds`).
  A Prisma probe either returns the same flattened shape (recommended by the interface's comment) or those assertions get renamed.
  Of 196 store calls in the tests, 24 match on `source: {…}`, `tagIds` or `chapterIds`; those need the probe to flatten `content_source` and the join tables.
- `harness.e2e-spec.ts` "gives each app its own store": with a shared DB this becomes "each file starts from the seed".

**Need a real DB (cannot be faked by the mock):** concurrent optimistic-lock tests (two saves at once), transaction
rollback on a failing step of a set copy, unique `(parent_id, position)` under concurrent moves, recursive chapter filter
on deep trees, case-insensitive Czech `q` (collation). None exist yet; they are the first Phase B-only tests to add.

**Goes away:** the R-014 skipped test becomes a real JWT test (invalid/expired token → 401).

---

## T7.4 Risks: Open decisions that block Phase B steps

| Blocks | Open item | Why |
|---|---|---|
| B3/B5 (revision storage), B4 | **O5** | the revision/moderation tables and where an auto-approval is recorded must be fixed before migrations are written |
| copy rule in T7.0 steps 5 and 10 | **O4** | changes `sourceForCopy` and two test assertions; small, but it is in the data written by every copy |
| `updateAvailable` storage, notification table | **O2** | option B adds a table and a write on every edit (inside the edit transaction) |
| infrastructure (docker-compose, worker) | **O3** | option B adds Redis + a Chromium worker to Phase B's Docker setup |
| framework version, validation pipe, module layout | **O7** | an upgrade to NestJS 12 during the Prisma swap doubles the moving parts |
| generated docs / client version | **O8** | none technically; affects what `/docs` and generated code claim |

Other risks (not Open items):
- **Q-002**: the generated contracts are not committed; a fresh clone builds against whatever spec is current. Phase B CI must generate before build.
- **Q-004 / Q-005 / Q-010**: version semantics (structure changes, take-over, minor edits) decide when copy holders see an update; they are needed before step 8 of T7.0.
- **R-015-type generator gaps**: any spec schema using `allOf` + `required` of inherited properties loses the requirement in Zod. Check each new 2.0.0 schema after regeneration.
- **Concurrency**: the mock's check-then-write locking is not safe in Postgres (see T7.2 "Optimistic locking").
