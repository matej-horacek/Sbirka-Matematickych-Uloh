<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import ProblemCard from '@/features/editor/components/list/ProblemCard.vue'
import ProblemFilters from '@/features/editor/components/list/ProblemFilters.vue'
import { useProblemFilters } from '@/features/editor/composables/useProblemFilters'
import { blocksToMarkdown } from '@/features/editor/lib/blocksToMarkdown'
import { cloneDraft } from '@/features/editor/lib/cloneDraft'
import { useUserProblemsStore } from '@/features/editor/stores/userProblems'
import type { ProblemEditorDraft } from '@/features/editor/types'

import { saveWorksheet } from '../api/saveWorksheet'
import { toWorksheetDraft, worksheetsApi } from '../api/worksheetsApi'
import { createEmptyWorksheetDraft } from '../lib/createEmptyWorksheetDraft'
import type { WorksheetDraft } from '../types'

// /catalog/worksheets/editor      -> a new worksheet
// /catalog/worksheets/editor/:id  -> edit an existing one
const props = defineProps<{ id?: string }>()

const router = useRouter()
const userProblems = useUserProblemsStore()

const draft = reactive<WorksheetDraft>(createEmptyWorksheetDraft())
const loadStatus = ref<'loading' | 'ready' | 'error'>('ready')
const loadError = ref<string | null>(null)
const saveError = ref<string | null>(null)
const isSaving = ref(false)
const search = ref('')

const isEditing = computed(() => props.id !== undefined)

async function loadWorksheet(id: string | undefined) {
  saveError.value = null
  loadError.value = null

  if (!id) {
    Object.assign(draft, createEmptyWorksheetDraft())
    loadStatus.value = 'ready'
    return
  }

  loadStatus.value = 'loading'

  try {
    Object.assign(draft, toWorksheetDraft(await worksheetsApi.get(id)))
    loadStatus.value = 'ready'
  } catch (error) {
    loadStatus.value = 'error'
    loadError.value = error instanceof Error ? error.message : 'List se nepodařilo načíst.'
  }
}

watch(() => props.id, (id) => void loadWorksheet(id), { immediate: true })

onMounted(() => {
  // The picker offers the user's own problems.
  void userProblems.fetchAll()
})

// ---------- the picker (right column) ----------

const {
  state: filterState,
  chapterOptions,
  tagOptions,
  filtered: filteredProblems,
  toggleChapter,
  toggleTag,
  setTagMode,
  clearFilters,
} = useProblemFilters(computed(() => userProblems.problems))

const pickedIds = computed(() => new Set(draft.problems.map((problem) => problem.id)))

// Chapter/tag filters first, then the text search.
const pickable = computed(() => {
  const query = search.value.trim().toLowerCase()
  if (!query) return filteredProblems.value

  return filteredProblems.value.filter((problem) => {
    const text = [
      problem.name,
      blocksToMarkdown(problem.assignment),
      ...problem.subproblems.map((sub) => blocksToMarkdown(sub.assignment)),
      ...problem.chapters.map((chapter) => chapter.name),
      ...problem.tags.map((tag) => tag.name),
    ]
      .join('\n')
      .toLowerCase()

    return text.includes(query)
  })
})

// ---------- the worksheet content (left column) ----------

function addProblem(problem: ProblemEditorDraft) {
  if (problem.id === null || pickedIds.value.has(problem.id)) return

  // A copy, so that the worksheet never shares objects with the problem store.
  draft.problems.push(cloneDraft(problem))
}

function removeProblem(index: number) {
  draft.problems.splice(index, 1)
}

function moveProblem(index: number, step: -1 | 1) {
  const target = index + step
  const moved = draft.problems[index]

  if (!moved || target < 0 || target >= draft.problems.length) return

  draft.problems.splice(index, 1)
  draft.problems.splice(target, 0, moved)
}

// ---------- saving ----------

async function save() {
  if (isSaving.value) return

  saveError.value = null

  if (!draft.name.trim()) {
    saveError.value = 'Zadejte název listu.'
    return
  }

  isSaving.value = true

  try {
    await saveWorksheet(draft)
    await router.push({ name: 'catalog-worksheets' })
  } catch (error) {
    saveError.value = error instanceof Error ? error.message : 'List se nepodařilo uložit.'
  } finally {
    isSaving.value = false
  }
}

function cancel() {
  void router.push({ name: 'catalog-worksheets' })
}
</script>

