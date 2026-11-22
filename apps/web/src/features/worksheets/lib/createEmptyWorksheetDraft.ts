import type { WorksheetDraft } from '../types'

export function createEmptyWorksheetDraft(): WorksheetDraft {
  return {
    id: null,
    lockVersion: null,
    name: '',
    problems: [],
  }
}
