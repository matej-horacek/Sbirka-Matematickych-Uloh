import { defineStore } from 'pinia'
import {
  CONTENT_SCHEMA_VERSION,
  type Block,
  type ProblemDraft,
  type SaveProblemPayload,
} from '../types'

export type Section = 'assignment' | 'solution'

function locate(problem: ProblemDraft, id: string) {
  for (const section of ['assignment', 'solution'] as const) {
    const list = problem[section]
    if (!list) continue
    const index = list.findIndex((b) => b.id === id)
    if (index !== -1) return { section, list, index }
  }
  return null
}

export const useEditorStore = defineStore('editor', {
  state: () => ({
    problem: null as ProblemDraft | null,
    isSaved: true,
  }),

  getters: {
    payload(state): SaveProblemPayload | null {
      const p = state.problem
      if (!p) return null
      return {
        ...p,
        solution: p.solution?.length ? p.solution : null,
        contentSchemaVersion: CONTENT_SCHEMA_VERSION,
      }
    },
    errors(state): string[] {
      const p = state.problem
      if (!p) return []
      const errors: string[] = []
      if (!p.name.trim()) errors.push('Název úlohy je povinný.')
      if (p.name.length > 255) errors.push('Název může mít nejvýše 255 znaků.')
      if (p.assignment.length === 0) errors.push('Zadání musí mít alespoň jeden blok.')
      if (
        p.difficulty !== null &&
        (!Number.isInteger(p.difficulty) || p.difficulty < 1 || p.difficulty > 10)
      ) {
        errors.push('Obtížnost musí být celé číslo od 1 do 10.')
      }
      return errors
    },
  },

  actions: {
    newProblem() {
      this.problem = {
        id: null,
        lockVersion: null,
        name: '',
        assignment: [{ id: crypto.randomUUID(), type: 'text', markdown: '' }],
        solution: null,
        difficulty: null,
        languageId: 1, // dodelat user language
        answerSpace: null,
        chapterIds: [],
        tagIds: [],
        source: {
          originType: 'OWN',
          sourceCitationText: null,
          licenseId: null,
          licenseNote: null,
          citationAudience: 'PUBLIC',
          showInWeb: true,
          showInPdf: true,
        },
      }
      this.isSaved = true
    },

    loadProblem(problem: ProblemDraft) {
      this.problem = problem
      this.isSaved = true
    },

    updateMeta(patch: Partial<Omit<ProblemDraft, 'id' | 'lockVersion' | 'assignment' | 'solution'>>) {
      if (!this.problem) return
      Object.assign(this.problem, patch)
      this.isSaved = false
    },

    addBlock(block: Block, section: Section = 'assignment') {
      if (!this.problem) return
      if (!this.problem[section]) this.problem[section] = []
      this.problem[section]!.push(block)
      this.isSaved = false
    },

    updateBlock(id: string, patch: Partial<Block>) {
      if (!this.problem) return
      const found = locate(this.problem, id)
      if (!found) return
      found.list[found.index] = { ...found.list[found.index], ...patch } as Block
      this.isSaved = false
    },

    removeBlock(id: string) {
      if (!this.problem) return
      const found = locate(this.problem, id)
      if (!found) return
      const { section, list, index } = found
      // the assignment must keep at least one block
      if (section === 'assignment' && list.length === 1) return
      list.splice(index, 1)
      if (section === 'solution' && list.length === 0) this.problem.solution = null
      this.isSaved = false
    },

    moveBlock(id: string, direction: -1 | 1) {
      if (!this.problem) return
      const found = locate(this.problem, id)
      if (!found) return
      const target = found.index + direction
      if (target < 0 || target >= found.list.length) return
      const [block] = found.list.splice(found.index, 1)
      found.list.splice(target, 0, block!)
      this.isSaved = false
    },

    markSaved() {
      this.isSaved = true
    },
  },
})