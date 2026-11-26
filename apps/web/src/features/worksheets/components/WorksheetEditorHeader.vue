<script setup lang="ts">
import { RouterLink } from 'vue-router'

import type { ChapterRef, TagRef } from '@/features/editor/types'

import { DIFFICULTY_LEVELS, difficultyLabel } from '../lib/worksheetOptions'
import WorksheetOptionSelect from './WorksheetOptionSelect.vue'
import WorksheetSwitch from './WorksheetSwitch.vue'

// The bar right under the navbar: name and save on top, what the worksheet is
// about (okruhy, štítky, obtížnost, publicita) and "Přidat úlohy" below.
defineProps<{
  isEditing: boolean
  isSaving: boolean
  /** False while the worksheet loads or when loading failed. */
  ready: boolean
  chapterOptions: ChapterRef[]
  tagOptions: TagRef[]
}>()

const emit = defineEmits<{
  save: []
  cancel: []
  addProblems: []
}>()

const name = defineModel<string>('name', { required: true })
const chapters = defineModel<ChapterRef[]>('chapters', { required: true })
const tags = defineModel<TagRef[]>('tags', { required: true })
const difficulty = defineModel<number | null>('difficulty', { required: true })
const isPublic = defineModel<boolean>('public', { required: true })

// Clicking the chosen level again clears it.
function pickDifficulty(level: number) {
  difficulty.value = difficulty.value === level ? null : level
}
</script>

<template>
  <header class="bar">
    <div class="bar__row">
      <RouterLink :to="{ name: 'worksheets' }" class="bar__back">← Listy</RouterLink>

      <h1 class="visually-hidden">{{ isEditing ? 'Upravit list' : 'Nový list' }}</h1>

      <input
        v-model="name"
        class="bar__name"
        type="text"
        maxlength="255"
        placeholder="Pojmenujte list, např. Kvadratické rovnice – opakování"
        aria-label="Název listu"
        autocomplete="off"
      />

      <div class="bar__actions">
        <button type="button" class="btn" @click="emit('cancel')">Zrušit</button>

        <button
          type="button"
          class="btn btn--primary"
          :disabled="isSaving || !ready"
          @click="emit('save')"
        >
          {{ isSaving ? 'Ukládám…' : 'Uložit list' }}
        </button>
      </div>
    </div>

    <div class="bar__row bar__row--meta">
      <WorksheetOptionSelect
        v-model="chapters"
        label="Okruhy"
        :options="chapterOptions"
        empty-text="Okruhy se nabízejí podle vašich úloh. Zatím žádné nemáte."
      />

      <WorksheetOptionSelect
        v-model="tags"
        label="Štítky"
        :options="tagOptions"
        empty-text="Štítky se nabízejí podle vašich úloh. Zatím žádné nemáte."
      />

      <div class="difficulty" role="radiogroup" aria-label="Obtížnost">
        <span class="difficulty__label">Obtížnost</span>

        <button
          v-for="level in DIFFICULTY_LEVELS"
          :key="level"
          type="button"
          role="radio"
          class="difficulty__dot"
          :class="{ 'difficulty__dot--on': difficulty !== null && level <= difficulty }"
          :aria-checked="difficulty === level"
          :aria-label="difficultyLabel(level)"
          :title="difficultyLabel(level)"
          @click="pickDifficulty(level)"
        />

        <span class="difficulty__value">{{ difficultyLabel(difficulty) }}</span>
      </div>

      <WorksheetSwitch v-model="isPublic">
        {{ isPublic ? 'Veřejný' : 'Soukromý' }}
      </WorksheetSwitch>

      <button type="button" class="add-btn" :disabled="!ready" @click="emit('addProblems')">
        <span class="add-btn__icon" aria-hidden="true">
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
            <path d="M8 2.5v11M2.5 8h11" />
          </svg>
        </span>
        Přidat úlohy
      </button>
    </div>
  </header>
</template>

<style scoped>
.bar {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0.7rem clamp(1rem, 3vw, 2rem) 0.8rem;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  box-shadow: var(--shadow-card);
}

.bar__row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}

