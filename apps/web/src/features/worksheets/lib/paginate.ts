/** A piece of content with its measured height in px (the space below it included). */
export interface Measured {
  height: number
}

/**
 * Splits blocks into pages the way a word processor does: top to bottom, and a
 * block that does not fit in the rest of the page starts the next one.
 *
 * A block is never split. One that is taller than a whole page still gets a
 * page of its own (the page grows to fit it) instead of being cut off.
 * There is always at least one page, even for no blocks.
 */
export function paginate<T extends Measured>(blocks: T[], pageHeight: number): T[][] {
  const pages: T[][] = [[]]
  let used = 0

  for (const block of blocks) {
    const page = pages[pages.length - 1]!

    if (page.length === 0 || used + block.height <= pageHeight) {
      page.push(block)
      used += block.height
    } else {
      pages.push([block])
      used = block.height
    }
  }

  return pages
}
