<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import ProblemCard from '../components/list/ProblemCard.vue'
import ProblemFilters from '../components/list/ProblemFilters.vue'
import ProblemEditDialog from '../components/edit/ProblemEditDialog.vue'
import ProblemEditForm from '../components/edit/ProblemEditForm.vue'

import { useProblemFilters } from '../composables/useProblemFilters'
import { useEditorStore } from '../stores/editorStore'
import { useUserProblemsStore } from '../stores/userProblems'

import { blocksToMarkdown } from '../lib/blocksToMarkdown'
import { cloneDraft } from '../lib/cloneDraft'
import { createEmptyProblemDraft } from '../lib/createEmptyProblemDraft'

import type { Sqid } from '../types'

const editorStore = useEditorStore()
const userProblems = useUserProblemsStore()

const isProblemEditorOpen = ref(false)
const triedToSave = ref(false)
const saveError = ref<string | null>(null)
const isSaving = ref(false)
const search = ref('')

onMounted(() => {
  void userProblems.fetchAll()
})

// Filtering by chapters and tags. The options are built from all problems.
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

// Chapter/tag filters first, then the text search by name and assignment content.
const problems = computed(() => {
  const query = search.value.trim().toLowerCase()

  if (!query) return filteredProblems.value

  return filteredProblems.value.filter((problem) => {
    const name = problem.name?.toLowerCase() ?? ''
    const assignment = [
      blocksToMarkdown(problem.assignment),
      ...problem.subproblems.map((sub) => blocksToMarkdown(sub.assignment)),
    ]
      .join('\n')
      .toLowerCase()

    const categories = [...problem.chapters, ...problem.tags]
      .map((item) => item.name)
      .join('\n')
      .toLowerCase()

    return (
      name.includes(query) ||
      assignment.includes(query) ||
      categories.includes(query)
    )
  })
})

// Existing problems have a Sqid.
const isEditing = computed(
  () => editorStore.problem?.id != null,
)

const dialogTitle = computed(() =>
  isEditing.value ? 'Upravit úlohu' : 'Nová úloha',
)

// Initialize a completely new editor draft.
function createProblem() {
  triedToSave.value = false
  saveError.value = null

  // Important: initialize ALL required fields.
  editorStore.loadProblem(createEmptyProblemDraft())

  isProblemEditorOpen.value = true
}

// Load an existing problem.
function editProblem(id: Sqid) {
  const item = userProblems.problemById(id)

  if (!item) return

  editorStore.loadProblem(
    cloneDraft(item),
  )

  triedToSave.value = false
  saveError.value = null

  isProblemEditorOpen.value = true
}

// Save a new or existing problem.
async function saveProblem() {
  if (isSaving.value) return

  triedToSave.value = true
  saveError.value = null

  const draft = editorStore.problem

  if (!draft) return

  // Validate the name before sending anything to the backend.
  const name = draft.name?.trim()

  if (!name) {
    saveError.value = 'Zadejte název úlohy.'
    return
  }

  // Check the remaining editor validation.
  if (editorStore.errors.length > 0) return

  const problemToSave = cloneDraft(draft)

  // Normalize the name.
  problemToSave.name = name

  isSaving.value = true

  try {
    // Main problem + subproblems. Every subproblem is a problem of its own,
    // linked to the main problem through the /children endpoints
    // (see saveProblemSet).
    await userProblems.save(problemToSave)

    closeEditor()
  } catch (error) {
    // A save can fail half way (the main problem exists, a subproblem does
    // not). Keep what the backend already created, so a retry continues
    // instead of creating everything again.
    editorStore.applySavedIds(problemToSave)
    void userProblems.fetchAll()

    saveError.value =
      error instanceof Error
        ? error.message
        : 'Úlohu se nepodařilo uložit.'
  } finally {
    isSaving.value = false
  }
}

