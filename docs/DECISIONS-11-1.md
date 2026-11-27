# Decisions — 2026-10-31

The decisions Daniel made on the overnight run's decision files (`docs/overnight/decisions/`). Put this file in `docs/` in the repo.

## Decided

| ID | Topic | Decision | Applied in |
|---|---|---|---|
| O-8 | Spec version | Bump `info.version` to `2.0.0`. Add a `verify` check that `info.version` matches the newest changelog entry. The API path stays `/api/v1`. | spec + `scripts/` |
| O-4 | Source type when copying your own problem | **Your own copy stays OWN**, with no citation; the licence is still inherited. This is the same owner exception that tags and chapters already have. It applies to `copyProblem` and to `copyFromId` in `addSetChild`. | spec wording + mock `copy-rules.ts` |
| O-2 | Notifications for copy holders | Copies get **only the computed `updateAvailable` flag**; nothing is stored on edit. Reword "copy holders are notified" to "copy holders see `updateAvailable`". A `notification` table comes later, for **moderation and review results** to authors, specced together with moderation. | spec wording now; table later |
| O-5 | Marking auto-approved revisions | Every applied change to published content writes a `problem_revision`. Trusted and admin changes get `approval = AUTO` with `approved_by = NULL`, plus a DB check that `AUTO ⇔ approved_by IS NULL`. `moderation_log.actor_id` stays an admin, NOT NULL. | Phase B schema |

## Parked (current state stays until revisited)

| ID | Topic | Current state |
|---|---|---|
| O-3 | PDF export | Client-side printing. No export endpoint, no Redis/BullMQ. |
| O-7 | Deviations from the structure doc | NestJS 11, the own `ZodValidationPipe`, a separate `licenses` module. To revisit: NestJS 12 after Phase B. |

## Still open

- **Q-008 to Q-011** (`QUESTIONS.md`):
  - `addSetChild` edge cases
  - `updateAvailable` on problems that aren't copies
  - what counts as a new version
  - edits while a problem is REVIEWING
- **Q-001** (the "49 checks"): closed. They weren't in the zip, and the new test suite replaces them.

## Spec fixes queued with the version bump (no behaviour change)

- Remove the YAML anchors (`&id001`…). They crash the API at startup (R-001, S-1).
- `ProblemCreate`: put `required: [name, assignment]` in the same object as the properties it names (R-015, S-13).
- `createProblem` 201 example: one problem without children (S-3).
- `takeOverUpdate` and `publishProblem`: declare the 400 response (S-4, S-5).

---

# Decisions — 2026-11-01

| ID | Topic | Decision | Applied in |
|---|---|---|---|
| Q-004 | Set structure changes | Adding, reordering or removing a child raises the set's `version` (not only `lockVersion`), so copy holders see `updateAvailable`. This matches the diagram's comment on `problem.version`. | mock `problem-sets.service.ts` (todo) |
| D-01 | Sources of truth | One source per layer, all in the repo. **API:** `openapi.yaml`. **Database:** `schema.prisma`; the DBML for dbdiagram is generated from it and never edited by hand. **Decisions:** this file. Overnight docs are snapshots (`docs/archive/`). | from the first Prisma migration on |
| D-02 | Timestamps | All `timestamptz`. `created_at`/`updated_at` default `now()`; `updated_at` is set on update by Prisma `@updatedAt`. | schema |
| D-03 | Tags and chapters | No `slug`; identified by ID (consistent with 2026-10-19). Name uniqueness isn't enforced for now. | schema |
| D-04 | Order of a problem's tags and chapters | Sorted by name; no position column. | Prisma repository + spec wording (todo) |
| D-05 | `displayName` | `user.display_name`, nullable; the API returns `COALESCE(display_name, username)`. | schema + mapper |
| D-06 | Problem name length | Max 255 characters, in both the spec (`maxLength`) and the DB (`varchar(255)`). | spec 2.0.0 (revised 2026-11-01) |
| D-07 | Auto-approved revisions (refines O-5) | `auto_approved` revisions are APPROVED with no reviewer; a manually approved revision must have one; pending revisions have neither. Two CHECKs in the migration. | first migration (raw SQL) |

## Still open

