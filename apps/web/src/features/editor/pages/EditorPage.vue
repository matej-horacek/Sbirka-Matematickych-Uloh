
<script setup lang="ts">
import { computed, onMounted, ref, toRaw } from 'vue'

import ProblemCard from '../components/list/ProblemCard.vue'
import ProblemEditDialog from '../components/edit/ProblemEditDialog.vue'
import ProblemEditForm from '../components/edit/ProblemEditForm.vue'

import { useEditorStore } from '../stores/editorStore'
import { useUserProblemsStore } from '../stores/userProblems'

import { blocksToMarkdown } from '../lib/blocksToMarkdown'
import { createEmptyProblemDraft } from '../lib/createEmptyProblemDraft'

import type { Sqid } from '../types'

const editorStore = useEditorStore()
const userProblems = useUserProblemsStore()

const isProblemEditorOpen = ref(false)
const triedToSave = ref(false)
const saveError = ref<string | null>(null)
const search = ref('')

onMounted(() => {
  void userProblems.fetchAll()
})

// Filter problems by name and assignment content.
const problems = computed(() => {
  const query = search.value.trim().toLowerCase()

  if (!query) return userProblems.problems

  return userProblems.problems.filter((problem) => {
    const name = problem.name?.toLowerCase() ?? ''
    const assignment = blocksToMarkdown(problem.assignment).toLowerCase()

    return name.includes(query) || assignment.includes(query)
  })
})

// Existing problems have a Sqid.
const isEditing = computed(
  () => editorStore.problem?.id != null,
)

const dialogTitle = computed(() =>
  isEditing.value ? 'Upravit příklad' : 'Nový příklad',
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
    structuredClone(toRaw(item)),
  )

  triedToSave.value = false
  saveError.value = null

  isProblemEditorOpen.value = true
}

// Save a new or existing problem.
async function saveProblem() {
  triedToSave.value = true
  saveError.value = null

  const draft = editorStore.problem

  if (!draft) return

  // Validate the name before sending anything to the backend.
  const name = draft.name?.trim()

  if (!name) {
    saveError.value = 'Zadejte název příkladu.'
    return
  }

  // Check the remaining editor validation.
  if (editorStore.errors.length > 0) return

  const problemToSave = structuredClone(toRaw(draft))

  // Normalize the name and collections.
  problemToSave.name = name
  problemToSave.tagIds ??= []
  problemToSave.chapterIds ??= []

  try {
    // A new problem has no ID yet.
    // It must use POST /problems.
    if (problemToSave.id == null) {
      await userProblems.add(problemToSave)
    } else {
      // Existing problems use PATCH /problems/:id.
      await userProblems.save(problemToSave)
    }

    closeEditor()
  } catch (error) {
    saveError.value =
      error instanceof Error
        ? error.message
        : 'Příklad se nepodařilo uložit.'
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
  if (!window.confirm('Opravdu chcete příklad smazat?')) {
    return
  }

  try {
    await userProblems.remove(id)
  } catch (error) {
    window.alert(
      error instanceof Error
        ? error.message
        : 'Příklad se nepodařilo smazat.',
    )
  }
}
</script>

<template>
  <main class="page">
    <header class="page-header">
      <div>
        <p class="eyebrow">Editor</p>
        <h1>Moje příklady</h1>
      </div>

      <button
        type="button"
        class="primary-button"
        @click="createProblem"
      >
        + Příklad
      </button>
    </header>

    <section>
      <div class="section-heading">
        <h2>Příklady</h2>

        <span class="count-chip">
          {{ problems.length }}
        </span>

        <input
          v-model="search"
          type="search"
          class="text-input search"
          placeholder="Hledat v příkladech…"
          aria-label="Hledat v příkladech"
        />
      </div>

      <div class="card-list">
        <p
          v-if="userProblems.status === 'loading'"
          class="empty-hint"
        >
          Načítám příklady…
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
          Zatím tu nemáte žádný příklad. Přidejte první.
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
        >
          <template #actions>
            <button
              v-if="problem.id != null"
              type="button"
              class="icon-btn"
              aria-label="Upravit příklad"
              title="Upravit příklad"
              @click="editProblem(problem.id)"
            >
              ✎
            </button>

            <button
              v-if="problem.id != null"
              type="button"
              class="icon-btn icon-btn--danger"
              aria-label="Smazat příklad"
              title="Smazat příklad"
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
          Název příkladu
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
          @click="saveProblem"
        >
          Uložit příklad
        </button>
      </footer>
    </ProblemEditDialog>
  </main>
</template>

<style scoped>
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

.search {
  margin-left: auto;
  min-width: 220px;
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
</style>
