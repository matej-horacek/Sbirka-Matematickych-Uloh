import { defineStore } from 'pinia'
import type {
  WorksheetDraft,
  WorksheetId,
  WorksheetProblem,
  WorksheetProblemDraft,
} from '../types'

type WorksheetsById = Record<string, WorksheetDraft>

const STORAGE_KEY = 'my-app:worksheets:v2'

function createLocalId(): string {
  return `local-${crypto.randomUUID()}`
}

function readStoredWorksheets(): WorksheetsById {
  if (typeof window === 'undefined') return {}

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}

    const parsed: unknown = JSON.parse(raw)

    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as WorksheetsById
    }

    return {}
  } catch {
    return {}
  }
}

export const useWorksheetProblemsStore = defineStore(
  'worksheetProblems',
  {
    state: () => ({
      byWorksheet: readStoredWorksheets(),
    }),

    getters: {
      worksheetForId: (state) => {
        return (id: WorksheetId) =>
          state.byWorksheet[String(id)]
      },

      problemsForWorksheet: (state) => {
        return (id: WorksheetId) =>
          state.byWorksheet[String(id)]?.problems ?? []
      },

      problemByLocalId: (state) => {
        return (id: WorksheetId, localId: string) =>
          state.byWorksheet[String(id)]?.problems.find(
            (problem) => problem.localId === localId,
          )
      },
    },

    actions: {
      persist() {
        if (typeof window === 'undefined') return

        try {
          window.localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(this.byWorksheet),
          )
        } catch (error) {
          console.error('Could not persist worksheets:', error)
        }
      },

      ensureWorksheet(
        id: WorksheetId,
        initialName = 'Pracovní list',
      ) {
        const key = String(id)

        if (this.byWorksheet[key]) return

        this.byWorksheet[key] = {
          id,
          name: initialName,
          difficulty: null,
          problems: [],
        }

        this.persist()
      },

      updateWorksheetMeta(
        id: WorksheetId,
        patch: Partial<Pick<WorksheetDraft, 'name' | 'difficulty'>>,
      ) {
        this.ensureWorksheet(id)

        const worksheet = this.byWorksheet[String(id)]
        if (!worksheet) return

        Object.assign(worksheet, patch)
        this.persist()
      },

      addProblem(
        id: WorksheetId,
        draft: WorksheetProblemDraft,
      ): string {
        this.ensureWorksheet(id)

        const worksheet = this.byWorksheet[String(id)]!
        const localId = createLocalId()

        const problem: WorksheetProblem = {
          localId,
          assignment: structuredClone(draft.assignment),
        }

        worksheet.problems.push(problem)
        this.persist()

        return localId
      },

      saveProblem(
        id: WorksheetId,
        localId: string,
        draft: WorksheetProblemDraft,
      ) {
        const worksheet = this.byWorksheet[String(id)]
        if (!worksheet) return

        const index = worksheet.problems.findIndex(
          (problem) => problem.localId === localId,
        )

        if (index === -1) return

        worksheet.problems[index] = {
          localId,
          assignment: structuredClone(draft.assignment),
        }

        this.persist()
      },

      moveProblem(
        id: WorksheetId,
        localId: string,
        direction: -1 | 1,
      ) {
        const worksheet = this.byWorksheet[String(id)]
        if (!worksheet) return

        const problems = worksheet.problems

        const index = problems.findIndex(
          (problem) => problem.localId === localId,
        )

        if (index === -1) return

        const target = index + direction

        if (target < 0 || target >= problems.length) return

        const [problem] = problems.splice(index, 1)

        if (problem) {
          problems.splice(target, 0, problem)
          this.persist()
        }
      },

      removeProblem(id: WorksheetId, localId: string) {
        const worksheet = this.byWorksheet[String(id)]
        if (!worksheet) return

        worksheet.problems = worksheet.problems.filter(
          (problem) => problem.localId !== localId,
        )

        this.persist()
      },
    },
  },
)