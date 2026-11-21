import { http } from '../../../../shared/api/http'
import type { ChapterList, TagPage, TagRef } from '../types'

const TAG_PAGE_LIMIT = 100 // the maximum the API allows

/**
 * Read-only pickers. The API has no endpoint for creating tags or chapters:
 * a problem can only be put into ones that already exist.
 */
export const pickersApi = {
  /** GET /chapters -> every global chapter and the user's own, as a flat list. */
  listChapters(): Promise<ChapterList> {
    return http<ChapterList>('/chapters')
  },

  /** GET /tags -> one page of global tags and the user's own personal tags. */
  listTagsPage(page: number): Promise<TagPage> {
    return http<TagPage>(`/tags?page=${page}&limit=${TAG_PAGE_LIMIT}`)
  },

  /** Every tag, page after page (there are few of them; filtering happens in the browser). */
  async listAllTags(): Promise<TagRef[]> {
    const tags: TagRef[] = []
    let page = 1

    for (;;) {
      const response = await this.listTagsPage(page)
      tags.push(...response.items)

      if (response.items.length === 0 || tags.length >= response.meta.total) break
      page++
    }

    return tags
  },
}
