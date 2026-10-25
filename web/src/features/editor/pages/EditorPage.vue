<script setup lang="ts">
import { computed, ref, toRaw } from 'vue'

import ProblemList from '../components/list/ProblemList.vue'
import ProblemEditDialog from '../components/edit/ProblemEditDialog.vue'
import ProblemEditForm from '../components/edit/ProblemEditForm.vue'

import { useEditorStore } from '../stores/editorStore'
import { useWorksheetProblemsStore } from '../stores/worksheetProblems'
import { useWorksheetMarkdown } from '../composables/useWorksheetMarkdown'

import type { WorksheetId } from '../types.ts'

const props = defineProps<{
  worksheetId: WorksheetId
}>()


const editorStore = useEditorStore()
const worksheetStore = useWorksheetProblemsStore()

const isProblemEditorOpen = ref(false)
const editingLocalId = ref<string | null>(null)
const triedToSave = ref(false)

const problems = computed(() =>
  worksheetStore.problemsForWorksheet(props.worksheetId),
)

const dialogTitle = computed(() =>
  editingLocalId.value
    ? 'Upravit příklad'
    : 'Nový příklad',
)

// TESTOVANI
const { exportWorksheet } = useWorksheetMarkdown()

function saveWorksheet() {
  exportWorksheet(problems.value, props.worksheetId)
}

function createProblem() {
  editingLocalId.value = null
  triedToSave.value = false

  editorStore.newProblem()

  isProblemEditorOpen.value = true
}

function editProblem(localId: string) {
  const item = worksheetStore.problemByLocalId(
    props.worksheetId,
    localId,
  )

  if (!item) return

  editorStore.loadProblem({
    assignment: structuredClone(toRaw(item).assignment),
  })

  editingLocalId.value = localId
  triedToSave.value = false
  isProblemEditorOpen.value = true
}

function saveProblem() {
  triedToSave.value = true

  const draft = editorStore.problem

  if (!draft || editorStore.errors.length > 0) return

  const problemToSave = structuredClone(toRaw(draft))

  if (editingLocalId.value) {
    worksheetStore.saveProblem(
      props.worksheetId,
      editingLocalId.value,
      problemToSave,
    )
  } else {
    worksheetStore.addProblem(
      props.worksheetId,
      problemToSave,
    )
  }

  closeAfterSave()
}

function closeAfterSave() {
  isProblemEditorOpen.value = false
  editingLocalId.value = null
  triedToSave.value = false

  editorStore.$patch({
    problem: null,
    isSaved: true,
  })
}

function cancelProblemEdit() {
  isProblemEditorOpen.value = false
  editingLocalId.value = null
  triedToSave.value = false

  editorStore.$patch({
    problem: null,
    isSaved: true,
  })
}
</script>

<template>
  <main class="editor-page">
    <header class="page-header">
      <div>
        <p class="eyebrow">
          Editor
        </p>

        <h1>Pracovní list</h1>

      </div>

      <button
        type="button"
        class="primary-button"
        @click="createProblem"
      >
        + Příklad
      </button>
    </header>

    <section class="worksheet-content">
      <div class="section-heading">
        <h2>Příklady</h2>

        <span class="problem-count">
          {{ problems.length }}
        </span>
      </div>

      <ProblemList
        :worksheet-id="props.worksheetId"
        @edit="editProblem"
      />
    </section>

    <!-- TESTOVANI: !-->
    <footer class="page-footer">
      <button
        type="button"
        class="primary-button"
        :disabled="problems.length === 0"
        @click="saveWorksheet"
      >
        Uložit pracovní list (Markdown)
      </button>
    </footer>

    <ProblemEditDialog
      v-model:open="isProblemEditorOpen"
      :title="dialogTitle"
      @cancel="cancelProblemEdit"
    >
      <ProblemEditForm />

      <div
        v-if="triedToSave && editorStore.errors.length > 0"
        class="validation-errors"
        role="alert"
      >
        <p>
          Před uložením opravte následující chyby:
        </p>

        <ul>
          <li
            v-for="error in editorStore.errors"
            :key="error"
          >
            {{ error }}
          </li>
        </ul>
      </div>

      <footer class="dialog-actions">
        <button
          type="button"
          class="secondary-button"
          @click="cancelProblemEdit"
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
.editor-page {
  width: min(1200px, 100%);
  margin: 0 auto;
  padding: 32px 24px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 40px;
}

.eyebrow {
  margin: 0 0 8px;
  color: var(--color-accent-ink);
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.page-header h1 {
  margin: 0;
  font-size: 2rem;
}

.page-description {
  margin: 8px 0 0;
  color: var(--color-muted);
}

.worksheet-content {
  min-width: 0;
}

.section-heading {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.section-heading h2 {
  margin: 0;
  font-size: 1.35rem;
}

.problem-count {
  display: inline-grid;
  min-width: 28px;
  height: 28px;
  padding: 0 8px;
  place-items: center;
  background: var(--color-primary-soft);
  color: var(--color-on-primary);
  border-radius: 999px;
  font-size: 0.875rem;
  font-weight: 700;
}

.primary-button,
.secondary-button {
  min-height: 40px;
  padding: 10px 18px;
  border-radius: var(--radius-md);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.primary-button {
  color: var(--color-on-primary);
  background: var(--color-primary);
  border: 1px solid var(--color-primary);
}

.primary-button:hover:not(:disabled) {
  background: var(--color-primary-hover);
  border-color: var(--color-primary-hover);
}

.primary-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.secondary-button {
  color: var(--color-ink);
  background: var(--color-surface);
  border: 1px solid var(--color-border-strong);
}

.secondary-button:hover {
  background: var(--color-tint);
}

.page-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 32px;
  padding-top: 20px;
  border-top: 1px solid var(--color-border);
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

@media (max-width: 640px) {
  .editor-page {
    padding: 20px 16px;
  }

  .page-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .dialog-actions {
    flex-wrap: wrap;
  }
}
</style>