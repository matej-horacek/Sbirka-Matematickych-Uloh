import type { ChapterNode, ProblemContentDraft, Sqid } from '../types'

/** Does a problem need to carry any selected tag, or all of them? */
export type TagMatchMode = 'any' | 'all'

export interface ProblemFilterState {
  chapterIds: Sqid[]
  tagIds: Sqid[]
  tagMode: TagMatchMode
}

/** One selectable row in the filter panel. */
export interface FilterOption {
  id: Sqid
  name: string
  /** Number of problems that match this option. */
  count: number
  /** Indentation level in the chapter tree (always 0 for tags). */
  depth: number
}

/** Resolves a chapter id to itself plus all of its ancestors. */
export type AncestorResolver = (id: Sqid) => Sqid[]

type Categorized = Pick<ProblemContentDraft, 'chapters' | 'tags'>

export function createEmptyFilterState(): ProblemFilterState {
  return { chapterIds: [], tagIds: [], tagMode: 'any' }
}

export function countActiveFilters(state: ProblemFilterState): number {
  return state.chapterIds.length + state.tagIds.length
}

/**
 * Builds a function returning a chapter and all of its ancestors.
 *
 * A problem filed under "Kvadratické rovnice" must also show up when the user
 * filters by its parent "Rovnice", so every chapter of a problem is expanded
 * to the whole path up to the root before it is compared.
 */
export function createAncestorResolver(chapters: ChapterNode[]): AncestorResolver {
  const parentOf = new Map<Sqid, Sqid | null>(
    chapters.map((chapter) => [chapter.id, chapter.parentId]),
  )

  return (id) => {
    const path: Sqid[] = [id]
    const seen = new Set<Sqid>([id])
    let parent = parentOf.get(id) ?? null

    // `seen` guards against a (broken) cycle in the data.
    while (parent !== null && !seen.has(parent)) {
      path.push(parent)
      seen.add(parent)
      parent = parentOf.get(parent) ?? null
    }

    return path
  }
}

/** All chapter ids a problem belongs to, including the ancestors of its chapters. */
export function problemChapterIds(
  problem: Categorized,
  resolve: AncestorResolver,
): Set<Sqid> {
  const ids = new Set<Sqid>()

  for (const chapter of problem.chapters) {
    for (const id of resolve(chapter.id)) {
      ids.add(id)
    }
  }

  return ids
}

/**
 * Chapters: the problem has to be in at least one selected chapter (or in a
 * subchapter of it). Tags: any or all of the selected tags, by `tagMode`.
 * Both groups have to match when both are used.
 */
export function createProblemMatcher(
  state: ProblemFilterState,
  resolve: AncestorResolver,
): (problem: Categorized) => boolean {
  const chapterIds = [...state.chapterIds]
  const tagIds = [...state.tagIds]
  const mode = state.tagMode

  return (problem) => {
    if (chapterIds.length > 0) {
      const own = problemChapterIds(problem, resolve)

      if (!chapterIds.some((id) => own.has(id))) return false
    }

    if (tagIds.length > 0) {
      const own = new Set(problem.tags.map((tag) => tag.id))

      const matches =
        mode === 'all'
          ? tagIds.every((id) => own.has(id))
          : tagIds.some((id) => own.has(id))

      if (!matches) return false
    }

    return true
  }
}