// Close the editor and reset its state.
function closeEditor() {
  isProblemEditorOpen.value = false
  triedToSave.value = false
  saveError.value = null

  editorStore.$patch({
    problem: null,
    isSaved: true,
  })
}

// Delete an existing problem.
async function deleteProblem(id: Sqid) {
  const subCount = userProblems.problemById(id)?.subproblems.length ?? 0

  const message = subCount > 0
    ? `Opravdu chcete úlohu smazat? Smažou se i jeho podúlohy (${subCount}).`
    : 'Opravdu chcete úlohu smazat?'

  if (!window.confirm(message)) {
    return
  }

  try {
    await userProblems.remove(id)
  } catch (error) {
    window.alert(
      error instanceof Error
        ? error.message
        : 'Úlohu se nepodařilo smazat.',
    )
  }
}
</script>

<template>
  <main class="page">
    <header class="page-header">
      <h1>Moje úlohy</h1>
    </header>

    <section>
      <div class="section-heading">
        <h2>Úlohy</h2>

        <span class="count-chip">
          {{ problems.length }}
        </span>

        <input
          v-model="search"
          type="search"
          class="text-input search"
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

      <div class="card-list">
        <button
          type="button"
          class="add-card"
          @click="createProblem"
        >
          <span
            class="add-card__plus"
            aria-hidden="true"
          />

          Přidejte úlohu
        </button>

        <p
          v-if="userProblems.status === 'loading'"
          class="empty-hint"
        >
          Načítám úlohy...
        </p>

        <p
          v-else-if="userProblems.status === 'error'"
          class="empty-hint"
          role="alert"
        >
          {{ userProblems.error }}
        </p>

        <p
          v-else-if="userProblems.items.length === 0"
          class="empty-hint"
        >
          Zatím tu nemáte žádnou Úlohu. Přidejte první.
        </p>

        <p
          v-else-if="problems.length === 0"
          class="empty-hint"
        >
          Nic nenalezeno.
        </p>

        <ProblemCard
          v-for="problem in problems"
          :key="problem.id ?? problem.name"
          :title="problem.name || 'Bez názvu'"
          :blocks="problem.assignment"
          :subproblems="problem.subproblems"
          :chapters="problem.chapters"
          :tags="problem.tags"
        >
          <template #actions>
            <button
              v-if="problem.id != null"
              type="button"
              class="icon-btn"
              aria-label="Upravit úlohu"
              title="Upravit úlohu"
              @click="editProblem(problem.id)"
            >
              ✎
            </button>

            <button
              v-if="problem.id != null"
              type="button"
              class="icon-btn icon-btn--danger"
              aria-label="Smazat úlohu"
              title="Smazat úlohu"
              @click="deleteProblem(problem.id)"
            >
              🗑
            </button>
          </template>
        </ProblemCard>
      </div>
    </section>

    <ProblemEditDialog
      v-model:open="isProblemEditorOpen"
      :title="dialogTitle"
      @cancel="closeEditor"
    >
      <!-- Problem name -->
      <div
        v-if="editorStore.problem"
        class="form-field"
      >
        <label for="problem-name">
          Název úlohy
        </label>

        <input
          id="problem-name"
          v-model="editorStore.problem.name"
          type="text"
          class="text-input"
          placeholder="Například: Kvadratické rovnice"
          autocomplete="off"
        />
      </div>

      <!-- Assignment and solution editor -->
      <ProblemEditForm />

      <!-- Validation errors -->
      <div
        v-if="triedToSave && editorStore.errors.length > 0"
        class="validation-errors"
        role="alert"
      >
        <p>Před uložením opravte následující chyby:</p>

        <ul>
          <li
            v-for="error in editorStore.errors"
            :key="error"
          >
            {{ error }}
          </li>
        </ul>
      </div>

      <!-- API errors -->
      <div
        v-if="saveError"
        class="validation-errors"
        role="alert"
      >
        <p>{{ saveError }}</p>
      </div>

      <footer class="dialog-actions">
        <button
          type="button"
          class="secondary-button"
          @click="closeEditor"
        >
          Zrušit
        </button>

        <button
          type="button"
          class="primary-button"
          :disabled="isSaving"
          @click="saveProblem"
        >
          {{ isSaving ? 'Ukládám…' : 'Uložit úlohu' }}
        </button>
      </footer>
    </ProblemEditDialog>
  </main>
