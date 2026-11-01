<script setup lang="ts">
import type { Block } from '../../types'
import ProblemContentPreview from './ProblemContentPreview.vue'

defineProps<{
  title: string
  blocks: Block[]
  selected?: boolean
}>()
</script>

<template>
  <article
    class="problem-card"
    :class="{ 'problem-card--selected': selected }"
  >
    <header class="problem-card__header">
      <span class="problem-card__title">
        {{ title }}
      </span>

      <div class="problem-card__tools">
        <slot name="actions" />
      </div>
    </header>

    <ProblemContentPreview
      v-if="blocks.length"
      :blocks="blocks"
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

.problem-card--selected {
  border-color: var(--color-focus);
  background: var(--color-tint);
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