
import { defineStore } from 'pinia'
import type { Block, WorksheetProblemDraft } from '../types'

export const useEditorStore = defineStore('editor', {
  state: () => ({
    problem: null as WorksheetProblemDraft | null,
    isSaved: true,
  }),

  getters: {
    errors(state): string[] {
      const draft = state.problem
      if (!draft) return []

      const errors: string[] = []

      if (draft.assignment.length === 0) {
        errors.push('Zadání musí mít alespoň jeden blok.')
      }

      for (const block of draft.assignment) {
        if (block.type === 'text' && !block.markdown.trim()) {
          errors.push('Textový blok nesmí být prázdný.')
        }

        if (block.type === 'math' && !block.latex.trim()) {
          errors.push('Matematický výraz nesmí být prázdný.')
        }

        if (block.type === 'image' && block.assetId <= 0) {
          errors.push('Vyberte obrázek.')
        }

        if (
          block.type === 'geogebra' &&
          (block.assetId <= 0 || block.previewAssetId <= 0)
        ) {
          errors.push('GeoGebra blok nemá platný obsah nebo náhled.')
        }
      }

      return errors
    },
  },

  actions: {
    newProblem() {
      this.problem = {
        assignment: [
          {
            id: crypto.randomUUID(),
            type: 'text',
            markdown: '',
          },
        ],
      }

      this.isSaved = true
    },

    loadProblem(problem: WorksheetProblemDraft) {
      this.problem = structuredClone(problem)
      this.isSaved = true
    },

    addBlock(block: Block) {
      if (!this.problem) return

      this.problem.assignment.push(block)
      this.isSaved = false
    },

    updateBlock(id: string, patch: Partial<Block>) {
      if (!this.problem) return

      const index = this.problem.assignment.findIndex(
        (block) => block.id === id,
      )

      if (index === -1) return

      this.problem.assignment[index] = {
        ...this.problem.assignment[index]!,
        ...patch,
      } as Block

      this.isSaved = false
    },

    removeBlock(id: string) {
      if (!this.problem) return

      if (this.problem.assignment.length <= 1) return

      this.problem.assignment = this.problem.assignment.filter(
        (block) => block.id !== id,
      )

      this.isSaved = false
    },

    moveBlock(id: string, direction: -1 | 1) {
      if (!this.problem) return

      const blocks = this.problem.assignment
      const index = blocks.findIndex((block) => block.id === id)
      const target = index + direction

      if (index === -1 || target < 0 || target >= blocks.length) return

      const [block] = blocks.splice(index, 1)
      if (block) blocks.splice(target, 0, block)

      this.isSaved = false
    },

    markSaved() {
      this.isSaved = true
    },
  },
})