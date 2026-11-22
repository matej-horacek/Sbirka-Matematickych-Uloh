<script setup lang="ts">
import { subproblemLabel } from '../../lib/subproblemLabel'
import type { Block, ChapterRef, SubproblemDraft, TagRef } from '../../types'
import ProblemContentPreview from './ProblemContentPreview.vue'

defineProps<{
  title: string
  blocks: Block[]
  /** Subproblems (children of the set) shown below the main assignment. */
  subproblems?: SubproblemDraft[]
  /** Chapters and tags are shown as small labels under the content. */
  chapters?: ChapterRef[]
  tags?: TagRef[]
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

    <ol v-if="subproblems?.length" class="problem-card__subs">
      <li
        v-for="(sub, index) in subproblems"
        :key="sub.key"
        class="problem-card__sub"
      >
        <span class="problem-card__sub-label">{{ subproblemLabel(index) }}</span>

        <ProblemContentPreview :blocks="sub.assignment" />
      </li>
    </ol>

    <ul
      v-if="chapters?.length || tags?.length"
      class="problem-card__labels"
      aria-label="Zařazení úlohy"
    >
      <li
        v-for="chapter in chapters"
        :key="`c-${chapter.id}`"
        class="problem-card__label problem-card__label--chapter"
      >
        {{ chapter.name }}
      </li>

      <li
        v-for="tag in tags"
        :key="`t-${tag.id}`"
        class="problem-card__label"
      >
        #{{ tag.name }}
      </li>
    </ul>
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

.problem-card__labels {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.problem-card__label {
  padding: 0.1rem 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  color: var(--color-muted);
  font-size: 0.8rem;
}

.problem-card__label--chapter {
  background: var(--color-tint);
  color: var(--color-ink);
}

.problem-card__subs {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.problem-card__sub {
  display: flex;
  align-items: baseline;
  gap: 0.6rem;
  min-width: 0;
}

.problem-card__sub-label {
  flex-shrink: 0;
  font-weight: 700;
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