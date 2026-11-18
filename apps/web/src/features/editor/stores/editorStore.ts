import { defineStore } from 'pinia'
import { cloneDraft } from '../lib/cloneDraft'
import { createEmptySubproblemDraft } from '../lib/createEmptyProblemDraft'
import { subproblemLabel } from '../lib/subproblemLabel'
import type { Block, ChapterRef, ProblemDraft, TagRef } from '../types'

function validateBlocks(blocks: Block[], prefix = ''): string[] {
  const errors: string[] = []

  if (blocks.length === 0) {
    errors.push(`${prefix}Zadání musí mít alespoň jeden blok.`)
  }

  for (const block of blocks) {
    if (block.type === 'text' && !block.markdown.trim()) {
      errors.push(`${prefix}Textový blok nesmí být prázdný.`)
    }

    if (block.type === 'math' && !block.latex.trim()) {
      errors.push(`${prefix}Matematický výraz nesmí být prázdný.`)
    }

    if (block.type === 'image' && block.assetId <= 0) {
      errors.push(`${prefix}Vyberte obrázek.`)
    }

    if (
      block.type === 'geogebra' &&
      (block.assetId <= 0 || block.previewAssetId <= 0)
    ) {
      errors.push(`${prefix}GeoGebra blok nemá platný obsah nebo náhled.`)
    }
  }

  return errors
}

export const useEditorStore = defineStore('editor', {
  state: () => ({
    problem: null as ProblemDraft | null,
    isSaved: true,
  }),

  getters: {
    errors(state): string[] {
      const draft = state.problem
      if (!draft) return []

      const errors = validateBlocks(draft.assignment)

      draft.subproblems.forEach((sub, index) => {
        errors.push(
          ...validateBlocks(sub.assignment, `Podúloha ${subproblemLabel(index)} `),
        )
      })

      // The same message can appear for several blocks.
      return [...new Set(errors)]
    },
  },

  actions: {
    loadProblem(problem: ProblemDraft) {
      this.problem = cloneDraft(problem)
      this.isSaved = true
    },

    setAssignment(blocks: Block[]) {
      if (!this.problem) return

      // Plain copy: the blocks come from props and may be reactive proxies.
      this.problem.assignment = cloneDraft(blocks)
      this.isSaved = false
    },

    /**
     * Tags and chapters belong to the main problem. Subproblems inherit them,
     * so their copies are kept equal here (and enforced again on save).
     */
    setTags(tags: TagRef[]) {
      if (!this.problem) return

      // Plain copies: the list comes from props and may hold reactive proxies.
      const plain = cloneDraft(tags)
      this.problem.tags = plain

      for (const sub of this.problem.subproblems) {
        sub.tags = cloneDraft(plain)
      }

      this.isSaved = false
    },

    setChapters(chapters: ChapterRef[]) {
      if (!this.problem) return

      const plain = cloneDraft(chapters)
      this.problem.chapters = plain

      for (const sub of this.problem.subproblems) {
        sub.chapters = cloneDraft(plain)
      }

      this.isSaved = false
    },

    addSubproblem() {
      if (!this.problem) return

      const sub = createEmptySubproblemDraft()
      sub.tags = this.problem.tags.map((tag) => ({ ...tag }))
      sub.chapters = this.problem.chapters.map((chapter) => ({ ...chapter }))

      this.problem.subproblems.push(sub)
      this.isSaved = false
    },

    setSubproblemAssignment(key: string, blocks: Block[]) {
      const sub = this.problem?.subproblems.find((item) => item.key === key)
      if (!sub) return

      sub.assignment = cloneDraft(blocks)
      this.isSaved = false
    },

    removeSubproblem(key: string) {
      if (!this.problem) return

      this.problem.subproblems = this.problem.subproblems.filter(
        (sub) => sub.key !== key,
      )
      this.isSaved = false
    },

    moveSubproblem(key: string, direction: -1 | 1) {
      if (!this.problem) return

      const subs = this.problem.subproblems
      const index = subs.findIndex((sub) => sub.key === key)
      const target = index + direction

      if (index === -1 || target < 0 || target >= subs.length) return

      const [sub] = subs.splice(index, 1)
      if (sub) subs.splice(target, 0, sub)

      this.isSaved = false
    },

    /**
     * After a save that failed half way: take over the ids and lockVersions
     * that the backend already handed out (see saveProblemSet), so that the
     * next attempt continues instead of creating everything again.
     */
    applySavedIds(saved: ProblemDraft) {
      if (!this.problem) return

      this.problem.id = saved.id
      this.problem.lockVersion = saved.lockVersion

      for (const savedSub of saved.subproblems) {
        const sub = this.problem.subproblems.find((item) => item.key === savedSub.key)
        if (!sub) continue

        sub.id = savedSub.id
        sub.lockVersion = savedSub.lockVersion
      }
    },

    markSaved() {
      this.isSaved = true
    },
  },
})
