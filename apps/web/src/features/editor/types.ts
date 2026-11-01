// -----------------------------------------------------------------------------
// Editor-only content model
// -----------------------------------------------------------------------------
// These blocks are used by the Vue editor. They are NOT the backend wire format:
// the API stores `assignment` and `result` as Markdown/LaTeX strings.

export type BlockId = string
export type MathInputMode = 'mathlive' | 'katex'

export interface TextBlock {
  id: BlockId
  type: 'text'
  markdown: string
}

export interface MathBlock {
  id: BlockId
  type: 'math'
  latex: string
  /** UI preference only; it is not sent to the backend. */
  inputMode?: MathInputMode
}

export interface ImageBlock {
  id: BlockId
  type: 'image'
  assetId: number
  alt?: string
}

export interface GeoGebraBlock {
  id: BlockId
  type: 'geogebra'
  assetId: number
  previewAssetId: number
}

export type Block = TextBlock | MathBlock | ImageBlock | GeoGebraBlock

// The editor's working copy. `problemsApi` serializes block arrays into the
// backend's string fields before sending them.
export interface ProblemEditorDraft {
  id: Sqid | null
  lockVersion: number | null
  name: string
  assignment: Block[]
  solution: Block[] | null
  difficulty: number | null
  /** ISO language code, e.g. "cs". The backend does not use a numeric languageId. */
  language: string | null
  chapterIds: Sqid[]
  tagIds: Sqid[]
}

/** Backwards-compatible name for the editor working copy. */
export type ProblemDraft = ProblemEditorDraft

export type EditorTab = 'assignment' | 'solution'

// -----------------------------------------------------------------------------
// Backend API contract (api-backend-clean/openapi.yaml)
// -----------------------------------------------------------------------------

/** Encoded backend ID (Sqid). IDs are opaque strings, never numbers. */
export type Sqid = string

export type ProblemScope = 'mine' | 'public'
export type ProblemStatus = 'PRIVATE' | 'REVIEWING' | 'PUBLISHED' | 'WITHDRAWN' | 'BLOCKED'
export type ContentOrigin = 'OWN' | 'LICENSED_USE' | 'FREE_USE'
export type RefScope = 'global' | 'personal'

export interface UserRef {
  id: Sqid
  displayName: string
}

export interface TagRef {
  id: Sqid
  name: string
  scope: RefScope
}

export interface ChapterRef {
  id: Sqid
  name: string
  scope: RefScope
}

export interface ChapterNode extends ChapterRef {
  parentId: Sqid | null
}

export interface LicenseRef {
  id: Sqid
  name: string
  url?: string | null
}

export interface License extends LicenseRef {
  description?: string | null
  requiresAttribution: boolean
  allowsModification: boolean
  requiresShareAlike: boolean
}

export interface SourceRef {
  type: ContentOrigin
  license: LicenseRef | null
  /** May be omitted for viewers outside the citation audience. */
  citation?: string | null
  licenseNote: string | null
  showInWeb: boolean
  showInPdf: boolean
}

/** Fields accepted by create/patch requests, except for patch concurrency data. */
export interface ProblemBase {
  name?: string
  assignment?: string
  result?: string | null
  language?: string | null
  difficulty?: number | null
}

export interface ProblemCreate {
  name: string
  assignment: string
  result?: string | null
  language?: string | null
  difficulty?: number | null
  tagIds?: Sqid[]
  chapterIds?: Sqid[]
}

export interface ProblemPatch extends ProblemBase {
  /** Required optimistic-concurrency version returned by the backend. */
  lockVersion: number
  /** Missing means unchanged; sending an array replaces the complete list. */
  tagIds?: Sqid[]
  chapterIds?: Sqid[]
}

/** Fields present in list responses and shared by problem details and set children. */
export interface ProblemListItem {
  id: Sqid
  name: string
  assignment: string
  result?: string | null
  language?: string | null
  difficulty?: number | null
  author: UserRef
  tags: TagRef[]
  chapters: ChapterRef[]
  /** 0 = standalone problem; greater than 0 = set parent. */
  childCount: number
  /** Present only for the author of a copy when a newer original exists. */
  updateAvailable?: boolean
}

export interface ProblemDetailCore extends ProblemListItem {
  createdAt?: string
  updatedAt?: string
  source: SourceRef
  /** Present only for the author. */
  lockVersion?: number
}

export interface ProblemDetail extends ProblemDetailCore {
  /** Present only for the author. */
  status?: ProblemStatus
  /** Present only for the author. */
  version?: number
  parentId: Sqid | null
  children: ProblemDetailCore[]
  /** Present only for the author. */
  originalId?: Sqid | null
}

export interface PageMeta {
  page: number
  limit: number
  total: number
}

export interface ProblemPage {
  items: ProblemListItem[]
  meta: PageMeta
}

export interface ProblemList {
  items: ProblemListItem[]
}

export interface ListProblemsParams {
  scope: ProblemScope
  page?: number
  limit?: number
  tagId?: Sqid[]
  chapterId?: Sqid[]
  language?: string
}

/** Exactly one of `problemId` (move) and `copyFromId` (copy) must be supplied. */
export type AddChildRequest = {
  lockVersion: number
  afterId?: Sqid | null
} & (
  | { problemId: Sqid; copyFromId?: never }
  | { copyFromId: Sqid; problemId?: never }
)

export interface ReorderChildRequest {
  lockVersion: number
  afterId: Sqid | null
}

export interface PublishRequest {
  /** Required only when the problem does not already have a publishable licence. */
  licenseId?: Sqid
}

export interface TagPage {
  items: TagRef[]
  meta: PageMeta
}

export interface ChapterList {
  items: ChapterNode[]
}

export interface LicenseList {
  items: License[]
}

export type ApiErrorCode =
  | 'VALIDATION_FAILED'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'TRUST_TOO_LOW'
  | 'NOT_FOUND'
  | 'LOCK_MISMATCH'
  | 'SET_PARENT_HAS_RESULT'
  | 'LICENSE_REQUIRED'
  | 'NOT_A_SET'
  | 'SET_CHILD_NOT_PUBLISHABLE'
  | 'IS_SET_CHILD'
  | 'CANNOT_ADD_TO_SET'
  | 'NO_UPDATE_AVAILABLE'

/** RFC 9457 application/problem+json response used by the backend. */
export interface ApiProblemDetails {
  type: string
  title: string
  status: number
  detail?: string
  code?: ApiErrorCode | string
  requestId?: string
}