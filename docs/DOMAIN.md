# Problem domain: how problems work

This file describes the problem model as it stands on 2026-11-15 (worksheets in §9 added 2026-11-20): what each property means, which operation changes it, and which operations write to rows other than the one in the request.
Decisions and their reasons are in `DECISIONS-11-1.md`; this file describes the result. The API contract is `openapi.yaml` (3.0.0) and the database is `schema.prisma`.

Every rule carries a tag:

- **[code]**: the API does this today (mock and Prisma).
- **[spec]**: `openapi.yaml` promises it, but the API does not do it yet.
- **[schema]**: a column or table exists, but no code reads or writes it.
- **[decided]**: a decision in `DECISIONS-11-1.md` that the code does not follow yet.
- **[open]**: not decided yet.

---

## 1. One table, three shapes

Everything is a row in `problem`. A set is not a separate entity: it is a problem with children.

| Shape | How you recognise it | Rules |
|---|---|---|
| **Standalone** | no `problem_part` row as a child, no children | Normal problem. |
| **Set parent** | at least one `problem_part` row with `parent_id` = this problem | Must have no `result` (`SET_PARENT_HAS_RESULT`). Cannot be put into another set. [code] |
| **Set child** | exactly one `problem_part` row with `child_id` = this problem | Belongs to one set only (`child_id` is unique). Cannot have children of its own (one level only). Cannot be deleted, published, dissolved or turned into a set directly (`IS_SET_CHILD`, `SET_CHILD_NOT_PUBLISHABLE`). [code] |

- `childCount` in the API is counted on read and never stored. Soft-deleted children are not counted. [code]
- Set children never appear on their own in `listProblems`; only standalone problems and set parents do. [code]
- When the last child is removed, the parent is a standalone problem again, because no flag says "set". [code]
- `problem_part.position` holds the order of the children (section 7).

## 2. Properties of a problem

| Column | Meaning | API field (who sees it) | Changed by |
|---|---|---|---|
| `id` | integer key | `id` as a Sqid (everyone) | — |
| `name`, `assignment`, `solution`, `result`, `difficulty`, `language_id` | the content | same names (everyone who can see it); `solution` not in the API yet | PATCH, take-over [spec] |
| `author_id` | owner; the only person who can edit | `author` (everyone) | never (a copy gets the copier as its author) |
| `publish_status` | lifecycle (section 5) | `status` (author only) | publish, set operations, dissolve |
| `lock_version` | concurrency token for editing (section 3) | `lockVersion` (author only, also on each child) | every applied edit of this row |
| `version` | content version that copy holders compare against (section 3) | `version` (author only) | applied PATCH with a content change; a child's content change and every set structure change also raise the set's version |
| `minor_version` | small edits that should not notify copy holders | not in the API | applied PATCH that changes only tags or chapters [code, D-15] |
| `original_problem_id` | the problem this one was copied from | `originalId` (author only) | copy |
| `original_problem_version` | the original's `version` at copy (or take-over) time | not exposed | copy; take-over [spec] |
| `dismissed_update_version` | the original's version the holder chose to ignore | not exposed | dismiss-update [spec] |
| `source_id` → `content_source` | origin type, citation, licence, display flags; 1:1, each copy gets its own row | `source` (everyone) | create, copy, publish (licence only), add to a published set (licence only) |
| `content_schema_version` | format version of the content | not exposed | nothing yet [schema] |
| `created_at`, `updated_at` | timestamps (`updated_at` via `@updatedAt`) | `createdAt`, `updatedAt` | any write to the row |
| `deleted_at` | soft delete; the row is invisible everywhere | — | delete, dissolve (the parent) |
| `problem_tag`, `problem_chapter` | tags and chapters, sorted by name with Czech collation | `tags`, `chapters` | create, PATCH (replaces the whole list), copy |

## 3. The three counters

Three numbers on one row, each answering a different question:

| Counter | Question it answers | Who uses it |
|---|---|---|
| `lock_version` | "Did someone save this row since I loaded it?" | the editor, to avoid overwriting another save |
| `version` | "Did the content change enough that copies should be offered the update?" | `updateAvailable` on copies |
| `minor_version` | "Did a small fix happen that copy holders don't need to see?" | nothing reads it yet |

### 3.1 `lock_version` (optimistic lock)

