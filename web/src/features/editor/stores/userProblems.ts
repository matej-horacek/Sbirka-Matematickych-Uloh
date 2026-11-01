
import { defineStore } from 'pinia'
import { problemsApi, toEditorDraft } from '../api/problemsApi'
import type { ProblemEditorDraft, Sqid } from '../types'

type Status = 'idle' | 'loading' | 'ready' | 'error'

// The logged-in user's own problems.
// The store contains editor-ready drafts, not raw backend responses.
export const useUserProblemsStore = defineStore('userProblems', {
  state: () => ({
    items: [] as ProblemEditorDraft[],
    status: 'idle' as Status,
    error: null as string | null,
  }),

  getters: {
    // Keep the order returned by the backend.
    // Sqids are opaque strings, so they cannot be sorted numerically.
    problems(state): ProblemEditorDraft[] {
      return [...state.items]
    },

    problemById: (state) => {
      return (id: Sqid): ProblemEditorDraft | undefined =>
        state.items.find((problem) => problem.id === id)
    },
  },

  actions: {
    /**
     * Load all of the current user's problems.
     *
     * The list endpoint returns lightweight ProblemListItems,
     * which do not contain lockVersion.
     *
     * We therefore retrieve the full ProblemDetail for each item
     * before converting it into an editor draft.
     */
    async fetchAll(): Promise<void> {
      this.status = 'loading'
      this.error = null

      try {
        const listItems = []
        let page = 1
        let total = 0

        // Fetch all list pages (backend maximum: 100 per page).
        do {
          const response = await problemsApi.list({
            scope: 'mine',
            page,
            limit: 100,
          })

          listItems.push(...response.items)
          total = response.meta.total
          page++

          if (response.items.length === 0) break
        } while (listItems.length < total)

        // Fetch complete problem details, including lockVersion.
        const details = await Promise.all(
          listItems.map((item) => problemsApi.get(item.id)),
        )

        // Convert backend responses into editor-ready drafts.
        this.items = details.map((problem) => toEditorDraft(problem))

        this.status = 'ready'
      } catch (error) {
        this.status = 'error'
        this.error =
          error instanceof Error
            ? error.message
            : 'Příklady se nepodařilo načíst.'
      }
    },

    /**
     * Create a new problem.
     */
    async add(draft: ProblemEditorDraft): Promise<ProblemEditorDraft> {
      const response = await problemsApi.create(draft)

      const created = toEditorDraft(response)

      this.items.push(created)

      return created
    },

    /**
     * Save an existing problem.
     */
    
async save(draft: ProblemEditorDraft): Promise<ProblemEditorDraft> {
  // New problem: create it instead of updating it.
  if (draft.id === null || draft.id === undefined) {
    const response = await problemsApi.create(draft)
    const created = toEditorDraft(response)

    this.items.push(created)

    return created
  }

  // Existing problem: lockVersion is mandatory.
  if (
    draft.lockVersion === null ||
    draft.lockVersion === undefined
  ) {
    throw new Error(
      'Chybí lockVersion. Načtěte příklad znovu před uložením.',
    )
  }

  const response = await problemsApi.update(draft.id, draft)
  const updated = toEditorDraft(response)

  const index = this.items.findIndex(
    (problem) => problem.id === draft.id,
  )

  if (index === -1) {
    this.items.push(updated)
  } else {
    this.items[index] = updated
  }

  return updated
},


    /**
     * Delete a problem.
     */
    async remove(id: Sqid): Promise<void> {
      await problemsApi.remove(id)

      this.items = this.items.filter(
        (problem) => problem.id !== id,
      )
    },
  },
})