<template>
  <main class="ws-editor">
    <header class="ws-editor__header">
      <div>
        <RouterLink :to="{ name: 'catalog-worksheets' }" class="ws-editor__back">
          ← Zpět na listy
        </RouterLink>
        <h1>{{ isEditing ? 'Upravit list' : 'Nový list' }}</h1>
      </div>

      <div class="ws-editor__actions">
        <button type="button" class="btn" @click="cancel">Zrušit</button>

        <button
          type="button"
          class="btn btn--primary"
          :disabled="isSaving || loadStatus !== 'ready'"
          @click="save"
        >
          {{ isSaving ? 'Ukládám…' : 'Uložit list' }}
        </button>
      </div>
    </header>

    <p v-if="loadStatus === 'loading'" class="ws-editor__hint">Načítám list...</p>

    <p v-else-if="loadStatus === 'error'" class="ws-editor__hint" role="alert">
      {{ loadError }}
    </p>

    <template v-else>
      <p v-if="saveError" class="ws-editor__error" role="alert">
        {{ saveError }}
      </p>

      <section class="ws-editor__meta" aria-label="Název listu">
        <div class="field">
          <label for="worksheet-name">Název listu</label>
          <input
            id="worksheet-name"
            v-model="draft.name"
            type="text"
            maxlength="255"
            placeholder="Například: Kvadratické rovnice – opakování"
            autocomplete="off"
          />
        </div>
      </section>

      <div class="ws-editor__columns">
        <!-- ===== the worksheet ===== -->
        <section class="column" aria-label="Obsah listu">
          <div class="column__heading">
            <h2>Obsah listu</h2>
            <span class="count-chip">{{ draft.problems.length }}</span>
          </div>

          <p v-if="draft.problems.length === 0" class="ws-editor__hint">
            List je zatím prázdný. Přidejte úlohy z nabídky vedle.
          </p>

          <ol v-else class="column__list">
            <li v-for="(problem, index) in draft.problems" :key="problem.id ?? index">
              <ProblemCard
                :title="`${index + 1}. ${problem.name || 'Bez názvu'}`"
                :blocks="problem.assignment"
                :subproblems="problem.subproblems"
                :chapters="problem.chapters"
                :tags="problem.tags"
              >
                <template #actions>
                  <button
                    type="button"
                    class="icon-btn"
                    aria-label="Posunout výš"
                    title="Posunout výš"
                    :disabled="index === 0"
                    @click="moveProblem(index, -1)"
                  >
                    ▲
                  </button>

                  <button
                    type="button"
                    class="icon-btn"
                    aria-label="Posunout níž"
                    title="Posunout níž"
                    :disabled="index === draft.problems.length - 1"
                    @click="moveProblem(index, 1)"
                  >
                    ▼
                  </button>

                  <button
                    type="button"
                    class="icon-btn icon-btn--danger"
                    aria-label="Odebrat z listu"
                    title="Odebrat z listu"
                    @click="removeProblem(index)"
                  >
                    ✕
                  </button>
                </template>
              </ProblemCard>
            </li>
          </ol>
        </section>

        <!-- ===== the problem picker ===== -->
        <section class="column" aria-label="Nabídka úloh">
          <div class="column__heading">
            <h2>Moje úlohy</h2>
            <span class="count-chip">{{ pickable.length }}</span>

            <input
              v-model="search"
              type="search"
              class="column__search"
              placeholder="Hledat v úlohách"
              aria-label="Hledat v úlohách"
            />
          </div>

          <ProblemFilters
            v-if="userProblems.items.length > 0"
            :chapters="chapterOptions"
            :tags="tagOptions"
            :selected-chapter-ids="filterState.chapterIds"
            :selected-tag-ids="filterState.tagIds"
            :tag-mode="filterState.tagMode"
            @toggle-chapter="toggleChapter"
            @toggle-tag="toggleTag"
            @update:tag-mode="setTagMode"
            @clear="clearFilters"
          />

          <p v-if="userProblems.status === 'loading'" class="ws-editor__hint">
            Načítám úlohy...
          </p>

          <p v-else-if="userProblems.status === 'error'" class="ws-editor__hint" role="alert">
            {{ userProblems.error }}
          </p>

          <p v-else-if="userProblems.items.length === 0" class="ws-editor__hint">
            Zatím nemáte žádné úlohy.
            <RouterLink to="/editor">Vytvořte první v Moje sbírka.</RouterLink>
          </p>

          <p v-else-if="pickable.length === 0" class="ws-editor__hint">Nic nenalezeno.</p>

          <ul v-else class="column__list column__list--scroll">
            <li v-for="problem in pickable" :key="problem.id ?? problem.name">
              <ProblemCard
                :title="problem.name || 'Bez názvu'"
                :blocks="problem.assignment"
                :subproblems="problem.subproblems"
                :chapters="problem.chapters"
                :tags="problem.tags"
                :selected="pickedIds.has(problem.id)"
              >
                <template #actions>
                  <span v-if="pickedIds.has(problem.id)" class="added-label">✓ V listu</span>

                  <button
                    v-else
                    type="button"
                    class="btn btn--small"
                    @click="addProblem(problem)"
                  >
                    + Přidat
                  </button>
                </template>
              </ProblemCard>
            </li>
          </ul>
        </section>
      </div>
    </template>
  </main>
