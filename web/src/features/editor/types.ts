//verze 1
export const CONTENT_SCHEMA_VERSION = 1


export type BlockId = string

export interface TextBlock {
  id: BlockId
  type: 'text'
  markdown: string 
}

export interface MathBlock {
  id: BlockId
  type: 'math'
  latex: string 
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

export type ContentOrigin = 'OWN' | 'LICENSED_USE' | 'FREE_USE'
export type CitationAudience = 'PUBLIC' | 'TEACHER_ONLY'


export interface ContentSource {
  originType: ContentOrigin
  sourceCitationText: string | null
  licenseId: number | null
  licenseNote: string | null
  citationAudience: CitationAudience
  showInWeb: boolean
  showInPdf: boolean
}

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


export type SaveProblemPayload = ProblemDraft & {
  contentSchemaVersion: number
}