import { ApiError, http } from '../../../../shared/api/http'
import { toEditorDraft } from '@/features/editor/api/problemsApi'
import type { Sqid } from '@/features/editor/types'
import type {
  AddItemRequest,
  ListWorksheetsParams,
  ReorderItemRequest,
  WorksheetCreate,
  WorksheetDetail,
  WorksheetDraft,
  WorksheetPage,
  WorksheetPatch,
} from '../types'

function worksheetPath(id: Sqid): string {
  return `/worksheets/${encodeURIComponent(id)}`
}

function itemPath(id: Sqid, itemId: Sqid): string {
  return `${worksheetPath(id)}/items/${encodeURIComponent(itemId)}`
}

function toListQuery(params: ListWorksheetsParams): string {
  const query = new URLSearchParams()

  if (params.page !== undefined) query.set('page', String(params.page))
  if (params.limit !== undefined) query.set('limit', String(params.limit))
  if (params.language) query.set('language', params.language)
  params.tagId?.forEach((id) => query.append('tagId', id))
  params.chapterId?.forEach((id) => query.append('chapterId', id))

  return query.toString()
}

// Only the name is edited for now. Tags, chapters, language and difficulty are
// left out of PATCH, which the API reads as "unchanged".
function toCreatePayload(draft: WorksheetDraft): WorksheetCreate {
  return { name: draft.name.trim() }
}

function toPatchPayload(draft: WorksheetDraft): WorksheetPatch {
  if (draft.lockVersion === null) {
    throw new Error('Chybí lockVersion. Načtěte list znovu před uložením.')
  }

  return { ...toCreatePayload(draft), lockVersion: draft.lockVersion }
}

/** LOCK_MISMATCH comes as 409 (body) or 412 (If-Match): the same message for both. */
async function withLockMessage<T>(request: Promise<T>): Promise<T> {
  try {
    return await request
  } catch (error) {
    if (error instanceof ApiError && error.code === 'LOCK_MISMATCH') {
      throw new ApiError(
        error.status,
        'List mezitím někdo změnil. Načtěte stránku znovu a zkuste to znovu.',
        error.body,
      )
    }

    throw error
  }
}

/** The backend's worksheet -> the editor's working copy. */
export function toWorksheetDraft(detail: WorksheetDetail): WorksheetDraft {
  return {
    id: detail.id,
    lockVersion: detail.lockVersion ?? null,
    name: detail.name,
    problems: detail.items.map((item) => toEditorDraft(item.problem)),
  }
}

export const worksheetsApi = {
  /** GET /worksheets -> the caller's own worksheets (paginated). */
  list(params: ListWorksheetsParams = {}): Promise<WorksheetPage> {
    const query = toListQuery(params)
    return http<WorksheetPage>(query ? `/worksheets?${query}` : '/worksheets')
  },

  /** GET /worksheets/:id -> one worksheet with its items. */
  get(id: Sqid): Promise<WorksheetDetail> {
    return http<WorksheetDetail>(worksheetPath(id))
  },

  /** POST /worksheets -> 201 + a new, empty worksheet. */
  create(draft: WorksheetDraft): Promise<WorksheetDetail> {
    return http<WorksheetDetail>('/worksheets', {
      method: 'POST',
      body: toCreatePayload(draft),
    })
  },

  /** PATCH /worksheets/:id -> the updated worksheet (also with its items). */
  update(id: Sqid, draft: WorksheetDraft): Promise<WorksheetDetail> {
    return withLockMessage(
      http<WorksheetDetail>(worksheetPath(id), {
        method: 'PATCH',
        body: toPatchPayload(draft),
      }),
    )
  },

  /** DELETE /worksheets/:id -> 204 (soft delete; the problems are kept). */
  remove(id: Sqid): Promise<void> {
    return http<void>(worksheetPath(id), { method: 'DELETE' })
  },

  /** POST /worksheets/:id/items -> the whole worksheet. */
  addItem(id: Sqid, payload: AddItemRequest): Promise<WorksheetDetail> {
    return withLockMessage(
      http<WorksheetDetail>(`${worksheetPath(id)}/items`, {
        method: 'POST',
        body: payload,
      }),
    )
  },

  /** PATCH /worksheets/:id/items/:itemId -> move an item. Returns the whole worksheet. */
  reorderItem(id: Sqid, itemId: Sqid, payload: ReorderItemRequest): Promise<WorksheetDetail> {
    return withLockMessage(
      http<WorksheetDetail>(itemPath(id, itemId), {
        method: 'PATCH',
        body: payload,
      }),
    )
  },

  /** DELETE /worksheets/:id/items/:itemId -> unlink an item (lockVersion in If-Match). */
  removeItem(id: Sqid, itemId: Sqid, lockVersion: number): Promise<WorksheetDetail> {
    return withLockMessage(
      http<WorksheetDetail>(itemPath(id, itemId), {
        method: 'DELETE',
        headers: { 'If-Match': `"${lockVersion}"` },
      }),
    )
  },
}
