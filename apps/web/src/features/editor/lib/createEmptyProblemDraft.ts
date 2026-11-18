import type { ProblemEditorDraft, SubproblemDraft } from '../types'

export function createEmptyProblemDraft(): ProblemEditorDraft {
  return {
    id: null,
    lockVersion: null,

    name: '',

    assignment: [],
    solution: null,

    difficulty: null,
    language: 'cs',

    chapters: [],
    tags: [],

    subproblems: [],
  }
}

/**
 * A new subproblem starts with one empty text block. Tags and chapters are
 * always taken from the main problem (see saveProblemSet); language and
 * difficulty are copied from it when the subproblem is created.
 */
export function createEmptySubproblemDraft(): SubproblemDraft {
  return {
    key: crypto.randomUUID(),
    id: null,
    lockVersion: null,
    name: '',
    assignment: [{ id: crypto.randomUUID(), type: 'text', markdown: '' }],
    solution: null,
    difficulty: null,
    language: null,
    chapters: [],
    tags: [],
  }
}
