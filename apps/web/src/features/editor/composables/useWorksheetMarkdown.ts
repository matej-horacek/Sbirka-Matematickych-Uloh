import type { Block, WorksheetProblem } from '../types'

// One problem's blocks -> markdown
export function blocksToMarkdown(blocks: Block[]): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case 'text':
          return block.markdown.trim()
        case 'math':
          return `$$\n${block.latex.trim()}\n$$`
        case 'image':
          return `![${block.alt ?? ''}](asset:${block.assetId})`
        case 'geogebra':
          return `![GeoGebra](asset:${block.previewAssetId})`
      }
    })
    .filter(Boolean)
    .join('\n\n')
}

// Whole worksheet -> markdown
export function worksheetToMarkdown(
  problems: WorksheetProblem[],
  title = 'Pracovní list',
): string {
  const body = problems
    .map(
      (problem, index) =>
        `## Příklad ${index + 1}\n\n${blocksToMarkdown(problem.assignment)}`,
    )
    .join('\n\n---\n\n')

  return `# ${title}\n\n${body}\n`
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()

  URL.revokeObjectURL(url)
}

export function useWorksheetMarkdown() {
  // TEMPORARY: downloads a .md file. Later, replace the body of this
  // function with a call to worksheetsApi (backend / database).
  function exportWorksheet(
    problems: WorksheetProblem[],
    worksheetId: string | number,
  ) {
    const markdown = worksheetToMarkdown(problems)
    downloadTextFile(`pracovni-list-${worksheetId}.md`, markdown)
  }

  return { exportWorksheet }
}