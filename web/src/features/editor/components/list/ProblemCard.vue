
<script setup lang="ts">
import type { WorksheetProblem } from '../../types'
import ProblemContentPreview from './ProblemContentPreview.vue'

defineProps<{
  item: WorksheetProblem
  index: number
  total: number
}>()

const emit = defineEmits<{
  edit: []
  move: [direction: -1 | 1]
}>()
</script>

<template>
  <article class="problem-card">
    <header class="problem-card__header">
      <span class="problem-card__title">
        Příklad {{ index + 1 }}
      </span>

      <div class="problem-card__tools">
        <button
          type="button"
          class="icon-btn"
          aria-label="Posunout příklad nahoru"
          title="Posunout nahoru"
          :disabled="index === 0"
          @click="emit('move', -1)"
        >
          ↑
        </button>

        <button
          type="button"
          class="icon-btn"
          aria-label="Posunout příklad dolů"
          title="Posunout dolů"
          :disabled="index === total - 1"
          @click="emit('move', 1)"
        >
          ↓
        </button>

        <button
          type="button"
          class="icon-btn"
          aria-label="Upravit příklad"
          title="Upravit příklad"
          @click="emit('edit')"
        >
          ✎
        </button>
      </div>
    </header>

    <ProblemContentPreview
      v-if="item.assignment.length"
      :blocks="item.assignment"
    />

    <p v-else class="problem-card__empty">
      Zadání zatím neobsahuje žádné bloky.
    </p>
  </article>
</template>

<style scoped>
.problem-card {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.75rem;

  width: 100%;
  min-width: 0;
  box-sizing: border-box;

  padding: 1.25rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.problem-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  width: 100%;
  min-width: 0;
}

.problem-card__title {
  min-width: 0;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.problem-card__tools {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 0.15rem;
}

.icon-btn {
  display: grid;
  place-items: center;
  min-width: 2rem;
  min-height: 2rem;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-ink);
  font: inherit;
  font-size: 1.5rem;
  cursor: pointer;
}

.icon-btn:hover:not(:disabled) {
  background: var(--color-tint);
}

.icon-btn:disabled {
  color: var(--color-muted-soft);
  cursor: not-allowed;
}

.problem-card :deep(img) {
  max-width: 100%;
  height: auto;
}

.problem-card :deep(pre) {
  max-width: 100%;
  overflow-x: auto;
}

.problem-card :deep(*) {
  min-width: 0;
}

.problem-card__empty {
  margin: 0;
  color: var(--color-muted);
  font-size: 0.9rem;
}

@media (max-width: 600px) {
  .problem-card {
    padding: 1rem;
  }

  .problem-card__header {
    align-items: flex-start;
  }
}
</style>