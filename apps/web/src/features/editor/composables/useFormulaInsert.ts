import { nextTick, ref, type Ref } from 'vue'

export function findMathAt(text: string, pos: number) {
  for (const m of text.matchAll(/\$([^$\n]+)\$/g)) {
    const start = m.index!
    const end = start + m[0].length
    if (pos > start && pos < end) return { start, end, latex: m[1] }
  }
  return null
}

export function useFormulaInsert(
  area: Ref<HTMLTextAreaElement | null>,
  getMarkdown: () => string,
  setMarkdown: (value: string) => void,
) {
  const open = ref(false)
  const draft = ref('')
  let range = { start: 0, end: 0 }

  function start() {
    const el = area.value
    if (!el) return

    const hit = findMathAt(getMarkdown(), el.selectionStart)
    range = hit
      ? { start: hit.start, end: hit.end }
      : { start: el.selectionStart, end: el.selectionEnd }
    draft.value = hit?.latex ?? ''
    open.value = true
  }

  async function confirm() {
    open.value = false
    const latex = draft.value.trim()
    if (!latex) return

    const text = getMarkdown()
    const inserted = `$${latex}$`
    setMarkdown(text.slice(0, range.start) + inserted + text.slice(range.end))

    await nextTick()
    const caret = range.start + inserted.length
    area.value?.focus()
    area.value?.setSelectionRange(caret, caret)
  }

  function cancel() {
    open.value = false
  }

  return { open, draft, start, confirm, cancel }
}