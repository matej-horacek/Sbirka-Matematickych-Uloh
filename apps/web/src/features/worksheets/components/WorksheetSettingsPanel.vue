<script setup lang="ts">
import type { ProblemEditorDraft } from '@/features/editor/types'

import {
  FONT_OPTIONS,
  FONT_SIZE_OPTIONS,
  SPACING_OPTIONS,
} from '../lib/worksheetOptions'
import type { WorksheetLayout } from '../types'
import WorksheetSegmented from './WorksheetSegmented.vue'
import WorksheetSwitch from './WorksheetSwitch.vue'

// The right panel: the order of the problems and how the sheet is typeset.
defineProps<{
  problems: ProblemEditorDraft[]
  pageCount: number
}>()

const emit = defineEmits<{
  move: [index: number, step: -1 | 1]
  remove: [index: number]
}>()

const layout = defineModel<WorksheetLayout>('layout', { required: true })

function set<K extends keyof WorksheetLayout>(key: K, value: WorksheetLayout[K]) {
  layout.value = { ...layout.value, [key]: value }
}
</script>

<template>
  <div class="panel">
    <section aria-labelledby="panel-problems">
      <div class="panel__heading">
        <h2 id="panel-problems">Úlohy v listu</h2>
        <span class="chip">{{ problems.length }}</span>
      </div>

      <p v-if="problems.length === 0" class="panel__hint">
        Zatím žádné. Přidejte je tlačítkem „Přidat úlohy“ nahoře.
      </p>

      <ol v-else class="outline">
        <li v-for="(problem, index) in problems" :key="problem.id ?? index" class="outline__row">
          <span class="outline__number">{{ index + 1 }}</span>
          <span class="outline__name" :title="problem.name">{{ problem.name || 'Bez názvu' }}</span>

          <span class="outline__actions">
            <button
              type="button"
              class="icon-btn"
              aria-label="Posunout výš"
              title="Posunout výš"
              :disabled="index === 0"
              @click="emit('move', index, -1)"
            >
              ▲
            </button>

            <button
              type="button"
              class="icon-btn"
              aria-label="Posunout níž"
              title="Posunout níž"
              :disabled="index === problems.length - 1"
              @click="emit('move', index, 1)"
            >
              ▼
            </button>

            <button
              type="button"
              class="icon-btn icon-btn--danger"
              aria-label="Odebrat z listu"
              title="Odebrat z listu"
              @click="emit('remove', index)"
            >
              ✕
            </button>
          </span>
        </li>
      </ol>
    </section>

    <section class="panel__fields" aria-labelledby="panel-layout">
      <div class="panel__heading">
        <h2 id="panel-layout">Vzhled stránky</h2>
      </div>

      <dl class="stat">
        <dt>Formát A4, počet stran</dt>
        <dd>{{ pageCount }}</dd>
      </dl>

      <WorksheetSegmented
        legend="Písmo"
        :options="FONT_OPTIONS"
        :model-value="layout.fontFamily"
        @update:model-value="set('fontFamily', $event)"
      />

      <WorksheetSegmented
        legend="Velikost písma"
        :options="FONT_SIZE_OPTIONS"
        :model-value="layout.fontSizePt"
        @update:model-value="set('fontSizePt', $event)"
      />

      <WorksheetSegmented
        legend="Mezery mezi úlohami"
        :options="SPACING_OPTIONS"
        :model-value="layout.spacing"
        @update:model-value="set('spacing', $event)"
      />

      <div class="panel__switches">
        <WorksheetSwitch
          :model-value="layout.showTitle"
          @update:model-value="set('showTitle', $event)"
        >
          Název listu nahoře
        </WorksheetSwitch>

        <WorksheetSwitch
          :model-value="layout.showStudentLine"
          @update:model-value="set('showStudentLine', $event)"
        >
          Řádek pro jméno, třídu a datum
        </WorksheetSwitch>

        <WorksheetSwitch
          :model-value="layout.numberProblems"
          @update:model-value="set('numberProblems', $event)"
        >
          Číslovat úlohy
        </WorksheetSwitch>
      </div>
    </section>
  </div>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
  padding: 1.25rem 1.25rem 2rem;
}

.panel__heading {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 0.75rem;
}

.panel__heading h2 {
  margin: 0;
  font-size: 1.05rem;
}

.panel__hint {
  margin: 0;
  color: var(--color-muted);
  font-size: 0.9rem;
}

.chip {
  padding: 0.05rem 0.65rem;
  background: var(--color-primary-soft);
  border-radius: 999px;
  font-size: 0.85rem;
  font-weight: 700;
}

/* ---------- order of the problems ---------- */
.outline {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  max-height: 16rem;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}

.outline__row {
  display: grid;
  grid-template-columns: 1.5rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.4rem;
  padding: 0.15rem 0.3rem;
  border-radius: var(--radius-sm);
}

.outline__row:hover {
  background: var(--color-tint);
}

.outline__number {
  color: var(--color-muted);
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.outline__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.outline__actions {
  display: flex;
}

.icon-btn {
  padding: 0.2rem 0.4rem;
  background: transparent;
  border: 0;
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  cursor: pointer;
}

.icon-btn:hover:not(:disabled) {
  background: var(--color-surface);
}

.icon-btn:disabled {
  color: var(--color-muted-soft);
  cursor: not-allowed;
}

.icon-btn--danger:hover:not(:disabled) {
  color: var(--color-danger);
  background: #fef2f2;
}

/* ---------- layout ---------- */
.panel__fields {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}

.panel__fields .panel__heading {
  margin-bottom: 0;
}

.panel__switches {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.stat {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  margin: 0;
  color: var(--color-muted);
  font-size: 0.9rem;
}

.stat dd {
  margin: 0;
  color: var(--color-ink);
  font-weight: 700;
}
</style>