.bar__row--meta {
  flex-wrap: wrap;
  gap: 0.6rem 1.25rem;
}

.bar__back {
  flex: none;
  color: var(--color-accent-ink);
  font-weight: 600;
  text-decoration: none;
}

.bar__back:hover {
  text-decoration: underline;
}

/* The name reads like a document title and only looks like a field on hover and focus. */
.bar__name {
  flex: 1 1 auto;
  min-width: 0;
  padding: 0.3rem 0.6rem;
  color: var(--color-ink);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  font: inherit;
  font-size: 1.3rem;
  font-weight: 600;
}

.bar__name::placeholder {
  color: var(--color-muted);
  font-weight: 400;
}

.bar__name:hover {
  border-color: var(--color-border);
}

.bar__name:focus-visible {
  background: var(--color-surface);
  border-color: var(--color-primary);
  outline: none;
  box-shadow: 0 0 0 3px var(--color-primary-soft);
}

.bar__actions {
  display: flex;
  flex: none;
  gap: 0.5rem;
}

/* ---------- buttons ---------- */
.btn {
  padding: 0.5rem 1.1rem;
  color: var(--color-ink);
  background: var(--color-surface);
  border: 1px solid var(--color-border-strong);
  border-radius: 999px;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.btn:hover:not(:disabled) {
  background: var(--color-tint);
}

.btn--primary {
  color: var(--color-on-primary);
  background: var(--color-primary);
  border-color: var(--color-primary);
}

.btn--primary:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.btn:disabled {
  color: var(--color-muted-soft);
  cursor: not-allowed;
}

/* ---------- difficulty ---------- */
.difficulty {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.difficulty__label {
  margin-right: 0.15rem;
  font-weight: 700;
}

.difficulty__dot {
  width: 1.05rem;
  height: 1.05rem;
  padding: 0;
  background: var(--color-surface);
  border: 2px solid var(--color-border-strong);
  border-radius: 50%;
  cursor: pointer;
}

.difficulty__dot:hover {
  border-color: var(--color-primary);
}

.difficulty__dot--on {
  background: var(--color-primary);
  border-color: var(--color-primary);
}

.difficulty__dot:focus-visible {
  outline: 2px solid var(--color-accent-ink);
  outline-offset: 2px;
}

.difficulty__value {
  min-width: 5.5rem;
  color: var(--color-muted);
  font-size: 0.9rem;
}

/* ---------- "Přidat úlohy": the one loud thing in the bar ---------- */
.add-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  margin-left: auto;
  padding: 0.6rem 1.35rem 0.6rem 0.8rem;
  color: var(--color-on-primary);
  background-color: var(--color-primary);
  background-image: linear-gradient(135deg, rgba(255, 255, 255, 0.4), rgba(255, 255, 255, 0) 55%);
  border: 0;
  border-radius: 999px;
  box-shadow:
    0 6px 16px color-mix(in srgb, var(--color-primary) 55%, transparent),
    inset 0 -2px 0 rgba(0, 0, 0, 0.12);
  font: inherit;
  font-size: 1.05rem;
  font-weight: 800;
  cursor: pointer;
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease;
}

.add-btn:hover:not(:disabled) {
  box-shadow:
    0 10px 24px color-mix(in srgb, var(--color-primary) 65%, transparent),
    inset 0 -2px 0 rgba(0, 0, 0, 0.12);
  transform: translateY(-2px);
}

.add-btn:active:not(:disabled) {
  transform: translateY(0);
}

.add-btn:focus-visible {
  outline: 3px solid var(--color-accent-ink);
  outline-offset: 3px;
}

.add-btn:disabled {
  opacity: 0.55;
  box-shadow: none;
  cursor: not-allowed;
}

.add-btn__icon {
  display: grid;
  place-items: center;
  width: 1.7rem;
  height: 1.7rem;
  color: var(--color-accent-ink);
  background: #fff;
  border-radius: 50%;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 700px) {
  .bar__row:first-child {
    flex-wrap: wrap;
  }

  .add-btn {
    margin-left: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .add-btn {
    transition: none;
  }

  .add-btn:hover:not(:disabled) {
    transform: none;
  }
}
</style>
