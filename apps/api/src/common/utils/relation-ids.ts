export type ChapterLink = { chapter_id: number; chapter: { name: string } };
export type TagLink = { tag_id: number; tag: { name: string } };

const collator = new Intl.Collator('cs');   // module level, built once
// then: .sort((a, b) => collator.compare(a.name, b.name))
/** Tag ids sorted by tag name (D-04), Czech collation like the mock. */
export function toTagIds(rows: TagLink[]): number[] {
  return [...rows].sort((a, b) => collator.compare(a.tag.name, b.tag.name)).map((r) => r.tag_id);
}

/** Chapter ids sorted by chapter name (D-04), Czech collation like the mock. */
export function toChapterIds(rows: ChapterLink[]): number[] {
  return [...rows].sort((a, b) => collator.compare(a.chapter.name, b.chapter.name)).map((r) => r.chapter_id);
}