</template>

<style scoped>
.page {
  max-width: 1100px;
  margin: 0 auto;
  padding: 32px 24px 64px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 32px;
}

.page-header h1 {
  margin: 0;
  font-size: 2rem;
}

.section-heading {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 20px;
}

.section-heading h2 {
  margin: 0;
  font-size: 1.35rem;
}

.count-chip {
  min-width: 28px;
  padding: 2px 10px;
  font-size: 0.9rem;
  font-weight: 700;
  text-align: center;
  color: var(--color-on-primary);
  background: var(--color-primary-soft);
  border-radius: 999px;
}

/* Search input: sits on the right, magnifier icon on the left. */
.search {
  width: auto;
  min-width: 220px;
  margin-left: auto;
  padding-left: 38px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='%234f6b75' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cpath d='m20 20-3.5-3.5'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: 12px center;
}

.card-list {
  display: grid;
  gap: 16px;
  margin-top: 20px;
}

/* Full-width "add" button, same look as the "Nový list" tile in the catalog:
   grey with a plus, turns blue and lifts on hover. The plus uses the
   text color, so both always match. */
.add-card {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  width: 100%;
  height: 64px;
  padding: 0 16px;
  font: inherit;
  font-weight: 700;
  color: var(--color-ink);
  background: #d9d9d9;
  border: 0;
  border-radius: var(--radius-md);
  box-shadow: 0 2px 8px rgba(6, 48, 61, 0.06);
  cursor: pointer;
  transition:
    background-color 0.18s ease,
    color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;
}

.add-card:hover,
.add-card:focus-visible {
  color: #fff;
  background: var(--color-primary);
  box-shadow: 0 10px 24px rgba(53, 208, 255, 0.4);
  transform: translateY(-2px);
}

.add-card:active {
  background: var(--color-primary-hover);
  transform: translateY(0);
}

.add-card__plus {
  position: relative;
  flex: none;
  width: 22px;
  height: 22px;
}

.add-card__plus::before,
.add-card__plus::after {
  content: '';
  position: absolute;
  background: currentColor;
  border-radius: 2px;
}

.add-card__plus::before {
  top: 0;
  left: 50%;
  width: 5px;
  height: 100%;
  transform: translateX(-50%);
}

.add-card__plus::after {
  top: 50%;
  left: 0;
  width: 100%;
  height: 5px;
  transform: translateY(-50%);
}

.empty-hint {
  margin: 0;
  padding: 32px 16px;
  text-align: center;
  color: var(--color-muted);
  background: var(--color-surface);
  border: 1px dashed var(--color-border-strong);
  border-radius: var(--radius-lg);
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  font-size: 1rem;
  color: var(--color-ink);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease;
}

.icon-btn:hover {
  background: var(--color-tint);
  border-color: var(--color-border-strong);
}

.icon-btn--danger {
  color: var(--color-danger);
}

.icon-btn--danger:hover {
  background: #fef2f2;
  border-color: #fecaca;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 20px;
}

.form-field label {
  font-weight: 600;
}

.validation-errors {
  margin-top: 20px;
  padding: 12px 16px;
  color: #991b1b;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: var(--radius-sm);
}

.validation-errors p {
  margin-top: 0;
  font-weight: 600;
}

.validation-errors ul {
  margin-bottom: 0;
  padding-left: 20px;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
}

@media (max-width: 600px) {
  .page {
    padding: 20px 16px 48px;
  }

  .search {
    flex: 1 1 100%;
    margin-left: 0;
  }
}
</style>