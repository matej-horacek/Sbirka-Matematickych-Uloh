import { blocksToMarkdown } from '../lib/blocksToMarkdown'
import { subproblemName } from '../lib/subproblemLabel'
import type { ProblemDetail, ProblemDraft, Sqid, SubproblemDraft } from '../types'
import { problemsApi } from './problemsApi'

/** The draft of one subproblem as a standalone problem, ready for create/update. */
function subproblemAsProblem(
  main: ProblemDraft,
  sub: SubproblemDraft,
  index: number,
): ProblemDraft {
  const isNew = sub.id === null

  return {
    id: sub.id,
    lockVersion: sub.lockVersion,
    name: subproblemName(main.name, index),
    assignment: sub.assignment,
    solution: sub.solution,
    // Tags and chapters are inherited: a subproblem always has exactly the
    // main problem's. Language and difficulty are only copied when the
    // subproblem is created; an existing one keeps its own.
    difficulty: isNew ? main.difficulty : sub.difficulty,
    language: isNew ? main.language : sub.language,
    chapters: main.chapters.map((chapter) => ({ ...chapter })),
    tags: main.tags.map((tag) => ({ ...tag })),
    subproblems: [],
  }
}

/**
 * The API contract (2.0.0+) lets a set child be edited directly with
 * PATCH /problems/{childId}. A backend that still implements the older rule
 * answers 409 "Edit a set child through its parent." instead.
 */
function isSetChildEditRejected(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false

  const { status, code, message } = error as {
    status?: number
    code?: string
    message?: string
  }

  return (
    status === 409 &&
    (code === 'SET_CHILD_EDIT_VIA_PARENT' ||
      code === 'IS_SET_CHILD' ||
      /through its parent/i.test(message ?? ''))
  )
}

/**
 * Remembered after the first rejection, so that later saves do not send a
 * request that is known to fail (and add a red 409 to the console each time).
 * A page reload starts optimistic again, in case the backend has been fixed.
 */
let directChildEditSupported = true

/** Same ids, regardless of order. */
function sameIds(a: { id: Sqid }[], b: { id: Sqid }[]): boolean {
  if (a.length !== b.length) return false

  const ids = new Set(a.map((item) => item.id))
  return b.every((item) => ids.has(item.id))
}

function requireLock(set: ProblemDetail): number {
  if (set.lockVersion === undefined) {
    throw new Error('Chybí lockVersion. Načtěte příklad znovu před uložením.')
  }
  return set.lockVersion
}

/**
 * Saves a main problem together with its subproblems.
 *
 * Every subproblem is a problem of its own on the backend and is linked to the
 * main problem with the /children endpoints:
 *
 *   1. create/update the main problem (a set parent never has a result)
 *   2. take removed subproblems out of the set and delete them
 *   3. create new subproblems (POST /problems) and add them to the set
 *   4. update subproblems whose content, name, tags or chapters changed
 *      (they always get the main problem's tags and chapters; own lockVersion;
 *      falls back to take out -> edit -> add back on a backend that refuses
 *      to edit a set child directly)
 *   5. put the children into the order of the editor
 *
 * The calls run one after another, because every structure change returns the
 * set with a new lockVersion that the next call needs.
 *
 * `draft` is updated IN PLACE with the ids and lockVersions the backend hands
 * out. If a step fails half way, the caller can copy these back into the
 * editor (see editorStore.applySavedIds) and the same save can be repeated:
 * what already exists is not created again.
 */
export async function saveProblemSet(draft: ProblemDraft): Promise<ProblemDetail> {
  const subs = draft.subproblems

  const track = (set: ProblemDetail): ProblemDetail => {
    draft.id = set.id
    draft.lockVersion = set.lockVersion ?? null
    return set
  }

  // 1. The main problem.
  let set = track(
    draft.id == null
      ? await problemsApi.create(draft)
      : await problemsApi.update(draft.id, draft),
  )

  // A plain problem that was and stays plain: nothing more to do.
  if (subs.length === 0 && set.children.length === 0) return set

  const wantedIds = new Set<Sqid>()
  for (const sub of subs) if (sub.id !== null) wantedIds.add(sub.id)

  // 2. Subproblems the user removed: out of the set, then deleted.
  for (const child of set.children) {
    if (wantedIds.has(child.id)) continue
    set = track(await problemsApi.removeChild(set.id, child.id, requireLock(set)))
    await problemsApi.remove(child.id)
  }

  // 3. New subproblems (and ones created by an earlier, interrupted save).
  const attached = new Set(set.children.map((child) => child.id))

  for (const [index, sub] of subs.entries()) {
    let id = sub.id

    if (id === null) {
      const created = await problemsApi.create(subproblemAsProblem(draft, sub, index))
      id = created.id
      sub.id = created.id
      sub.lockVersion = created.lockVersion ?? null
    }

    if (!attached.has(id)) {
      // No afterId = at the end; the final order is fixed in step 5.
      set = track(
        await problemsApi.addChild(set.id, {
          lockVersion: requireLock(set),
          problemId: id,
        }),
      )
      attached.add(id)
    }
  }

  // 4. Changed subproblems. Compared with what the set returned, so unchanged
  //    ones cost no request. A child's own lockVersion catches foreign edits.
  const serverChildren = new Map(set.children.map((child) => [child.id, child]))

  for (const [index, sub] of subs.entries()) {
    if (sub.id === null) continue

    const payload = subproblemAsProblem(draft, sub, index)
    const assignment = blocksToMarkdown(payload.assignment)
    const result = payload.solution?.length
      ? blocksToMarkdown(payload.solution) || null
      : null
    const server = serverChildren.get(sub.id)

    if (
      server &&
      server.name === payload.name &&
      server.assignment === assignment &&
      (server.result ?? null) === result &&
      sameIds(server.tags, payload.tags) &&
      sameIds(server.chapters, payload.chapters)
    ) {
      continue
    }

    const id = sub.id
    let updated: ProblemDetail | null = null

    if (directChildEditSupported) {
      try {
        updated = await problemsApi.update(id, payload)
      } catch (error) {
        if (!isSetChildEditRejected(error)) throw error

        directChildEditSupported = false
        console.warn(
          'The backend refused to edit a set child directly (the API contract allows it). ' +
            'Using take out -> edit -> add back instead.',
        )
      }
    }

    if (updated === null) {
      // Fallback for a backend that refuses PATCH on a set child:
      // take the child out of the set, edit it as a standalone problem and
      // put it back (at the end; step 5 restores the order). If this is
      // interrupted, the child is simply not attached any more and a retry
      // of the save attaches it again (step 3).
      set = track(await problemsApi.removeChild(set.id, id, requireLock(set)))

      const standalone = await problemsApi.get(id)
      updated = await problemsApi.update(id, {
        ...payload,
        lockVersion: standalone.lockVersion ?? null,
      })

      set = track(
        await problemsApi.addChild(set.id, {
          lockVersion: requireLock(set),
          problemId: id,
        }),
      )
    }

    sub.lockVersion = updated.lockVersion ?? null
  }

  // 5. Order: walk the wanted order and move each child right behind its
  //    predecessor whenever it is not already at its position.
  const wantedOrder = subs.map((sub) => sub.id as Sqid)

  for (const [position, id] of wantedOrder.entries()) {
    if (set.children[position]?.id === id) continue

    set = track(
      await problemsApi.reorderChild(set.id, id, {
        lockVersion: requireLock(set),
        afterId: position === 0 ? null : (wantedOrder[position - 1] ?? null),
      }),
    )
  }

  // Child edits changed the set's version and content: read the final state.
  return problemsApi.get(set.id)
}
