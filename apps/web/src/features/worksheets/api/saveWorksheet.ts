import type { Sqid } from '@/features/editor/types'
import type { WorksheetDetail, WorksheetDraft } from '../types'
import { worksheetsApi } from './worksheetsApi'

function requireLock(worksheet: WorksheetDetail): number {
  if (worksheet.lockVersion === undefined) {
    throw new Error('Chybí lockVersion. Načtěte list znovu před uložením.')
  }
  return worksheet.lockVersion
}

/**
 * Saves a worksheet together with its problems.
 *
 * The API has no "save everything" call: a worksheet is created empty, and its
 * problems are attached, moved and removed one by one through /items. Every
 * call returns the whole worksheet with a NEW lockVersion that the next call
 * needs, so the calls run one after another:
 *
 *   1. create (POST) or update the name (PATCH); the response lists the items
 *      the server has right now, which is what the rest is compared with
 *   2. remove the items the user took out (DELETE, lockVersion in If-Match)
 *   3. walk the wanted order: an item that is not at its position is moved
 *      right behind its predecessor (PATCH) when it is already in the
 *      worksheet, or added there (POST) when it is not
 *
 * `draft` is updated IN PLACE with the id and lockVersion the backend hands
 * out. If a step fails half way, the same save can simply be repeated: what
 * already exists is not created again.
 */
export async function saveWorksheet(draft: WorksheetDraft): Promise<WorksheetDetail> {
  const track = (worksheet: WorksheetDetail): WorksheetDetail => {
    draft.id = worksheet.id
    draft.lockVersion = worksheet.lockVersion ?? null
    return worksheet
  }

  // 1. The worksheet itself.
  let worksheet = track(
    draft.id === null
      ? await worksheetsApi.create(draft)
      : await worksheetsApi.update(draft.id, draft),
  )

  const wanted: Sqid[] = draft.problems.flatMap((problem) => (problem.id ? [problem.id] : []))
  const wantedIds = new Set(wanted)

  // 2. Problems the user removed.
  for (const item of worksheet.items) {
    if (wantedIds.has(item.problem.id)) continue

    worksheet = track(
      await worksheetsApi.removeItem(worksheet.id, item.problem.id, requireLock(worksheet)),
    )
  }

  // 3. New problems and the order. Everything before `position` is already right.
  for (const [position, id] of wanted.entries()) {
    if (worksheet.items[position]?.problem.id === id) continue

    const afterId = position === 0 ? null : (wanted[position - 1] ?? null)
    const alreadyIn = worksheet.items.some((item) => item.problem.id === id)

    worksheet = track(
      alreadyIn
        ? await worksheetsApi.reorderItem(worksheet.id, id, {
            lockVersion: requireLock(worksheet),
            afterId,
          })
        : await worksheetsApi.addItem(worksheet.id, {
            lockVersion: requireLock(worksheet),
            problemId: id,
            afterId,
          }),
    )
  }

  return worksheet
}
