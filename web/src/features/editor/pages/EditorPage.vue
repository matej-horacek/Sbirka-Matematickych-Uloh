<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useEditorStore } from '../stores/editorStore'
import BlockRenderer from '../components/blocks/BlockRenderer.vue'
import { downloadTextFile } from '../../../../shared/lib/downloadTextFile'

const store = useEditorStore()
onMounted(() => store.newProblem())

const id = () => crypto.randomUUID()

const triedToSave = ref(false)
const savedJson = ref<string | null>(null)

function onDifficulty(e: Event) {
  const v = (e.target as HTMLInputElement).value
  store.updateMeta({ difficulty: v === '' ? null : Number(v) })
}

function save() {
  triedToSave.value = true
  if (!store.payload || store.errors.length) return

  const json = JSON.stringify(store.payload, null, 2)
  savedJson.value = json
  downloadTextFile(`problem-${store.problem?.id ?? 'new'}.txt`, json)
  store.markSaved()
}
</script>


<template>
  <main v-if="store.problem" class="editor">
    <div class="editor__inner">
      <header class="card meta">
        <input
          class="meta__name"
          :value="store.problem.name"
          placeholder="Název úlohy"
          aria-label="Název úlohy"
          @input="store.updateMeta({ name: ($event.target as HTMLInputElement).value })"
        />
        <label class="meta__difficulty">
          <span>Obtížnost (1-10)</span>
          <input
            type="number"
            min="1"
            max="10"
            :value="store.problem.difficulty ?? ''"
            @input="onDifficulty"
          />
        </label>
      </header>
 
      <section class="blocks" aria-label="Zadání">
        <article
          v-for="(b, i) in store.problem.assignment"
          :key="b.id"
          class="card block"
        >
          <div class="block__content">
            <BlockRenderer :block="b" @update="store.updateBlock(b.id, $event)" />
          </div>
 
          <div class="block__tools">
            <button
              class="icon-btn"
              type="button"
              aria-label="Posunout nahoru"
              title="Posunout nahoru"
              :disabled="i === 0"
              @click="store.moveBlock(b.id, -1)"
            >
              ↑
            </button>
            <button
              class="icon-btn"
              type="button"
              aria-label="Posunout dolů"
              title="Posunout dolů"
              :disabled="i === store.problem.assignment.length - 1"
              @click="store.moveBlock(b.id, 1)"
            >
              ↓
            </button>
            <button
              class="icon-btn icon-btn--danger"
              type="button"
              aria-label="Smazat blok"
              title="Smazat blok"
              :disabled="store.problem.assignment.length === 1"
              @click="store.removeBlock(b.id)"
            >
              ✕
            </button>
          </div>
        </article>
      </section>
 
      <div class="actions">
        <div class="actions__add">
          <button
            class="btn btn--ghost"
            type="button"
            @click="store.addBlock({ id: id(), type: 'text', markdown: '' })"
          >
            + Text
          </button>
          <button
            class="btn btn--ghost"
            type="button"
            @click="store.addBlock({ id: id(), type: 'math', latex: '' })"
          >
            + Vzorec
          </button>
        </div>
 
        <button class="btn btn--primary" type="button" @click="save">Uložit</button>
      </div>
 
      <ul v-if="triedToSave && store.errors.length" class="errors" role="alert">
        <li v-for="e in store.errors" :key="e">{{ e }}</li>
      </ul>
 
      <pre v-if="savedJson" class="json" aria-label="Uložená data">{{ savedJson }}</pre>
    </div>
  </main>
</template>




<style scoped>
.editor {
  /* palette taken from the mockups: pale aqua page, white cards, green actions, sky-blue accents */
  --bg: #e6fafc;
  --surface: #ffffff;
  --ink: #0f1d24;
  --muted: #5a6b73;
  --line: #c9dde2;
  --accent: #2fd653;
  --accent-hover: #27c24b;
  --accent-ink: #062611;
  --accent-deep: #0b7a2b;
  --accent-soft: #d9f7e0;
  --sky: #3cc8f5;
  --sky-deep: #0a7fb0;
  --sky-ink: #05283a;
  --danger: #b3261e;
  --danger-soft: #fdecea;
  --radius: 16px;
 
  min-height: 100vh;
  padding: 2.5rem 1rem 4rem;
  background: var(--bg);
  color: var(--ink);
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.5;
}
 
