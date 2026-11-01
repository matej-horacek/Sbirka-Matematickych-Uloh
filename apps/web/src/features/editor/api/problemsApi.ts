import { ApiError, http } from '../../../../shared/api/http'
import { blocksToMarkdown } from '../lib/blocksToMarkdown'
import type {
  AddChildRequest,
  Block,
  ListProblemsParams,
  ProblemCreate,
  ProblemDetail,
  ProblemDetailCore,
  ProblemDraft,
  ProblemList,
  ProblemPage,
  ProblemPatch,
  PublishRequest,
  ReorderChildRequest,
  Sqid,
} from '../types'

function problemPath(id: Sqid): string {
  return `/problems/${encodeURIComponent(id)}`
}

function toContentPayload(draft: ProblemDraft) {
  const assignment = blocksToMarkdown(draft.assignment)
  const result = draft.solution?.length
    ? blocksToMarkdown(draft.solution) || null
    : null

  return {
    name: draft.name,
    assignment,
    result,
    language: draft.language,
    difficulty: draft.difficulty,
    tagIds: [...(draft.tagIds ?? [])],
    chapterIds: [...(draft.chapterIds ?? [])],
  }
}

function toCreatePayload(draft: ProblemDraft): ProblemCreate {
  return toContentPayload(draft)
}

function createBlockId(): string {
  return globalThis.crypto?.randomUUID?.()
    ?? `block-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function markdownToEditorBlock(markdown: string): Block {
  return { id: createBlockId(), type: 'text', markdown }
}

/**
 * The backend returns Markdown strings, not structured editor blocks. This
 * adapter restores each field as one editable text block without changing the
 * stored Markdown/LaTeX content.
 */
export function toEditorDraft(problem: ProblemDetail | ProblemDetailCore): ProblemDraft {
  return {
    id: problem.id,
    lockVersion: problem.lockVersion ?? null,
    name: problem.name,
    assignment: [markdownToEditorBlock(problem.assignment)],
    solution: problem.result ? [markdownToEditorBlock(problem.result)] : null,
    difficulty: problem.difficulty ?? null,
    language: problem.language ?? null,
    chapterIds: problem.chapters.map((chapter) => chapter.id),
    tagIds: problem.tags.map((tag) => tag.id),
  }
}

function toPatchPayload(draft: ProblemDraft): ProblemPatch {
  if (draft.lockVersion === null) {
    throw new Error('Cannot update a problem without its lockVersion.')
  }

  return {
    ...toContentPayload(draft),
    lockVersion: draft.lockVersion,
  }
}

function toListQuery(params: ListProblemsParams): string {
  const query = new URLSearchParams()
  query.set('scope', params.scope)

  if (params.page !== undefined) query.set('page', String(params.page))
  if (params.limit !== undefined) query.set('limit', String(params.limit))
  if (params.language) query.set('language', params.language)
  params.tagId?.forEach((id) => query.append('tagId', id))
  params.chapterId?.forEach((id) => query.append('chapterId', id))

  return query.toString()
}

export const problemsApi = {
  /** GET /problems?scope=mine|public -> a paginated ProblemPage. */
  list(params: ListProblemsParams = { scope: 'mine' }): Promise<ProblemPage> {
  return http<ProblemPage>(`/problems?${toListQuery(params)}`)
},
  /** GET /problems/:id -> one complete problem/set. */
  get(id: Sqid): Promise<ProblemDetail> {
    return http<ProblemDetail>(problemPath(id))
  },

  /** POST /problems -> 201 + the created ProblemDetail. */
  create(draft: ProblemDraft): Promise<ProblemDetail> {
    return http<ProblemDetail>('/problems', {
      method: 'POST',
      body: toCreatePayload(draft),
    })
  },

  /** PATCH /problems/:id -> 200 applied or 202 waiting for review. */
  async update(id: Sqid, draft: ProblemDraft): Promise<ProblemDetail> {
    try {
      return await http<ProblemDetail>(problemPath(id), {
        method: 'PATCH',
        body: toPatchPayload(draft),
      })
    } catch (error) {
      if (error instanceof ApiError && error.code === 'LOCK_MISMATCH') {
        throw new ApiError(
          error.status,
          'Příklad mezitím někdo změnil. Načtěte stránku znovu a zkuste to znovu.',
          error.body,
        )
      }

      throw error
    }
  },

  /** DELETE /problems/:id -> 204 (soft delete on the backend). */
  remove(id: Sqid): Promise<void> {
    return http<void>(problemPath(id), { method: 'DELETE' })
  },

  /** POST /problems/:id/copy -> a private copy owned by the current user. */
  copy(id: Sqid): Promise<ProblemDetail> {
    return http<ProblemDetail>(`${problemPath(id)}/copy`, { method: 'POST' })
  },

  /** POST /problems/:id/children -> move one of your problems or copy a visible one. */
  addChild(id: Sqid, payload: AddChildRequest): Promise<ProblemDetail> {
    return http<ProblemDetail>(`${problemPath(id)}/children`, {
      method: 'POST',
      body: payload,
    })
  },

  /** PATCH /problems/:id/children/:childId -> reorder a child. */
  reorderChild(
    id: Sqid,
    childId: Sqid,
    payload: ReorderChildRequest,
  ): Promise<ProblemDetail> {
    return http<ProblemDetail>(
      `${problemPath(id)}/children/${encodeURIComponent(childId)}`,
      { method: 'PATCH', body: payload },
    )
  },

  /** DELETE /problems/:id/children/:childId -> the new set detail. */
  removeChild(id: Sqid, childId: Sqid, lockVersion: number): Promise<ProblemDetail> {
    return http<ProblemDetail>(
      `${problemPath(id)}/children/${encodeURIComponent(childId)}`,
      {
        method: 'DELETE',
        headers: { 'If-Match': `"${lockVersion}"` },
      },
    )
  },

  /** POST /problems/:id/dissolve -> list of the standalone problems created. */
  dissolve(id: Sqid): Promise<ProblemList> {
    return http<ProblemList>(`${problemPath(id)}/dissolve`, { method: 'POST' })
  },

  /** POST /problems/:id/publish -> the published ProblemDetail. */
  publish(id: Sqid, payload: PublishRequest = {}): Promise<ProblemDetail> {
    return http<ProblemDetail>(`${problemPath(id)}/publish`, {
      method: 'POST',
      body: payload,
    })
  },
}
