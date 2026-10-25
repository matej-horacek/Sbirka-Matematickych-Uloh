// Ordered positions (set children, attachments, worksheet items).
// TODO Phase B: real fractional indexing (insert between neighbours without
// renumbering). The mock renumbers on every save, which is enough because a set
// is always saved as one complete ordered list.
export function positionAt(index: number): string {
  return 'a' + index.toString(36).padStart(4, '0');
}
