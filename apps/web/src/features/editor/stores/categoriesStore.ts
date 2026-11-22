import { defineStore } from 'pinia'
import { pickersApi } from '../api/pickersApi'
import type { ChapterNode, Sqid, TagRef } from '../types'

type Status = 'idle' | 'loading' | 'ready' | 'error'

/** One row of the chapter tree, flattened depth-first for display. */
export interface ChapterRow {
  chapter: ChapterNode
  depth: number
}

const collator = new Intl.Collator('cs')

// Everything a problem can be categorized with: tags and chapters.
// Loaded once (the lists are small and the API has no search for chapters).
export const useCategoriesStore = defineStore('categories', {
  state: () => ({
    tags: [] as TagRef[],
    chapters: [] as ChapterNode[],
    status: 'idle' as Status,
    error: null as string | null,
  }),

  getters: {
    /** The chapter tree as flat rows, parents before their children. */
    chapterRows(state): ChapterRow[] {
      const byParent = new Map<Sqid | null, ChapterNode[]>()
      const known = new Set(state.chapters.map((chapter) => chapter.id))

      for (const chapter of state.chapters) {
        // A chapter whose parent is not in the list is shown at the top
        // instead of disappearing.
        const parent =
          chapter.parentId !== null && known.has(chapter.parentId)
            ? chapter.parentId
            : null

        const siblings = byParent.get(parent) ?? []
        siblings.push(chapter)
        byParent.set(parent, siblings)
      }

      const rows: ChapterRow[] = []

      const walk = (parent: Sqid | null, depth: number) => {
        const children = [...(byParent.get(parent) ?? [])].sort((a, b) =>
          collator.compare(a.name, b.name),
        )

        for (const chapter of children) {
          rows.push({ chapter, depth })
          walk(chapter.id, depth + 1)
        }
      }

      walk(null, 0)
      return rows
    },
  },

  actions: {
    /** Loads tags and chapters once. `force` loads them again. */
    async load(force = false): Promise<void> {
      if (this.status === 'loading') return
      if (this.status === 'ready' && !force) return

      this.status = 'loading'
      this.error = null

      try {
        const [tags, chapters] = await Promise.all([
          pickersApi.listAllTags(),
          pickersApi.listChapters(),
        ])

        this.tags = tags
        this.chapters = chapters.items
        this.status = 'ready'
      } catch (error) {
        this.status = 'error'
        this.error =
          error instanceof Error
            ? error.message
            : 'Štítky a okruhy se nepodařilo načíst.'
      }
    },
  },
})
