<script setup lang="ts">
import { computed, ref } from 'vue'
import type { FilterOption, TagMatchMode } from '../../lib/problemFilters'
import type { Sqid } from '../../types'

/**
 * Filter panel for the problem list. It only displays the options and reports
 * clicks; the state and the filtering itself live in useProblemFilters.
 */
const props = defineProps<{
  chapters: FilterOption[]
  tags: FilterOption[]
  selectedChapterIds: Sqid[]
  selectedTagIds: Sqid[]
  tagMode: TagMatchMode
}>()

const emit = defineEmits<{
  toggleChapter: [id: Sqid]
  toggleTag: [id: Sqid]
  'update:tagMode': [mode: TagMatchMode]
  clear: []
}>()

/** How many tags are shown before "Zobrazit všechny". */
const TAG_LIMIT = 12

const open = ref(false)
const showAllTags = ref(false)

const selectedChapters = computed(() => new Set(props.selectedChapterIds))
const selectedTags = computed(() => new Set(props.selectedTagIds))

const activeCount = computed(
  () => props.selectedChapterIds.length + props.selectedTagIds.length,
)

// Selected tags always stay visible, even when they would be cut off.
const visibleTags = computed(() =>
  showAllTags.value
    ? props.tags
    : props.tags.filter(
        (tag, index) => index < TAG_LIMIT || selectedTags.value.has(tag.id),
      ),
)

const hiddenTagCount = computed(() => props.tags.length - visibleTags.value.length)
const hasOptions = computed(() => props.chapters.length > 0 || props.tags.length > 0)
</script>

<template>
  <section class="problem-filters" aria-label="Filtrování úloh">
    <div class="problem-filters__bar">
      <button
        type="button"
        class="problem-filters__toggle"
        :aria-expanded="open"
        aria-controls="problem-filters-panel"
        @click="open = !open"
      >
        Filtry
        <span
          v-if="activeCount > 0"
          class="problem-filters__badge"
          :aria-label="`Aktivních filtrů: ${activeCount}`"
        >
          {{ activeCount }}
        </span>
        <span aria-hidden="true">{{ open ? '▴' : '▾' }}</span>
      </button>

      <button
        v-if="activeCount > 0"
        type="button"
        class="problem-filters__clear"
        @click="emit('clear')"
      >
        Zrušit filtry
      </button>
    </div>

    <div v-show="open" id="problem-filters-panel" class="problem-filters__panel">
      <p v-if="!hasOptions" class="problem-filters__hint">
        Vaše úlohy zatím nemají žádné okruhy ani štítky.
      </p>

      <div v-else class="problem-filters__grid">
        <!-- Chapters -->
        <div v-if="chapters.length" class="problem-filters__column">
          <h3 class="problem-filters__title">Okruhy</h3>

          <div class="problem-filters__tree">
            <label
              v-for="option in chapters"
              :key="option.id"
              class="problem-filters__row"
              :style="{ paddingLeft: `${option.depth * 18 + 6}px` }"
            >
              <input
                type="checkbox"
                :checked="selectedChapters.has(option.id)"
                @change="emit('toggleChapter', option.id)"
              />
              <span class="problem-filters__name">{{ option.name }}</span>
              <span class="problem-filters__count">{{ option.count }}</span>
            </label>
          </div>
        </div>

        <!-- Tags -->
        <div v-if="tags.length" class="problem-filters__column">
          <h3 class="problem-filters__title">Štítky</h3>

          <ul class="problem-filters__chips">
            <li v-for="tag in visibleTags" :key="tag.id">
              <button
                type="button"
                class="problem-filters__chip"
                :class="{ 'problem-filters__chip--active': selectedTags.has(tag.id) }"
                :aria-pressed="selectedTags.has(tag.id)"
                @click="emit('toggleTag', tag.id)"
              >
                #{{ tag.name }}
                <span class="problem-filters__count">{{ tag.count }}</span>
              </button>
            </li>
          </ul>

          <button
            v-if="hiddenTagCount > 0"
            type="button"
            class="problem-filters__more"
            @click="showAllTags = true"
          >
            Zobrazit všechny ({{ tags.length }})
          </button>

          <button
            v-else-if="showAllTags && tags.length > TAG_LIMIT"
            type="button"
            class="problem-filters__more"
            @click="showAllTags = false"
          >
            Zobrazit méně
          </button>

          <!-- Only meaningful with two or more selected tags. -->
          <div
            v-if="selectedTagIds.length >= 2"
            class="problem-filters__mode"
            role="group"
            aria-label="Způsob párování štítků"
          >
            <span class="problem-filters__hint">Příklad má:</span>

            <button
              type="button"
              class="problem-filters__mode-btn"
              :class="{ 'problem-filters__mode-btn--active': tagMode === 'any' }"
              :aria-pressed="tagMode === 'any'"
              @click="emit('update:tagMode', 'any')"
            >
              kterýkoli štítek
            </button>

            <button
              type="button"
              class="problem-filters__mode-btn"
              :class="{ 'problem-filters__mode-btn--active': tagMode === 'all' }"
              :aria-pressed="tagMode === 'all'"
              @click="emit('update:tagMode', 'all')"
            >
              všechny štítky
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.problem-filters {
  margin-bottom: 20px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.problem-filters__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px;
}

.problem-filters__toggle,
.problem-filters__clear,
.problem-filters__more {
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.problem-filters__toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}

.problem-filters__clear,
.problem-filters__more {
  color: var(--color-muted);
  font-size: 0.9rem;
  text-decoration: underline;
}

.problem-filters__badge {
  min-width: 1.4em;
  padding: 0 0.4em;
  border-radius: 999px;
  background: var(--color-tint);
  border: 1px solid var(--color-border-strong);
  font-size: 0.8rem;
  text-align: center;
}

.problem-filters__panel {
  padding: 4px 16px 16px;
  border-top: 1px solid var(--color-border);
}

.problem-filters__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 24px;
  padding-top: 12px;
}

.problem-filters__column {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  min-width: 0;
}

.problem-filters__title {
  margin: 0;
  font-size: 1rem;
}

.problem-filters__tree {
  align-self: stretch;
  max-height: 200px;
  overflow-y: auto;
  padding: 4px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.problem-filters__row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-block: 3px;
  cursor: pointer;
}

.problem-filters__name {
  min-width: 0;
  overflow-wrap: anywhere;
}

.problem-filters__count {
  margin-left: auto;
  color: var(--color-muted);
  font-size: 0.8rem;
}

.problem-filters__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.problem-filters__chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border: 1px solid var(--color-border-strong);
  border-radius: 999px;
  background: var(--color-surface);
  color: var(--color-ink);
  font: inherit;
  font-size: 0.9rem;
  cursor: pointer;
}

.problem-filters__chip:hover {
  background: var(--color-tint);
}

.problem-filters__chip--active {
  border-color: var(--color-focus);
  background: var(--color-tint);
  font-weight: 600;
}

.problem-filters__chip .problem-filters__count {
  margin-left: 0;
}

.problem-filters__mode {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.problem-filters__mode-btn {
  padding: 2px 10px;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-ink);
  font: inherit;
  font-size: 0.85rem;
  cursor: pointer;
}

.problem-filters__mode-btn--active {
  border-color: var(--color-focus);
  background: var(--color-tint);
  font-weight: 600;
}

.problem-filters__hint {
  margin: 0;
  color: var(--color-muted);
  font-size: 0.85rem;
}
</style>
