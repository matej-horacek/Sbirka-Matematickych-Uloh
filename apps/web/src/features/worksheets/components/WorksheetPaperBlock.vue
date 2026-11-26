<script setup lang="ts">
import { computed } from 'vue'

import { blocksToMarkdown } from '@/features/editor/lib/blocksToMarkdown'
// Same relative route to shared/ as api/worksheetsApi.ts uses.
import MarkdownRender from '../../../../shared/ui/renderers/MarkdownRender.vue'

import type { PaperBlock } from '../lib/paper'
import type { WorksheetLayout } from '../types'

// One unbreakable piece of the printed sheet: the heading, or one problem.
// It is drawn twice: on the visible page and in the invisible copy that is measured.
const props = defineProps<{
  block: PaperBlock
  title: string
  layout: WorksheetLayout
}>()

// The one place that knows how MarkdownRender takes its text.
function markdownProps(source: string) {
  return { source }
}

const assignment = computed(() =>
  props.block.kind === 'problem' ? blocksToMarkdown(props.block.problem.assignment) : '',
)

const subproblems = computed(() =>
  props.block.kind === 'problem'
    ? props.block.problem.subproblems.map((sub) => blocksToMarkdown(sub.assignment))
    : [],
)

// a), b), c) ...
function letter(index: number): string {
  return index < 26 ? String.fromCharCode(97 + index) : String(index + 1)
}
</script>

<template>
  <header v-if="block.kind === 'heading'" class="block heading">
    <h2 v-if="layout.showTitle" class="heading__title" :class="{ 'heading__title--empty': !title.trim() }">
      {{ title.trim() || 'Název listu' }}
    </h2>

    <p v-if="layout.showStudentLine" class="heading__student">
      <span>Jméno:</span>
      <span class="heading__fill heading__fill--wide" />
      <span>Třída:</span>
      <span class="heading__fill" />
      <span>Datum:</span>
      <span class="heading__fill" />
    </p>
  </header>

  <section v-else class="block problem">
    <div class="problem__row">
      <span v-if="layout.numberProblems" class="problem__number">{{ block.number }}.</span>

      <div class="problem__text">
        <MarkdownRender v-bind="markdownProps(assignment)" />
      </div>
    </div>

    <ol
      v-if="subproblems.length > 0"
      class="problem__subs"
      :class="{ 'problem__subs--indented': layout.numberProblems }"
    >
      <li v-for="(text, index) in subproblems" :key="index" class="problem__sub">
        <span class="problem__letter">{{ letter(index) }})</span>

        <div class="problem__text">
          <MarkdownRender v-bind="markdownProps(text)" />
        </div>
      </li>
    </ol>
  </section>
</template>

<style scoped>
/* The gap below a block is padding, not margin, so the measured height includes it. */
.block {
  padding-bottom: var(--paper-gap);
}

/* ---------- heading ---------- */
.heading {
  padding-bottom: 1.4em;
}

.heading__title {
  margin: 0 0 0.9em;
  font-size: 1.5em;
  font-weight: 700;
  line-height: 1.2;
  text-align: center;
  overflow-wrap: anywhere;
}

/* The placeholder is a hint for the editor, not something to print. */
.heading__title--empty {
  color: #9aa5ab;
  font-weight: 400;
}

.heading__student {
  display: flex;
  align-items: flex-end;
  gap: 0.5em;
  margin: 0;
  white-space: nowrap;
}

.heading__fill {
  flex: 1 1 0;
  height: 1em;
  border-bottom: 1px solid currentColor;
}

.heading__fill--wide {
  flex-grow: 3;
}

/* ---------- problem ---------- */
.problem__row,
.problem__sub {
  display: flex;
  align-items: baseline;
  gap: 0.5em;
}

.problem__number {
  flex: none;
  min-width: 1.5em;
  font-weight: 700;
}

.problem__letter {
  flex: none;
  min-width: 1.2em;
}

.problem__text {
  flex: 1 1 auto;
  min-width: 0;
  overflow-wrap: anywhere;
}

.problem__subs {
  display: flex;
  flex-direction: column;
  gap: 0.35em;
  margin: 0.4em 0 0;
  padding: 0;
  list-style: none;
}

.problem__subs--indented {
  margin-left: 2em;
}

/* The rendered markdown: tight paragraphs, images never wider than the page. */
.problem__text :deep(p) {
  margin: 0 0 0.4em;
}

.problem__text :deep(p:last-child) {
  margin-bottom: 0;
}

.problem__text :deep(img) {
  max-width: 100%;
  height: auto;
}
</style>
