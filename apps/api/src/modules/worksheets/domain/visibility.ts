import type { WorksheetRow } from '../../../database/mock-database.js';

/** The author sees everything of theirs; others see only published worksheets. */
export function canView(worksheet: WorksheetRow, userId: number): boolean {
  return worksheet.authorId === userId || worksheet.publishStatus === 'PUBLISHED';
}
