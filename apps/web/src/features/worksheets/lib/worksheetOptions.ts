import type { PaperFont, PaperSpacing, WorksheetLayout } from '../types'

export const DEFAULT_LAYOUT: WorksheetLayout = {
  fontFamily: 'serif',
  fontSizePt: 12,
  spacing: 'normal',
  showTitle: true,
  showStudentLine: true,
  numberProblems: true,
}

// Difficulty is a number on a 1..N scale. Change N here if the backend uses another range.
export const DIFFICULTY_LEVELS = [1, 2, 3, 4, 5] as const

const DIFFICULTY_LABELS = ['Velmi lehká', 'Lehká', 'Střední', 'Těžká', 'Velmi těžká']

export function difficultyLabel(level: number | null): string {
  return level === null ? 'Neurčena' : (DIFFICULTY_LABELS[level - 1] ?? `Úroveň ${level}`)
}

export const FONT_OPTIONS: { value: PaperFont; label: string }[] = [
  { value: 'serif', label: 'Patkové' },
  { value: 'sans', label: 'Bezpatkové' },
]

export const FONT_SIZE_OPTIONS = [10, 11, 12, 14].map((size) => ({
  value: size,
  label: `${size} pt`,
}))

export const SPACING_OPTIONS: { value: PaperSpacing; label: string }[] = [
  { value: 'compact', label: 'Malé' },
  { value: 'normal', label: 'Střední' },
  { value: 'airy', label: 'Velké' },
]
