import { defineStore } from 'pinia'
import type { Sqid } from '@/features/editor/types'
import { worksheetsApi } from '../api/worksheetsApi'
import type { WorksheetListItem } from '../types'

type Status = 'idle' | 'loading' | 'ready' | 'error'

const PAGE_LIMIT = 100 // the maximum the API allows (same as problems)

// The logged-in user's own worksheets (the API lists no others yet).
export const useWorksheetsStore = defineStore('worksheets', {
  state: () => ({
    items: [] as WorksheetListItem[],
    status: 'idle' as Status,
    error: null as string | null,
  }),

  actions: {
    /** Loads every worksheet, page after page. */
    async fetchAll(): Promise<void> {
      this.status = 'loading'
      this.error = null

      try {
        const items: WorksheetListItem[] = []
        let page = 1
        let total = 0

        do {
          const response = await worksheetsApi.list({ page, limit: PAGE_LIMIT })

          items.push(...response.items)
          total = response.meta.total
          page++

          if (response.items.length === 0) break
        } while (items.length < total)

        this.items = items
        this.status = 'ready'
      } catch (error) {
        this.status = 'error'
        this.error =
          error instanceof Error ? error.message : 'Listy se nepodařilo načíst.'
      }
    },

    async remove(id: Sqid): Promise<void> {
      await worksheetsApi.remove(id)
      this.items = this.items.filter((worksheet) => worksheet.id !== id)
    },
  },
})