- Starts at 1. The client sends back the value it loaded; a mismatch → 409 `LOCK_MISMATCH` (412 for `DELETE …/children/{childId}`, where it goes in `If-Match: "4"`). [code]
- **PATCH** checks and raises it inside the UPDATE (`WHERE lock_version = ?`), so two concurrent saves cannot both win. [code, D-11]
- **The set operations** (add, reorder or remove a child) check the **set's** `lock_version` inside one atomic step that also raises it, raises the set's `version` and rewrites the positions (`restructureIfLockVersion`). Two concurrent structure changes cannot both pass: the loser gets 409 (412 on remove). A copy made for a losing `copyFromId` request is soft-deleted again. [code, D-11]
- A set and each of its children have **separate** locks. Editing a child's content uses the child's lock and never touches the set's lock. Changing the structure uses the set's lock and never touches the children's locks. So one person can edit a child while another reorders the set. [code]
- Not raised by: publish, moving a problem into a set or out of it, renumbering positions, dissolve. A client holding the child's old `lockVersion` can still save after the child was moved. [code]

### 3.2 `version` (content version)

- Starts at 1. **Only a content change raises it** (name, assignment, result, language, difficulty; `solution` once it is in the API), as an in-place increment. A tags- or chapters-only PATCH raises `minor_version` instead; a PATCH that changes nothing raises only `lock_version`. [code, D-15]
- **A content change of a set child raises the set's `version` by 1** (`incrementVersion(parentId)`, read after the write, so a child moved in the meantime still bumps the correct set). It does not change the set's `lock_version`. A tags-only child edit does not touch the set. [code, A-08, D-15]
- **Structure changes** (add, reorder or remove a child) **raise the set's `version`** together with its `lock_version`. [code, Q-004]
- A PATCH that goes to review (202) changes nothing, so `version` stays the same. [code]
- Publishing does not change `version`. [code]
- A copy starts at `version` 1 with its own history; `original_problem_version` remembers where it came from.

### 3.3 `minor_version`

- Starts at 0. A tags- or chapters-only PATCH raises it (in place). Nothing reads it yet. [code, D-15]
- A **trusted teacher or admin** can mark an edit as minor. It then raises `minor_version` instead of `version`, so copy holders get no update notice for a typo fix. The auto-approved revision carries `problem_revision.minor = true`. [decided D-16]
- Anyone else's content edit is always a full version: a "minor" flag from an unreviewed author could carry unwanted content past copy holders. [decided D-16]
- How the flag reaches the API (e.g. `minor: true` on PATCH) is not in the spec yet.

## 4. Copies and updates

### 4.1 What a copy is

`POST /problems/{id}/copy`, or `copyFromId` when adding a child to a set. Anyone who can see the original can copy it (their own problems, or published ones). [code]

| Copied | How |
|---|---|
| content (name, assignment, result, language, difficulty) | as is [code] |
| author | the caller [code] |
| status | always `PRIVATE`; a copy added into a set then takes the set's status [code] |
| `version`, `lock_version` | 1, 1 [code] |
| `original_problem_id`, `original_problem_version` | the original's id and its current `version` [code] |
| source | OWN → `LICENSED_USE` with `"Převzato od: <displayName>"`; LICENSED_USE and FREE_USE keep their type and citation; **copying your own OWN problem stays OWN with no citation** (O-4). The licence is always inherited. [code] |
| tags, chapters | only the global ones, unless the caller owns the original (then all of them) [code] |
| attachments | rows should point to the same stored images [spec; not built, Phase C] |
| children | copying a **set** copies every child (recursively, keeping positions); each child copy links to its own original child. Copying a **child** gives a standalone problem; the original set is not changed. [code] |

The original is never written to by a copy.

### 4.2 `updateAvailable` [spec, not in code]

- Computed on read and never stored (O-2). Shown only to the copy's author, and on a set only on the set, never on its children.
- `true` when `original.version > copy.original_problem_version` **and** `original.version` ≠ `copy.dismissed_update_version`.
- Because a child edit raises the set's `version`, someone who copied a whole set sees the update when any child of the original changes. Structure changes will also do this once Q-004 is implemented.
- Editing the copy itself never makes it `true`. A 202 edit of the original does not count either.
- `listProblems?scope=mine&updateAvailable=true` lists your copies with an update; with `limit=1`, `meta.total` is the badge count. Combined with `scope=public` → 400.
- `listProblems?ids=…` (batch read, max 100) is also spec-only.

### 4.3 Take over / dismiss [spec, not in code]

