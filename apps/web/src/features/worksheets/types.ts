import type {
  ChapterRef,
  PageMeta,
  ProblemDetail,
  ProblemEditorDraft,
  ProblemStatus,
  Sqid,
  TagRef,
  UserRef,
} from '@/features/editor/types'

// -----------------------------------------------------------------------------
// Worksheet API contract (openapi.yaml 3.0.0, tag "Worksheets")
// -----------------------------------------------------------------------------

/** WorksheetListItem: GET /worksheets returns only the caller's own worksheets. */
export interface WorksheetListItem {
  id: Sqid
  name: string
  language?: string | null
  difficulty?: number | null
  author: UserRef
  tags: TagRef[]
  chapters: ChapterRef[]
  /** 0 = empty worksheet. */
  itemCount: number
}

/** WorksheetItem: the problem itself; its id is also the item id in /items/{itemId}. */
export interface WorksheetItem {
  kind: 'PROBLEM'
  problem: ProblemDetail
}

export interface WorksheetDetail extends WorksheetListItem {
  status: ProblemStatus
  createdAt?: string
  updatedAt?: string
  version?: number
  /** Sent back with PATCH and with every /items call (If-Match for DELETE). */
  lockVersion?: number
  /** In worksheet order, deleted problems are left out. */
  items: WorksheetItem[]
}

export interface WorksheetPage {
  items: WorksheetListItem[]
  meta: PageMeta
}

export interface ListWorksheetsParams {
  page?: number
  limit?: number
  tagId?: Sqid[]
  chapterId?: Sqid[]
  language?: string
}

/** Creates an EMPTY worksheet: problems are added through /items afterwards. */
export interface WorksheetCreate {
  name: string
  language?: string | null
  difficulty?: number | null
  tagIds?: Sqid[]
  chapterIds?: Sqid[]
}

/** Missing field = unchanged. */
export interface WorksheetPatch extends Partial<WorksheetCreate> {
  lockVersion: number
}

export interface AddItemRequest {
  lockVersion: number
  problemId: Sqid
  /** Missing = at the end, null = first, an item id = right after it. */
  afterId?: Sqid | null
}

export interface ReorderItemRequest {
  lockVersion: number
  /** Required: null = first, an item id = right after it. */
  afterId: Sqid | null
}

// -----------------------------------------------------------------------------
// Editor working copy
// -----------------------------------------------------------------------------

export interface WorksheetDraft {
  id: Sqid | null
  lockVersion: number | null
  name: string
  /** The picked problems, in worksheet order. */
  problems: ProblemEditorDraft[]
}
