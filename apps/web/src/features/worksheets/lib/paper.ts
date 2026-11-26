import type { ProblemEditorDraft } from '@/features/editor/types'
import type { PaperFont, PaperSpacing, WorksheetLayout } from '../types'

// A4 portrait. The sheet is laid out in real millimetres, so what the editor
// shows is the same size the browser (or a later PDF export) prints.
export const PAGE_WIDTH_MM = 210
export const PAGE_HEIGHT_MM = 297
export const MARGIN_X_MM = 20
export const MARGIN_Y_MM = 18

const PX_PER_MM = 96 / 25.4 // CSS: 1in = 96px = 25.4mm

export const PAGE_WIDTH_PX = PAGE_WIDTH_MM * PX_PER_MM

/** The height one page has for content, margins taken off. */
export const CONTENT_HEIGHT_PX = (PAGE_HEIGHT_MM - 2 * MARGIN_Y_MM) * PX_PER_MM

const FONT_STACKS: Record<PaperFont, string> = {
  serif: "'Times New Roman', 'Liberation Serif', Times, serif",
  sans: "Arial, 'Liberation Sans', Helvetica, sans-serif",
}

// In em, so the gap follows the font size.
const SPACING: Record<PaperSpacing, string> = {
  compact: '0.6em',
  normal: '1.2em',
  airy: '2em',
}

/** The CSS variables the sheet, the measuring copy and the blocks read. */
export function paperCssVars(layout: WorksheetLayout): Record<string, string> {
  return {
    '--page-w': `${PAGE_WIDTH_MM}mm`,
    '--page-h': `${PAGE_HEIGHT_MM}mm`,
    '--margin-x': `${MARGIN_X_MM}mm`,
    '--margin-y': `${MARGIN_Y_MM}mm`,
    '--paper-font': FONT_STACKS[layout.fontFamily],
    '--paper-font-size': `${layout.fontSizePt}pt`,
    '--paper-gap': SPACING[layout.spacing],
  }
}

/** One unbreakable piece of the sheet: the heading, or one problem. */
export type PaperBlock =
  | { kind: 'heading'; key: string }
  | { kind: 'problem'; key: string; number: number; problem: ProblemEditorDraft }