- **take-over-update** (needs the copy's `lockVersion`): replaces the copy's content with the original's current content and sets `original_problem_version` = original `version`. On a set, the children are replaced with fresh copies of the original's children. Tags, chapters and source stay unchanged. Any edits the holder made to the copy are overwritten. On a published copy owned by a non-trusted author → 202. A set child → 409 `IS_SET_CHILD`; nothing new → 409 `NO_UPDATE_AVAILABLE`.
- **dismiss-update**: sets `dismissed_update_version` = original `version`. The notice comes back when the original's version goes up again. Nothing else changes.

## 5. Status lifecycle

`PRIVATE → (REVIEWING) → PUBLISHED`; `WITHDRAWN` and `BLOCKED` exist in the enum, but no endpoint sets them yet. [schema]

### 5.1 Publish (`POST /problems/{id}/publish`)

- Only on a standalone problem or a set parent; a set child → 409 `SET_CHILD_NOT_PUBLISHABLE`. A set is published as one unit: the parent and every child get the same status. [code]
- Admin or trusted teacher → `PUBLISHED`; verified teacher → `REVIEWING`; registered teacher → 403 `TRUST_TOO_LOW`. [code]
- Licence: every row in the unit whose licence forbids publication → 409 `LICENSE_REQUIRED` (names the child). Rows without a licence need `licenseId` in the body, and only those rows get it. A licence, once set, is never changed. [code]
- Already `PUBLISHED`/`REVIEWING` → 200 and nothing changes. `BLOCKED` → 403. `WITHDRAWN` and `PRIVATE` can be published. [code]
- No counter changes. The rows are written one by one, not in one transaction. [code]
- Nothing reviews a `REVIEWING` problem yet: there is no approve/reject endpoint. [schema: `problem_revision`, `moderation_log`]

### 5.2 Editing published content (the 202 path)

> **Replaced by D-25** (working row and public copy), rewrite pending. Until D-25 is built the 202 path stays as described here (D-50). Read D-25–D-39 and D-46 in `DECISIONS-11-1.md` for the target model.

- A PATCH or set operation on a `PUBLISHED` problem, or on a child of a `PUBLISHED` set, by a non-trusted, non-admin author → **202 with the unchanged problem, and nothing is stored**. [code]
- Intended: store a `problem_revision` (status `REVIEWING`, content as JSON) and apply it on approval. Trusted and admin changes would write an `auto_approved` revision (O-5, D-07; two CHECK constraints already exist). [decided, schema]
- A `REVIEWING` problem is **not** on the 202 path: its author can still edit it directly (200). [code]
- **An applied edit to a `REVIEWING` problem sends it back to `PRIVATE`**; the author publishes again. There is no draft history, so there is no older version to keep under review. [decided D-17] On a set, editing any child sends the **whole set** back to PRIVATE [D-22], and the pending revision becomes **WITHDRAWN** (a new `revision_status`) [D-21].
- **Reorder and add on a published set** by a non-trusted author go to review (202 + pending revision); only pure removals skip review. [decided D-23]
- **Every PATCH of published content goes to review**, including one that only deletes text, because deleting words can change the meaning. [decided D-19]

### 5.3 History of published content

- `problem_revision` rows are the history of what was public and are never deleted. Publishing writes a revision with the content; every later change to published content writes one (pending → approved/rejected, or `auto_approved` for trusted/admin). Private drafts keep no history: an edit overwrites. [decided D-18, O-5, D-07]

### 5.4 Notifications

- Copy holders: only through `updateAvailable`, nothing stored (O-2). Worksheet owners whose worksheet uses a removed or changed problem: a stored `WORKSHEET_ITEM_REMOVED` notification. The author: moderation results. [decided D-20, direction only; the scope is open]

### 5.5 Visibility and ownership

- Others see a problem only when it is `PUBLISHED`; the author sees all of their own. [code]
- Author-only fields: `status`, `version`, `lockVersion`, `originalId` (and `updateAvailable` [spec]). [code]
- A non-author gets 404 on a private problem (its existence stays hidden) and 403 on a published one when trying to change it. [code]
- `content_source.citation_audience` (`TEACHER_ONLY`) only matters for anonymous share links (Phase C). [schema]

## 6. Operations that write to more than one row

This is the cross-problem effect table. "Set" means the parent of the row in the request.

> The rows that mention 202 or review describe today's code; under D-25 every one of these operations works on the working row (rewrite pending). 

| Operation | Row in the request | Other rows written |
|---|---|---|
| **PATCH child** (applied) | content, `lock_version +1`, `version +1` | **set: `version +1`** (not its lock) |
| **PATCH child** (202) | — | — |
| **addSetChild, move** (`problemId`) | — | the moved problem: gets `parent_id`, the set's status, and the set's licence if it had none and the set is published (lock and version unchanged); **all children renumbered**; **set: `lock_version +1`, `version +1`** [code, Q-004] |
| **addSetChild, copy** (`copyFromId`) | — | a new copy row (section 4.1), then the same as a move; the source problem is not touched |
| **reorderSetChild** | — | all children renumbered (only `position`, their `updated_at` stays); set: `lock_version +1`, `version +1` [code, Q-004] |
| **removeSetChild** | — | the child: `problem_part` row deleted, status → `PRIVATE` (even if the set was published); set: `lock_version +1`, `version +1` [code, Q-004] (so set copy holders can take over or keep their copy); the remaining children are renumbered. **Applied directly for every author, never 202**, because it brings no new content [decided D-19; today non-trusted authors get 202] |
| **dissolve** | set: soft-deleted | every child: `problem_part` deleted, status → `PRIVATE`, now standalone |
| **delete** | soft-deleted | **every child soft-deleted too**; `problem_part` rows stay |
| **copy** (set) | — | a new parent and one new row per child; the original is untouched |
| **publish** (set) | status (+ licence) | **every child**: the same status, and the licence if it had none |
| **take-over** (set) [spec] | content, `original_problem_version` | the old child copies are replaced by fresh copies of the original's children |

What is **never** written across rows: a copy never changes its original, an original never changes its copies (`updateAvailable` is computed on read), and a child's lock never changes because of the set.

## 7. Order of children

- `problem_part.position` is a string key `a0000`, `a0001`, … (base 36), unique per set. [code]
- Every structure change **renumbers all children** in the same transaction as the lock check (two passes through `~<id>` placeholders to avoid the unique constraint), removal included. [code]
- `afterId`: missing = at the end (add only), `null` = first, a child id = right after it. [code; DOMAIN-REVIEW]
- Later: real fractional indexing, i.e. insert between neighbours without renumbering. [Phase B TODO]

## 8. Deletion

- Soft delete only (`deleted_at`). Deleted rows are filtered out of every read. [code]
- A set child cannot be deleted directly (`IS_SET_CHILD`): remove it from the set first. [code]
- Deleting a **published** problem is allowed and has no review step. [code]
- Copies of a deleted problem keep `original_problem_id` in the DB for audit, and the copy stands alone: no update offers, and the holder sees a flag (computed on read) that the original is no longer available. The citation stays. [decided D-36, which changes D-24]
- Under D-25, pulling or deleting never removes the public copy: it gets the status `WITHDRAWN` and keeps its link to the working row, its version and its revisions, so copies keep their `original_problem_id` and see updates again after a re-publication. [decided D-46]

## 9. Worksheets (private, before D-25)

A worksheet is the author's ordered list of problems to print or hand out. Until D-25 is built it is private: only the author sees it (others get 404) and only the author edits it. [decided D-40]

| Topic | Rule |
|---|---|
| Columns in the API | `name`, `difficulty`, `language`, tags and chapters; `status`, `version` and `lockVersion` for the author. `license_id` and `citation_display` are not exposed yet. [decided D-40] |
| Items | `worksheet_problem` (`worksheet_id`, `problem_id`, `position`); a problem can be in a worksheet once. An item is a standalone problem or a set parent (with its children). [schema] |
| Adding | One `problemId`. Your own top-level problem goes in as a live reference: the same row, so later edits show up in the worksheet. Someone else's visible problem is copied first, and the copy (yours, PRIVATE) goes in. Your own set child → 409 `IS_SET_CHILD`; already in the worksheet → 409 `ALREADY_IN_WORKSHEET`. [decided D-41, D-27, D-32] |
| Removing | Only unlinks; the problem stays in your collection. [decided D-42] |
| Order | `position` keys like set children; `afterId`: missing = end, `null` = first, an item id = after it. [decided D-44] |
| Counters | `lock_version` (new column) is checked and raised atomically by PATCH and every item operation. `version` goes up on name, difficulty or language changes and on any item change, not on tags or chapters alone. [decided D-43] |
| Deleted problems | Skipped on read; `worksheet_problem` rows stay until D-39 is built. [decided D-45] |
| An own problem in several worksheets | Allowed: every worksheet references the same row. [decided D-32] |
