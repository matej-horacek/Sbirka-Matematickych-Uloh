// Content schema
export const CONTENT_SCHEMA_VERSION = 1

// Block types
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

export type Block =
  | TextBlock
  | MathBlock
  | ImageBlock
  | GeoGebraBlock

// Content source and licensing
export type ContentOrigin =
  | 'OWN'
  | 'LICENSED_USE'
  | 'FREE_USE'

export type CitationAudience =
  | 'PUBLIC'
  | 'TEACHER_ONLY'

export interface ContentSource {
  originType: ContentOrigin
  sourceCitationText: string | null
  licenseId: number | null
  licenseNote: string | null
  citationAudience: CitationAudience
  showInWeb: boolean
  showInPdf: boolean
}

// One problem, whether new or already in the database
export interface ProblemDraft {
  id: number | null
  lockVersion: number | null
  name: string
  assignment: Block[]
  solution: Block[] | null
  difficulty: number | null
  languageId: number
  answerSpace: string | null
  chapterIds: number[]
  tagIds: number[]
  source: ContentSource
}

// API payload for saving a problem
export type SaveProblemPayload = ProblemDraft & {
  contentSchemaVersion: number
}

// Worksheet preview types
export type EditorTab = 'assignment' | 'solution'

export type WorksheetId = number | string

// One problem being edited in the worksheet editor.
export interface WorksheetProblemDraft {
  assignment: Block[]
}

// A saved problem in the worksheet collection.
export interface WorksheetProblem extends WorksheetProblemDraft {
  localId: string
}

// The worksheet owns the metadata and the problem list.
export interface WorksheetDraft {
  id: WorksheetId
  name: string
  difficulty: number | null
  problems: WorksheetProblem[]
}