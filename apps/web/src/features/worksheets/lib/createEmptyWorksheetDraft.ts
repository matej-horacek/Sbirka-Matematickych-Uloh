import type { WorksheetDraft } from '../types'
import { DEFAULT_LAYOUT } from './worksheetOptions'

export function createEmptyWorksheetDraft(): WorksheetDraft {
  return {
    id: null,
    lockVersion: null,
    name: '',
    difficulty: null,
    chapters: [],
    tags: [],
    isPublic: false,
    layout: { ...DEFAULT_LAYOUT },
    problems: [],
  }
}