</template>

<style scoped>
.ws-editor {
  width: min(84rem, 100%);
  box-sizing: border-box;
  margin: 0 auto;
  padding: 1.5rem clamp(1rem, 3vw, 2rem) 3rem;
}

.ws-editor__header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.ws-editor__header h1 {
  margin: 0.25rem 0 0;
}

.ws-editor__back {
  color: var(--color-accent-ink);
  font-size: 0.9rem;
  text-decoration: none;
}

.ws-editor__back:hover {
  text-decoration: underline;
}

.ws-editor__actions {
  display: flex;
  gap: 0.5rem;
}

.ws-editor__hint {
  color: var(--color-muted);
}

.ws-editor__error {
  margin: 0 0 1rem;
  padding: 0.75rem 1rem;
  color: #991b1b;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: var(--radius-sm);
  font-weight: 600;
}

/* ---------- name ---------- */
.ws-editor__meta {
  display: grid;
  gap: 1rem;
  margin-bottom: 1.5rem;
  padding: 1.25rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.field label {
  font-weight: 600;
}

.field input {
  box-sizing: border-box;
  width: 100%;
  padding: 0.5rem 0.75rem;
  color: var(--color-ink);
  background: var(--color-surface);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  font: inherit;
}

/* ---------- two columns ---------- */
.ws-editor__columns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1.5rem;
  align-items: start;
}

.column {
  min-width: 0;
}

.column__heading {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.column__heading h2 {
  margin: 0;
  font-size: 1.25rem;
}

.column__search {
  flex: 1 1 10rem;
  min-width: 0;
  min-height: 2.25rem;
  box-sizing: border-box;
  margin-left: auto;
  padding: 0.25rem 1rem;
  color: var(--color-ink);
  background: var(--color-surface);
  border: 1px solid var(--color-border-strong);
  border-radius: 999px;
  font: inherit;
}

.column__list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

/* The catalog scrolls on its own, so the worksheet stays in view while picking. */
.column__list--scroll {
  max-height: calc(100vh - 14rem);
  padding: 0.25rem 0.25rem 0.25rem 0;
  overflow-y: auto;
}

.count-chip {
  padding: 0.05rem 0.65rem;
  background: var(--color-primary-soft);
  border-radius: 999px;
  font-size: 0.85rem;
  font-weight: 700;
}

.added-label {
  color: var(--color-accent-ink);
  font-size: 0.9rem;
  font-weight: 700;
  white-space: nowrap;
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

.btn--small {
  padding: 0.25rem 0.8rem;
  font-size: 0.9rem;
}

.btn:disabled {
  color: var(--color-muted-soft);
  cursor: not-allowed;
}

.icon-btn {
  padding: 0.2rem 0.45rem;
  background: transparent;
  border: 0;
  border-radius: var(--radius-sm);
  font-size: 0.95rem;
  cursor: pointer;
}

.icon-btn:hover:not(:disabled) {
  background: var(--color-tint);
}

.icon-btn:disabled {
  color: var(--color-muted-soft);
  cursor: not-allowed;
}

.icon-btn--danger:hover:not(:disabled) {
  color: var(--color-danger);
  background: #fef2f2;
}

@media (max-width: 900px) {
  .ws-editor__columns {
    grid-template-columns: minmax(0, 1fr);
  }

  .column__list--scroll {
    max-height: 70vh;
  }
}
</style>
