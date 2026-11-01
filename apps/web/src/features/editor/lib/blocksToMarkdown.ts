import type { Block } from '../types'

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