- **Q-008:** someone else's private problem in `addSetChild`: "not found" (hide existence, like `getProblem`) or 409 `CANNOT_ADD_TO_SET`.
- **The six `DOMAIN-REVIEW` rules** from `IMPLEMENT_2.0.0_REPORT.md`.
- **`problem_revision.base_version`:** which version a pending edit started from (needed for approval conflicts).
- **`system_event`:** confirm what it's for (auto-trust), so auto-approvals aren't logged twice.
- **`worksheet.license_id`:** the worksheet links its licence directly, while problems go through `content_source`.

---

# Decisions — 2026-11-15 (traced from the work of 11-02 to 11-15)

These decisions were made in code and commits but never written down. Each row names the commit or file it comes from.

## Database

| ID | Topic | Decision | Applied in |
|---|---|---|---|
| D-08 | Prisma version | Prisma 7 with the `@prisma/adapter-pg` driver adapter. The datasource URL moved from `schema.prisma` to `prisma.config.ts`, which loads `.env` with `process.loadEnvFile` (no dotenv). `pg` is not a direct dependency. | `8949cc9`, `2a94063`, `01bfd81` |
| D-09 | Generated client format | `moduleFormat = "esm"`, because the API is an ESM package. Replaces the `cjs` from 11-01. | `2d31b6f` |
| D-10 | Refresh token table | `refresh_token.family_id` (text UUID, NOT NULL, indexed) groups the tokens of one login chain. `token_hash` is unique because every refresh looks it up. Only the hash is stored; the raw token is never stored. | migration `20261108180000_refresh_token_family`, `d2dbc22` |
| D-11 | Optimistic lock in SQL | The lock check is part of the write: `UPDATE … WHERE id = ? AND lock_version = ? AND deleted_at IS NULL`. Zero rows updated → 409 `LOCK_MISMATCH`. The check against the earlier read stays only as a fast fail. | `ProblemsRepository.updateIfLockVersion`, `985b146` |
| D-12 | Tag/chapter sort (refines D-04) | The repository sorts by name in the app with Czech collation (`localeCompare(…, 'cs')`), not in SQL, so mock and Prisma give the same order. | `prisma-tags.repository.ts:27`, `prisma-chapters.repository.ts:26`, and `prisma-problems.repository.ts:70, 75` (the order of a problem's own tags and chapters, which is what D-04 is about) |
| D-13 | Role → API role/trust | DB `user_role` maps to the API's `role` + `trust`: SUPERADMIN/ADMIN → ADMIN + TRUSTED; TRUSTED_TEACHER → TEACHER + TRUSTED; VERIFIED_TEACHER → TEACHER + VERIFIED; REGISTERED_TEACHER → TEACHER + REGISTERED. The pair is used only inside the server; the API returns the raw DB role (`CurrentUser.role`, five values) through `toCurrentUser`. | `prisma-users.repository.ts`, `auth.service.ts:26` |
| D-14 | Test database schema | `test:prisma` applies the real migrations (`migrate deploy`) instead of `db push`, so the tests run with the CHECK constraints. (This closes the note in `DB_SLICE.md`.) | `scripts/test-prisma.mjs` |

## API (spec 3.0.0)

| ID | Topic | Decision | Applied in |
|---|---|---|---|
| A-01 | Auth transport | The Bearer header is replaced by two httpOnly cookies, `SameSite=Lax`, with `Secure` set in production (override with `COOKIE_SECURE`). `access_token` has path `/api` and is sent with every call. `refresh_token` has path `/api/v1/auth`, so no other endpoint ever receives it. | spec 3.0.0, `auth-cookies.ts`, `e808af2` |
| A-02 | Access token | HS256 JWT, `sub` = user id, 15 min (`ACCESS_TOKEN_TTL_SECONDS`). `JWT_SECRET` is required in production; a dev secret is used otherwise. | `token.service.ts`, `auth-config.ts` |
| A-03 | User state per request | The guard loads the user from the DB on every request, so a block or role change takes effect at once and does not wait for the token to expire. A blocked user gets 403 `ACCOUNT_BLOCKED`. | `jwt-auth.guard.ts` |
| A-04 | Refresh rotation | A refresh token is opaque, lasts 7 days (`REFRESH_TOKEN_TTL_DAYS`) and is single-use: each refresh revokes it and issues a new one in the same family. If a revoked token is presented again, or two refreshes race (`revokeIfActive` fails), the whole family is revoked and the user must log in again. Logout revokes the family. | `auth.service.ts` |
| A-05 | CSRF | Every POST/PATCH/PUT/DELETE, login and register included, must send `X-Requested-With: XMLHttpRequest`; otherwise 403 `CSRF_CHECK_FAILED`. GET is exempt. | `csrf.guard.ts` |
| A-06 | Passwords | argon2id. Wrong email and wrong password both give the same 401 `INVALID_CREDENTIALS`. | `auth.service.ts` |
| A-07 | Register | Optional `displayName` (blank → null, see D-05). `language` defaults to `cs`; an unknown code → 400. Duplicates → 409 `EMAIL_TAKEN` / `USERNAME_TAKEN`. New users are REGISTERED_TEACHER. Username has `minLength 2`. | `auth.service.ts`, `cacf0f3` |
| A-08 | Editing a set child (closes R-009) | `PATCH /problems/{id}` accepts a set child, which has its own `lockVersion`. The edit raises the set's `version` (copy holders see `updateAvailable`) but not the set's `lockVersion`, so it does not conflict with someone editing the set structure. If the child **or its set** is published and the author is not trusted, the edit takes the 202 review path. | `problems.service.ts`, `985b146` |
| A-09 | Spec fixes | `SourceRef.license` allows `null` again; `name`/`assignment` are restored on `ProblemCreate` and `ProblemListItem`, with `maxLength 255` on name (D-06). | `cacf0f3` |
| A-10 | Web client | Axios sends cookies and `X-Requested-With`. On a 401 it calls refresh once and retries the request. The `VITE_DEMO_USER` Bearer hack is removed. | `f65237b` |

## Tooling (supersedes O-7)

| ID | Topic | Decision |
|---|---|---|
| T-01 | Stack | NestJS 12, TypeScript 6, an ESM API, and Vitest 4 with `unplugin-swc` (esbuild does not emit decorator metadata). Jest is removed. The memory cap stays in `scripts/test-capped.mjs`. |

## To implement (decided, not in code yet)

| Ref | What is missing | Where |
|---|---|---|
| Q-004 | `addChild`, `reorderChild` and `removeChild` raise only the set's `lockVersion`. They must also raise `version`. | `problem-sets.service.ts:114, 148, 175` |
| D-11 | The set operations still check the lock against the earlier read and then write by id. They need the same atomic guard as `update`, including the renumbering in one transaction. | `problem-sets.service.ts` |
| O-5 / D-07 | The 202 path stores nothing yet. It must write a `problem_revision` (REVIEWING), and trusted/admin edits must write an `auto_approved` revision. This covers PATCH, and add and reorder on a published set (D-23). Removal no longer takes the 202 path at all (D-19). | `problems.service.ts:137`, `problem-sets.service.ts`, `publication.module.ts` |
| D-16 (was B4) | A trusted user's minor edit raises `minor_version` instead of `version`. | `problems.service.ts:141` |
| Phase B | Real fractional indexing for `position` (today every save renumbers all children). | `common/utils/position.ts` |
| Phase C | On copy, attachment rows point to the same stored image. | `problem-copies.service.ts:48` |
| — | Worksheets module: only commented-out stubs, not in the spec yet (see open questions). | `modules/worksheets/` (untracked) |

## Still open

- **Q-008, Q-009, Q-010, `base_version`, `system_event`, `worksheet.license_id`**: still open, unchanged from 11-01 (Q-011 is settled by D-17 below). Today `addSetChild` with someone else's private problem returns 400 "not found" (`findSource`). This hides that the problem exists, but it is not written down as the answer to Q-008.
- **The `DOMAIN-REVIEW` rules** (`IMPLEMENT_2.0.0_REPORT.md` §2): four are still not confirmed (move, `afterId` on add, inheritance on add, `afterId` on reorder). Of the six listed there, O-4 was decided on 2026-10-31, and "last child out" is the same question as the removed child's status (D-19).
- **Worksheets API**: the endpoints, whether it gets copies/`updateAvailable` like problems, and how its licence relates to its problems' licences.
- **CI**: `.github/workflows/verify.yml` is deleted in the working tree but not committed. Is CI dropped on purpose?
- **Terminology**: the editor UI is changing "příklad" to "úloha" (uncommitted). Should the change apply everywhere (web, seed, spec examples)?

---

# Decisions — 2026-11-15 (design review, round 1)

From going through `DOMAIN.md`. Each row says which earlier item it settles or changes.

| ID | Topic | Decision | Settles |
|---|---|---|---|
| D-15 | What raises `version` | Only a change to the content (name, assignment, solution, result, language, difficulty) raises `version`. A change of only tags or chapters raises `minor_version`, not `version` (corrected 2026-11-16; the first wording said it raised nothing but `lock_version`). Each applied change so raises one of the two: `version` for a normal content change, `minor_version` for a tag- or chapter-only change and for a content change a trusted author marked minor (D-16). Reason: take-over keeps the copy's tags and chapters, so a tag-only bump would show copy holders an update that brings nothing. | conflict between PATCH and take-over |
| D-16 | Minor edits | Only a trusted teacher or an admin can mark an edit as minor. It then raises `minor_version` instead of `version`, so copy holders get no update notice. Anyone else's content edit always counts as a full version, because a "minor" flag from an unreviewed author could carry unwanted content onto the site. | `minor_version` TODO |
| D-17 | Editing while REVIEWING | An applied edit to a REVIEWING problem sends it back to PRIVATE; the author has to publish it again. Reason: old versions are overwritten (no draft history), so there is no earlier version to keep under review. | Q-011 |
| D-18 | History of published content | `problem_revision` rows are the history of what was public and are never deleted. Publishing writes a revision with the content (`problem_revision.content`) so that bad content can be looked up later. Changes to published content write revisions as in O-5/D-07. Private drafts keep no history. | refines O-5 |
| D-19 | Structural removal of published content | Endpoints that take **no content input** (removeSetChild, dissolve, delete) are applied directly, without review, for every author: they cannot introduce invalid input. Removing a child raises the set's `version` (Q-004), so set copy holders see `updateAvailable` and choose to take over or keep their copy. **Every PATCH of published content goes to review**, including one that only deletes text: deleting words can change the meaning. | Q-004 confirmed; replaces the 202 on removeSetChild |
| D-20 | Who is notified (direction, not yet scoped) | Copy holders: through `updateAvailable` only (O-2 stands). Worksheet owners whose worksheet uses a removed or changed problem: a stored notification (`WORKSHEET_ITEM_REMOVED`). The author: moderation results. Needs a detailed scope before implementation. | O-2 confirmed |

## Round 2

| ID | Topic | Decision | Settles |
|---|---|---|---|
| D-21 | Pending revision of a withdrawn review | When D-17 sends a REVIEWING problem back to PRIVATE, its pending revision gets the new status **WITHDRAWN** (added to `revision_status`). It is kept, like every revision (D-18), and shows that the author pulled it back, not that a moderator rejected it. | D-17 follow-up |
| D-22 | D-17 on a set | Editing any child of a REVIEWING set sends the **whole set** (parent and all children) back to PRIVATE, because a set is published and reviewed as one unit. | D-17 follow-up |
| D-23 | Reorder and add on a published set | For a non-trusted author, **reorder and add both go to review** (202 + a pending revision of the structure). Rule: everything except a pure removal (D-19) is reviewed. | D-19 follow-up |
| D-24 | Copies of a deleted original | The copy stands alone: `updateAvailable` is always false and the API returns `originalId: null`. The DB keeps `original_problem_id` for audit. The copy keeps its citation. | deletion gap |

## Still open after round 2

- **Notifications scope (D-20):** which events, which recipients, when they are created, and how they are read and dismissed.
- **A removed child's status (D-19):** today it becomes PRIVATE even when the set was published. Not contested, not confirmed.
- **What a structural revision stores (D-23):** `problem_revision.content` is one problem's content; a pending reorder/add needs the proposed child order (and the added problem), so the revision format needs a shape for set structure.

---

# Decisions — 2026-11-16 (design review, round 3)

Round 3 stepped back from single edge cases to the whole model. Breaking changes to the spec, the schema and existing data are allowed. `DOMAIN.md` and steps 2–4 of `domain-continue.md` are **not updated yet**: they still describe the 202 path. The "To implement" table of 11-15 is stale for the same reason.

## What the model has to guarantee

| # | Promise |
|---|---|
| G-1 | Nothing unreviewed becomes public. |
| G-2 | Nobody's material changes under them without their consent. A worksheet prepared on Monday is the same on Friday. |
| G-3 | People find out when something they depend on changed, and can choose the new state or keep the old one. |
| G-4 | An author can work on something over time without it being public or submitted. |

## Decided

| ID | Topic | Decision | Settles / replaces |
|---|---|---|---|
| D-25 | Working row and public copy | The author's row is the **working row**: always private to the author and always editable. Publishing asks for approval of its current state. On approval the system creates the **public copy**: a separate `problem` row, linked to the working row through its own column (working name `published_from_id`). Every later approval **updates that same public copy**, so a published problem is two rows, however often it changes. Everything other people see, copy, put into a worksheet or open through a share link is the public copy. The public copy carries the working row's lineage (`original_problem_id`, `root_problem_id`) and has its own `content_source` row with the same values (D-31). The link cannot be `original_problem_id`: a working row that is itself a copy of someone's problem already uses that column, and its public copy must keep that lineage. For a set, the parent and each child get a public copy, each linked to its working row; an update matches children through that link (changes, adds and removes them), so rows that other people's copies point at survive. Reason: first publication and later changes are one operation, the author always has a place to work, and the approved state is kept as a readable row instead of JSON inside a review. | Replaces the 202 path (A-08's last sentence, O-5's pending revision as the store of a change), **D-23** and the direct removal in **D-19**: removing a child, dissolving, and changing tags are working-row operations that reach the public on the next approval. D-17, D-21 and D-22 apply to the request: editing a working row while its request is pending withdraws the request (revision WITHDRAWN); a public copy that already exists stays public. Closes steps 1.2 (shape of a pending structure change), 1.9 and 1.11 of `domain-continue.md`. |
| D-26 | WITHDRAWN and BLOCKED | **WITHDRAWN is a user action**, recorded on the revision (D-21) and in the log. A problem itself is never in a WITHDRAWN state. **BLOCKED is a moderator action** and stays a problem status: the problem is hidden like a private one and cannot be published. | Step 1.7. `publish_status.WITHDRAWN` can be dropped from the enum. |
| D-27 | Other people's problems in a worksheet | Adding someone else's problem to a worksheet makes a **copy** of its public copy (with `original_problem_id` and its own `content_source` row, as for any copy). The worksheet never points at a problem its owner cannot control. Updates reach the worksheet the same way as any copy: `updateAvailable`, then take over or dismiss. | Keeps G-2 for worksheets. |
| D-28 | Publishing a worksheet | A worksheet is published as **one unit**, like a set, and follows D-25: the author's worksheet is the working one and references the author's working rows; its public copy references the public copies of those problems. It can be taken over as a whole. | Worksheets API (open item of 11-15); "editing a published worksheet". |
| D-29 | Trusted authors | One pipeline for everyone. A trusted teacher or admin also publishes through a request; it is approved automatically (`auto_approved`) and applied at once. It may be marked minor (D-16: the flag is given on the publish request, not on PATCH). Reason: one path to implement, and public content changes at one point only. | The trusted half of O-5 / D-07; step 2 "minor flag on `ProblemPatch`". |
| D-30 | Editor and model | The editor works on items: one problem is one item with a stable id, edited in place. Markdown is the output (preview, print) and is never parsed back into problems. Storage and the API stay one row per problem with explicit structure operations. | — |
| D-31 | `content_source` | `content_source` says how **this** problem may be used and whom to credit: origin type, licence, citation and where the citation is shown. It stays a separate table with **one row per problem** (and one per image, which is why it is a table and not columns on `problem`), never shared: an original is `OWN` while its copy is `LICENSED_USE` with a citation. Three links, three jobs: `original_problem_id` is where a copy came from and drives updates; `content_source` is the usage and the credit; `license` is the terms. | Confirms the current schema and `sourceForCopy`. An earlier draft of this row (a source shared by all copies) was dropped the same day. |
| D-32 | An own problem in several worksheets | The author's own problem is a live reference to the working row and can sit in several of their worksheets. Publishing any worksheet that contains it publishes the problem (D-28); it stays one working row, referenced by all of them. | Open item "own problems in a worksheet". |
| D-33 | Finding everything that comes from one problem | New column `problem.root_problem_id`: the first original of the copy family. Set once at copy time to the original's root, or to the original's id when the original is not a copy; never changed afterwards. The whole family is then `root_problem_id = X` plus the root row, in one indexed query, used for a licensing removal and for "used N times". `original_problem_id` stays: it drives `updateAvailable` and take-over, and "this row and everything copied from it" (a copy that added infringing content) still follows it downwards with a recursive query. In a copied set each child gets its own root. `worksheet` gets the same column when worksheets are built. | Licensing removal. Schema: new column and index, backfilled along `original_problem_id` for existing rows. |
| D-34 | Pulling published content | The author pulls a problem from the public by deleting its public copy; the working row stays. Deleting the working row deletes its public copy with it, found through the D-25 link, so no public row is left without an owner's row. | "A problem that goes back to private" (step 1.3, 1.8): the working row never stopped being private. |
| D-35 | What happens to other people's copies | **Author pulls (D-34): copies stay.** They were made under a licence that allowed it, deleting them would break other teachers' worksheets (G-2), and deletion would protect nothing, since the content could already be printed or retyped. **Moderator blocks for content that should never have been public: the whole family is blocked**, found through `root_problem_id` (D-33). Blocked, not deleted, so it can be reversed and leaves a record. | Step 1.7 and 1.8. |
| D-36 | A copy whose original is gone (changes D-24) | The copy still stands alone and gets no update offers, and the DB keeps `original_problem_id`. But the API no longer hides it as `originalId: null`: the holder is told, by a flag computed on read, that the original is no longer available. Nothing is stored. Applies to a deleted and to a blocked original. | Changes **D-24**; "a copy with a missing original" and "not a copy" no longer look the same (part of Q-009). |
| D-37 | History (confirms D-18) | Every approval stores a snapshot of what became public in `problem_revision`, and the rows are never deleted. For a set the snapshot includes the children and their order. | D-18 under D-25. |
| D-38 | Notifications (scopes D-20) | Whoever depends on a problem is a copy holder (a worksheet item is a copy too, D-27) and learns about changes only through values computed on read: `updateAvailable` and the D-36 flag. The author gets stored notifications for moderation results. The stored `WORKSHEET_ITEM_REMOVED` of D-20 is dropped: a worksheet never loses an item. | D-20, step 1.1 for content changes. |
| D-39 | Deleting or pulling a problem that worksheets use | It is applied directly and **cascades**, with a warning first ("used in N worksheets"). **Pull:** the public copy is deleted and leaves the author's public worksheets; the working row stays in the author's collection and in their working worksheets. **Delete:** the working row is soft-deleted too and leaves the working worksheets as well. One transaction; each affected public worksheet gets a new `version`. No review, because a removal adds no new content. Only the author's own worksheets are touched: other people's worksheets hold copies (D-27), which stay (D-35) and get the D-36 flag, so nothing is written for them. A 409 "remove it from the worksheets and publish them first" was rejected: it sends the author in circles, and for a non-trusted author it leaves pulled content public until every worksheet is reviewed. | D-34 for problems in worksheets. A public worksheet can lose an item without being published; accepted. |

D-15 (round 1) was corrected the same day: a tag- or chapter-only change raises `minor_version`, not nothing.

## Proposed, not confirmed

- **Stored notifications in detail.** Which moderator actions write one (approved, rejected, blocked, unblocked, account verified, role changed), written in the same transaction as the action; "read" exists as `read_at`, "dismissed" does not.
- **Sets and worksheets share rules, not a table.** Both are "a unit with ordered members": published, copied and taken over as a whole. A worksheet stays in its own table, because it can hold sets (a second level) and its owner's problems can sit in several worksheets, which `problem_part` (one parent per child, one level) does not allow.
- **Where the counters live under D-25.** `lock_version` matters on the working row. `version` and `minor_version` matter on the public copy and are raised at approval, by D-15 and D-16.

## Open after round 3

- **Mechanics of D-25:** the name of the link column; which statuses live on which row (working: PRIVATE, REVIEWING; public: PUBLISHED, BLOCKED) and how a block stops further publish requests; how the author's list shows the pair as one item and how "has unpublished changes" is detected; migrating today's published rows, whose public id is the row the author edits.
- **A request pending on shared problems (D-22 with D-32):** an own problem can be in several worksheets, so editing it could withdraw every pending request that contains it.
- **Worksheet copies in the public catalogue (D-27 with D-28):** publishing a worksheet publishes its copies of other people's problems. Hide them from lists the way set children are hidden, or the catalogue fills with duplicates.
- **Version of a published worksheet:** by analogy with a set (A-08), an approved change of a problem should raise the `version` of every public worksheet that contains it. Not confirmed.
- Still open from before: Q-008, Q-009 (rest), Q-010, `base_version` (probably not needed after D-25), `system_event`, `worksheet.license_id`, the four `DOMAIN-REVIEW` rules, a minor edit of a set child (step 1.10), CI, terminology.

---

# Decisions — 2026-11-20 (sets and private worksheets)

This round makes sets correct and builds private worksheets. Publishing, sharing and copy updates come later (`domain-continue.md`, "Later"). **Every row is proposed until Daniel confirms it.**

## Worksheets before D-25

| ID | Topic | Proposal | Settles |
|---|---|---|---|
| D-40 | Scope until D-25 | Worksheets are **private**. Only the author sees one (others get 404, as for a private problem) and only the author edits it. `license_id` and `citation_display` stay out of the API (`license_id` is still open). Publishing (D-28), copying and sharing come with D-25. | Worksheets API (open item of 11-15), first slice |
| D-41 | Adding an item | One `problemId`; the server decides. The author's **own** top-level problem (standalone or set parent) goes in as a live reference (D-32). **Anyone else's** visible problem is copied first (usual copy rules), and the copy goes in (D-27). An own set child → 409 `IS_SET_CHILD`. A problem already in the worksheet → 409 `ALREADY_IN_WORKSHEET` (new code; `worksheet_problem` has the key `(worksheet_id, problem_id)`). Not visible → 404. | D-27, D-32 in the API |
| D-42 | Removing an item | Only unlinks it. The problem stays in the author's collection, a copy made for the worksheet included. | — |
| D-43 | Counters | `worksheet` gets `lock_version` (new migration). PATCH and every item operation check it and raise it atomically (D-11). `version` goes up on a change of name, difficulty or language and on any item add, reorder or removal, not on a tags- or chapters-only change (D-15 by analogy). No `minor_version` on worksheets yet. | — |
| D-44 | Item order | `worksheet_problem.position` uses the same keys (`positionAt`) and the same `afterId` rules as set children: missing = at the end, `null` = first, an item id = right after it. Every change rewrites the order in one transaction. | — |
| D-45 | A deleted problem in a worksheet | Until D-39 is built, reads skip soft-deleted problems. Deleting a problem does not touch `worksheet_problem` yet. Known gap: the D-39 cascade, its warning and the version bump. | — |

## Pulling keeps the public copy

| ID | Topic | Proposal | Settles / replaces |
|---|---|---|---|
| D-46 | Pulling never deletes the public copy | Pulling sets the public copy's status to **`WITHDRAWN`**, meaning "pulled by its author" (a working row never has this status). The row stays, and so do its `published_from_id` link to the working row, its `version`, its revisions and its moderation log. Re-publishing approves into the **same** row: back to PUBLISHED, with `version + 1` when the content changed, so copy holders see `updateAvailable` again and the D-36 flag disappears by itself (it is computed on read). Deleting the working row soft-deletes the working row and pulls the public copy the same way: the copy is never deleted and the link stays. D-36 covers a pulled original too (deleted, blocked or pulled). The family for a D-35 block is the public copy, every row with `root_problem_id` = that copy, and the working row found through `published_from_id`. Reason: other people's copies (`original_problem_id`), the history (`problem_revision.problem_id`, never deleted per D-18), moderation logs and the family block all point at the public copy. Deleting it would cut every one of them off, and a later re-publication would start a new row that nobody's copies follow. | Revises **D-34** ("deleting its public copy"), **D-39** ("the public copy is deleted": it is pulled, and it still leaves the author's public worksheets) and **D-26** (`publish_status.WITHDRAWN` stays, with this meaning). |

