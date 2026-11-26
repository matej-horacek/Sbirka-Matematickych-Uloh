<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'

import type { ProblemEditorDraft, Sqid } from '@/features/editor/types'

// PLACEHOLDER. The real "Přidat úlohy" window is still to be designed. What stays
// is the contract with the editor page: v-model:open, the problems on offer,
// which of them are already in the worksheet, and an `add` event. Only the body
// of the <dialog> (the plain list) is meant to be thrown away.
defineProps<{
  problems: ProblemEditorDraft[]
  pickedIds: ReadonlySet<Sqid | null>
  loading: boolean
  error: string | null
}>()

const emit = defineEmits<{ add: [problem: ProblemEditorDraft] }>()

const open = defineModel<boolean>('open', { required: true })
const dialog = ref<HTMLDialogElement | null>(null)

onMounted(() => {
  if (open.value) dialog.value?.showModal()
})

watch(
  open,
  (isOpen) => {
    const element = dialog.value
    if (!element) return

    if (isOpen && !element.open) element.showModal()
    if (!isOpen && element.open) element.close()
  },
  { flush: 'post' },
)

// A click on the dimmed backdrop lands on the <dialog> itself.
function onBackdropClick(event: MouseEvent) {
  if (event.target === dialog.value) open.value = false
}
</script>

<template>
  <!-- `close` also fires on Esc, which keeps `open` in sync. -->
  <dialog ref="dialog" class="modal" aria-labelledby="add-problems-title" @close="open = false" @click="onBackdropClick">
    <div class="modal__box">
      <header class="modal__header">
        <h2 id="add-problems-title">Přidat úlohy</h2>
        <button type="button" class="modal__close" aria-label="Zavřít" @click="open = false">✕</button>
      </header>

      <p v-if="loading" class="modal__hint">Načítám úlohy...</p>
      <p v-else-if="error" class="modal__hint" role="alert">{{ error }}</p>
      <p v-else-if="problems.length === 0" class="modal__hint">Zatím nemáte žádné úlohy.</p>

      <ul v-else class="modal__list">
        <li v-for="problem in problems" :key="problem.id ?? problem.name" class="modal__row">
          <span class="modal__name">{{ problem.name || 'Bez názvu' }}</span>

          <span v-if="pickedIds.has(problem.id)" class="modal__added">✓ V listu</span>
          <button v-else type="button" class="modal__add" @click="emit('add', problem)">+ Přidat</button>
        </li>
      </ul>

      <footer class="modal__footer">
        <button type="button" class="modal__done" @click="open = false">Hotovo</button>
      </footer>
    </div>
  </dialog>
</template>

<style scoped>
.modal {
  width: min(40rem, calc(100vw - 2rem));
  max-height: 80vh;
  padding: 0;
  color: var(--color-ink);
  background: var(--color-surface);
  border: 0;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-pop);
}

.modal::backdrop {
  background: rgba(6, 30, 38, 0.5);
}

.modal__box {
  display: flex;
  flex-direction: column;
  max-height: 80vh;
}

.modal__header,
.modal__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
}

.modal__header {
  border-bottom: 1px solid var(--color-border);
}

.modal__header h2 {
  margin: 0;
  font-size: 1.2rem;
}

.modal__footer {
  justify-content: flex-end;
  border-top: 1px solid var(--color-border);
}

.modal__close {
  width: 2rem;
  height: 2rem;
  background: none;
  border: 0;
  border-radius: 50%;
  cursor: pointer;
}

.modal__close:hover {
  background: var(--color-tint);
}

.modal__hint {
  margin: 0;
  padding: 1.25rem;
  color: var(--color-muted);
}

.modal__list {
  margin: 0;
  padding: 0.5rem 0.75rem;
  overflow-y: auto;
  list-style: none;
}

.modal__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.5rem;
  border-radius: var(--radius-sm);
}

.modal__row:hover {
  background: var(--color-tint);
}

.modal__name {
  min-width: 0;
  overflow-wrap: anywhere;
}

.modal__added {
  flex: none;
  color: var(--color-accent-ink);
  font-size: 0.9rem;
  font-weight: 700;
}

.modal__add,
.modal__done {
  flex: none;
  padding: 0.3rem 0.9rem;
  color: var(--color-ink);
  background: var(--color-surface);
  border: 1px solid var(--color-border-strong);
  border-radius: 999px;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.modal__done {
  color: var(--color-on-primary);
  background: var(--color-primary);
  border-color: var(--color-primary);
}

.modal__add:hover {
  background: var(--color-tint);
}

.modal__done:hover {
  background: var(--color-primary-hover);
}
</style>
