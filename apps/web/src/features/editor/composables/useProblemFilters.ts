import { computed, onMounted, reactive, watch, type Ref } from 'vue'
import {
  countActiveFilters,
  createAncestorResolver,
  createEmptyFilterState,
  createProblemMatcher,
  problemChapterIds,
  type FilterOption,
  type ProblemFilterState,
  type TagMatchMode,
} from '../lib/problemFilters'
import { useCategoriesStore } from '../stores/categoriesStore'
import type { ProblemEditorDraft, Sqid } from '../types'

const collator = new Intl.Collator('cs')

/**
 * Filtering of the user's problems by chapters (okruhy) and tags (štítky).
 *
 * `source` is the complete list of problems. The offered options and their
 * counts are built from it, not from the already filtered list, so choosing
 * one option never makes the other options disappear.
 */
export function useProblemFilters(source: Ref<ProblemEditorDraft[]>) {
  const categories = useCategoriesStore()

  onMounted(() => {
    // Needed for the chapter tree (parents and children). Without it the
    // filter still works, only without hierarchy.
    void categories.load()
  })

  const state = reactive<ProblemFilterState>(createEmptyFilterState())

  const resolveAncestors = computed(() =>
    createAncestorResolver(categories.chapters),
  )

  /** Chapters that are used by at least one problem, as tree rows with counts. */
  const chapterOptions = computed<FilterOption[]>(() => {
    const resolve = resolveAncestors.value
    const counts = new Map<Sqid, number>()
    const names = new Map<Sqid, string>()

    for (const problem of source.value) {
      for (const id of problemChapterIds(problem, resolve)) {
        counts.set(id, (counts.get(id) ?? 0) + 1)
      }

      for (const chapter of problem.chapters) {
        names.set(chapter.id, chapter.name)
      }
    }

    const options: FilterOption[] = []
    const seen = new Set<Sqid>()

    // Tree order, parents before their children.
    for (const row of categories.chapterRows) {
      const count = counts.get(row.chapter.id)

      if (!count) continue

      options.push({
        id: row.chapter.id,
        name: row.chapter.name,
        count,
        depth: row.depth,
      })
      seen.add(row.chapter.id)
    }

    // Chapters that are not in the loaded tree (still loading, failed to
    // load, or unknown to it) are listed flat, so no problem becomes
    // impossible to find.
    const missing = [...names]
      .filter(([id]) => !seen.has(id))
      .sort(([, a], [, b]) => collator.compare(a, b))

    for (const [id, name] of missing) {
      options.push({ id, name, count: counts.get(id) ?? 0, depth: 0 })
    }

    return options
  })

  /** Tags used by at least one problem, the most used first. */
  const tagOptions = computed<FilterOption[]>(() => {
    const found = new Map<Sqid, FilterOption>()

    for (const problem of source.value) {
      for (const tag of problem.tags) {
        const option = found.get(tag.id)

        if (option) {
          option.count++
        } else {
          found.set(tag.id, { id: tag.id, name: tag.name, count: 1, depth: 0 })
        }
      }
    }

    return [...found.values()].sort(
      (a, b) => b.count - a.count || collator.compare(a.name, b.name),
    )
  })

  const matcher = computed(() =>
    createProblemMatcher(state, resolveAncestors.value),
  )

  const filtered = computed(() => source.value.filter(matcher.value))

  const activeCount = computed(() => countActiveFilters(state))

  // After an edit or a delete, a selected chapter or tag may no longer be used
  // by any problem. Drop it, otherwise the list would be empty with nothing
  // in the panel to explain why.
  watch([chapterOptions, tagOptions], ([chapters, tags]) => {
    const chapterIds = new Set(chapters.map((option) => option.id))
    const tagIds = new Set(tags.map((option) => option.id))

    if (state.chapterIds.some((id) => !chapterIds.has(id))) {
      state.chapterIds = state.chapterIds.filter((id) => chapterIds.has(id))
    }

    if (state.tagIds.some((id) => !tagIds.has(id))) {
      state.tagIds = state.tagIds.filter((id) => tagIds.has(id))
    }
  })

  function toggle(list: Sqid[], id: Sqid): Sqid[] {
    return list.includes(id) ? list.filter((item) => item !== id) : [...list, id]
  }

  function toggleChapter(id: Sqid) {
    state.chapterIds = toggle(state.chapterIds, id)
  }

  function toggleTag(id: Sqid) {
    state.tagIds = toggle(state.tagIds, id)
  }

  function setTagMode(mode: TagMatchMode) {
    state.tagMode = mode
  }

  function clearFilters() {
    state.chapterIds = []
    state.tagIds = []
    state.tagMode = 'any'
  }

  return {
    state,
    chapterOptions,
    tagOptions,
    filtered,
    activeCount,
    toggleChapter,
    toggleTag,
    setTagMode,
    clearFilters,
  }
}
