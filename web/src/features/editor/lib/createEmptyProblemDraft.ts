import type { ProblemEditorDraft } from '../types'

export function createEmptyProblemDraft(): ProblemEditorDraft {
  return {
    id: null,
    lockVersion: null,

    name: '',

    assignment: [],
    solution: null,

    difficulty: null,
    language: 'cs',

    chapterIds: [],
    tagIds: [],
  }
}