.editor :focus-visible {
  outline: 3px solid var(--sky-deep);
  outline-offset: 2px;
}
 
.editor__inner {
  display: grid;
  gap: 1rem;
  max-width: 820px;
  margin: 0 auto;
}
 
.blocks {
  display: grid;
  gap: 1rem;
}
 
.card {
  padding: 1rem 1.25rem;
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: 0 1px 3px rgba(20, 80, 100, 0.12);
}
 
/* ---------- Problem name + difficulty ---------- */
.meta {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 1rem 1.5rem;
}
 
.meta__name {
  flex: 1 1 18rem;
  padding: 0.25rem 0;
  border: 0;
  border-bottom: 2px solid var(--line);
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 1.5rem;
  font-weight: 700;
}
 
.meta__name::placeholder {
  color: var(--muted);
  font-weight: 500;
}
 
.meta__difficulty {
  display: grid;
  gap: 0.25rem;
  color: var(--muted);
  font-size: 0.875rem;
}
 
.meta__difficulty input {
  width: 6rem;
  padding: 0.4rem 0.6rem;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: #fff;
  color: var(--ink);
  font: inherit;
}
 
/* ---------- Blocks ---------- */
.block {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: 0.75rem;
}
 
.block__content {
  min-width: 0;
}
 
.block__tools {
  display: flex;
  gap: 0.25rem;
}
 
.icon-btn {
  display: grid;
  place-items: center;
  width: 2.25rem;
  height: 2.25rem;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--ink);
  font: inherit;
  font-size: 1.25rem;
  cursor: pointer;
}
 
.icon-btn:hover:not(:disabled) {
  background: var(--bg);
}
 
.icon-btn:disabled {
  color: #a9bac0;
  cursor: default;
}
 
.icon-btn--danger:hover:not(:disabled) {
  background: var(--danger-soft);
  color: var(--danger);
}
 
/* Styles for what the block components render (they have their own scoped CSS) */
.block :deep(textarea) {
  box-sizing: border-box;
  width: 100%;
  padding: 0.6rem 0.75rem;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: #fff;
  color: var(--ink);
  font: inherit;
  resize: vertical;
}
 
.block :deep(.markdown) {
  margin-top: 0.5rem;
}
 
.block :deep(math-field) {
  box-sizing: border-box;
  width: 100%;
  padding: 0.4rem 0.75rem;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: #fff;
}
 
.block :deep(.math-block > div:first-child) {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}
 
.block :deep(.math-block button) {
  padding: 0.25rem 0.8rem;
  border: 0;
  border-radius: 999px;
  background: var(--bg);
  color: var(--ink);
  font: inherit;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
}
 
/* the disabled button is the active mode */
.block :deep(.math-block button:disabled) {
  background: var(--sky);
  color: var(--sky-ink);
  cursor: default;
}
 
/* ---------- Actions ---------- */
.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}
 
.actions__add {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
 
.btn {
  padding: 0.6rem 1.1rem;
  border: 2px solid transparent;
  border-radius: 999px;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  transition: background-color 0.15s;
}
 
.btn--primary {
  background: var(--accent);
  color: var(--accent-ink);
}
 
.btn--primary:hover {
  background: var(--accent-hover);
}
 
.btn--ghost {
  border-color: var(--accent);
  background: var(--surface);
  color: var(--accent-deep);
}
 
.btn--ghost:hover {
  background: var(--accent-soft);
}
 
/* ---------- Validation + saved data ---------- */
.errors {
  margin: 0;
  padding: 0.75rem 1rem 0.75rem 2rem;
  border-radius: 12px;
  background: var(--danger-soft);
  color: var(--danger);
}
 
.json {
  margin: 0;
  padding: 1rem 1.25rem;
  max-height: 24rem;
  overflow: auto;
  border-radius: var(--radius);
  background: var(--surface);
  font:
    0.8125rem/1.5 ui-monospace,
    'Cascadia Code',
    Consolas,
    monospace;
}
 
@media (max-width: 520px) {
  .editor {
    padding: 1rem 0.5rem 3rem;
  }
 
  .card {
    padding: 0.85rem;
  }
}
 
@media (prefers-reduced-motion: reduce) {
  .btn {
    transition: none;
  }
}
</style>