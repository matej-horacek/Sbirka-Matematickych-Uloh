<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useCategoriesStore } from '../../stores/categoriesStore'
import type { ChapterRef, TagRef } from '../../types'

/**
 * Puts a problem into chapters (okruhy) and gives it tags (štítky).
 * Only existing ones can be chosen: the API has no way to create new ones.
 * Subproblems inherit both from the main problem.
 */
const props = defineProps<{
  chapters: ChapterRef[]
  tags: TagRef[]
  /** Show the note that subproblems inherit the categories. */
  hasSubproblems?: boolean
}>()

const emit = defineEmits<{
  'update:chapters': [value: ChapterRef[]]
  'update:tags': [value: TagRef[]]
}>()

const categories = useCategoriesStore()

onMounted(() => {
  void categories.load()
})

const chapterFilter = ref('')
const tagFilter = ref('')

function normalize(text: string): string {
  // Compare without diacritics and case: "ro" finds "Rovnice", "zlomky" finds "Zlomky".
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

const selectedChapterIds = computed(() => new Set(props.chapters.map((c) => c.id)))
const selectedTagIds = computed(() => new Set(props.tags.map((t) => t.id)))

// Tree rows that match the filter, together with their parents (so the path stays visible).
const visibleChapterRows = computed(() => {
  const query = normalize(chapterFilter.value.trim())
  const rows = categories.chapterRows

  if (!query) return rows

  const keep = new Set<string>()

  rows.forEach((row, index) => {
    if (!normalize(row.chapter.name).includes(query)) return

    keep.add(row.chapter.id)

    // Walk up to the parents: the closest earlier row with a smaller depth.
    let depth = row.depth

    for (let i = index - 1; i >= 0 && depth > 0; i--) {
      const earlier = rows[i]

      if (earlier && earlier.depth < depth) {
        keep.add(earlier.chapter.id)
        depth = earlier.depth
      }
    }
  })

  return rows.filter((row) => keep.has(row.chapter.id))
})

const suggestedTags = computed(() => {
  const query = normalize(tagFilter.value.trim())

  return categories.tags
    .filter((tag) => !selectedTagIds.value.has(tag.id))
    .filter((tag) => !query || normalize(tag.name).includes(query))
    .slice(0, 12)
})

function toggleChapter(chapter: ChapterRef) {
  const { id, name, scope } = chapter

  emit(
    'update:chapters',
    selectedChapterIds.value.has(id)
      ? props.chapters.filter((item) => item.id !== id)
      : [...props.chapters, { id, name, scope }],
  )
}

function addTag(tag: TagRef) {
  emit('update:tags', [...props.tags, { id: tag.id, name: tag.name, scope: tag.scope }])
  tagFilter.value = ''
}

function removeTag(id: string) {
  emit(
    'update:tags',
    props.tags.filter((tag) => tag.id !== id),
  )
}

function removeChapter(id: string) {
  emit(
    'update:chapters',
    props.chapters.filter((chapter) => chapter.id !== id),
  )
}
</script>

<template>
  <section class="category-picker" aria-label="Zařazení příkladu">
    <p
      v-if="categories.status === 'error'"
      class="category-error"
      role="alert"
    >
      {{ categories.error }}
      <button type="button" @click="categories.load(true)">Zkusit znovu</button>
    </p>

    <div class="category-grid">
      <!-- Chapters -->
      <div class="category-column">
        <h3 class="category-title">Okruhy</h3>

        <ul v-if="chapters.length" class="chip-list">
          <li v-for="chapter in chapters" :key="chapter.id" class="chip">
            {{ chapter.name }}
            <button
              type="button"
              :aria-label="`Odebrat okruh ${chapter.name}`"
              @click="removeChapter(chapter.id)"
            >
              ✕
            </button>
          </li>
        </ul>

        <input
          v-model="chapterFilter"
          type="search"
          class="category-input"
          placeholder="Hledat okruh…"
          aria-label="Hledat okruh"
        />

        <div class="chapter-tree">
          <p v-if="categories.status === 'loading'" class="category-hint">
            Načítám okruhy…
          </p>

          <p
            v-else-if="visibleChapterRows.length === 0"
            class="category-hint"
          >
            Žádný okruh nenalezen.
          </p>

          <label
            v-for="row in visibleChapterRows"
            :key="row.chapter.id"
            class="chapter-row"
            :style="{ paddingLeft: `${row.depth * 18 + 6}px` }"
          >
            <input
              type="checkbox"
              :checked="selectedChapterIds.has(row.chapter.id)"
              @change="toggleChapter(row.chapter)"
            />
            {{ row.chapter.name }}
          </label>
        </div>
      </div>

      <!-- Tags -->
      <div class="category-column">
        <h3 class="category-title">Štítky</h3>

        <ul v-if="tags.length" class="chip-list">
          <li v-for="tag in tags" :key="tag.id" class="chip">
            {{ tag.name }}
            <button
              type="button"
              :aria-label="`Odebrat štítek ${tag.name}`"
              @click="removeTag(tag.id)"
            >
              ✕
            </button>
          </li>
        </ul>

        <input
          v-model="tagFilter"
          type="search"
          class="category-input"
          placeholder="Hledat štítek…"
          aria-label="Hledat štítek"
        />

        <ul class="chip-list chip-list--suggest">
          <li v-for="tag in suggestedTags" :key="tag.id">
            <button type="button" class="chip chip--add" @click="addTag(tag)">
              + {{ tag.name }}
            </button>
          </li>
        </ul>

        <p
          v-if="
            categories.status === 'ready' &&
            suggestedTags.length === 0 &&
            tagFilter.trim()
          "
          class="category-hint"
        >
          Takový štítek neexistuje. Vybírat lze jen z existujících štítků.
        </p>
      </div>
    </div>

    <p v-if="hasSubproblems" class="category-hint">
      Podúlohy mají stejné okruhy a štítky jako hlavní příklad.
    </p>
  </section>
</template>

<style scoped>
.category-picker {
  padding: 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.category-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 24px;
}

.category-column {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.category-title {
  margin: 0;
  font-size: 1rem;
}

.category-input {
  box-sizing: border-box;
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-ink);
  font: inherit;
}

.chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border: 1px solid var(--color-border-strong);
  border-radius: 999px;
  background: var(--color-tint);
  color: var(--color-ink);
  font-size: 0.9rem;
}

.chip button {
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  cursor: pointer;
}

.chip--add {
  background: var(--color-surface);
  cursor: pointer;
}

.chip--add:hover {
  background: var(--color-tint);
}

.chapter-tree {
  max-height: 200px;
  overflow-y: auto;
  padding: 4px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.chapter-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-block: 3px;
  cursor: pointer;
}

.category-hint {
  margin: 4px 0 0;
  color: var(--color-muted);
  font-size: 0.85rem;
}

.category-error {
  color: var(--color-danger);
}
</style>