## Sets: confirming what the code does

| ID | Topic | Proposal | Settles |
|---|---|---|---|
| D-47 | The `DOMAIN-REVIEW` rules | Confirm as built: a move takes your own PRIVATE standalone problem into the set; `afterId` on add (missing = end, `null` = first, a child id = after it); `afterId` on reorder (required; `null` = first); on add, the child takes the set's status, and, in a published set, the set's licence when it has none. | The four `DOMAIN-REVIEW` rules (`IMPLEMENT_2.0.0_REPORT.md` §2) |
| D-48 | Q-008 | Someone else's private problem in `addSetChild` → 400 "not found", which hides that it exists. `copyFromId` pointing at a child of another set is allowed and gives a standalone copy, as `copyProblem` does. | Q-008 |
| D-49 | A removed or freed child | It is PRIVATE, also when the set was published. Under D-25 this is the working row, which is always private anyway. | Step 1.3 of the old resume file |
| D-50 | The 202 path until D-25 | It stays exactly as it is. Removing it before the working row and public copy exist would let a non-trusted author change published content directly (G-1). It goes away with D-25 in spec 4.0.0. Worksheets are private, so they never answer 202. | D-19's direct removal waits for D-25 |

# Decisions — 2026-11-21

## Review has no exceptions

| ID | Topic | Proposal | Settles / replaces |
|---|---|---|---|
| D-51 | What goes through review | Under D-25 every edit changes the author's **working row** and is applied right away, with no review and never a 202. **Every** difference that would reach the public copy needs an approved publish: content, tags, chapters, set structure (add, reorder, remove a child, dissolve) and worksheet items. There is no "harmless change" list. The one exception is **taking content down** (pull D-46, delete D-39): it only removes something from the public, so it cannot be used to slip content past review, and an author must be able to do it at once (e.g. a licence problem). Reason: one path for everything public keeps the code simple and leaves no route around review. A tags-only change still raises `minorVersion` rather than `version` (D-15), which only decides whether copy holders see `updateAvailable`. Open: whether a trusted author's publish is approved automatically. | Replaces **D-19** (direct structural removal of published content) and **D-23** (the "except a pure removal" rule). Applies to problems, sets and worksheets (D-28). |

