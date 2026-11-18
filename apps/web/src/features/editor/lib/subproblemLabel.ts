/** 0 -> "a)", 1 -> "b)" ... 25 -> "z)", then "27)", "28)" ... */
export function subproblemLabel(index: number): string {
  return index < 26 ? `${String.fromCharCode(97 + index)})` : `${index + 1})`
}

/** Subproblems have no name field in the editor: the name is "<main name> a)". */
export function subproblemName(mainName: string, index: number): string {
  // The backend limits a name to 255 characters.
  return `${mainName.trim().slice(0, 240)} ${subproblemLabel(index)}`
}