# Decisions — 2026-11-27

## Image upload (spec 3.2.0)

| ID | Topic | Proposal | Settles / replaces |
|---|---|---|---|
| D-52 | Uploading images | `POST /assets` takes **one file per request** (multipart field `file`); the frontend sends several images as parallel requests, so there is no partial success. Allowed: PNG, JPEG, WebP, read from the file's bytes, not its name. **No SVG** (can carry script), **no GIF** (not supported). A server upload is `READY` at once; `PENDING` stays for direct signed uploads to R2 later. The image itself is a separate URL (`/assets/{id}/content`) so `<img src>` can load it and the browser can cache it (`private, immutable`); the details travel as JSON (`Asset`). For now only the uploader can see an image; linking images to problems and worksheets (`attachment`) comes later. | New |
| D-53 | Planned image endpoints (spec 3.3.0, documented, not built) | Marked `x-status: planned` so they can be built against later. **Library:** `GET /assets` (own images, newest first). **Delete:** soft delete; the image is removed from the uploader's own problems and worksheets (applied directly, also on published ones, since it only takes content down); other teachers' copies keep their attachment and still show it (D-36); the file goes once nothing points to it; no notification (D-38). **Attachments:** POST/PATCH/DELETE `/problems/{id}/attachments[/{assetId}]` and the same on worksheets, following the item rules (`afterId`, lockVersion in the body, If-Match on DELETE, whole parent returned). Only on **PRIVATE** problems and worksheets until D-25 (403 otherwise), so the 202 path (D-50) stays out of it. The URL key is `assetId`: an image is on a given problem or worksheet at most once (`ALREADY_ATTACHED`). **Viewing** `/content` will also be allowed to anyone who can see a place that uses the image. Needs before building: `asset.deleted_at`, and `attachment` rebuilt with its own id, `problem_id`/`worksheet_id` plus a CHECK that exactly one is set. | Extends D-52 |
