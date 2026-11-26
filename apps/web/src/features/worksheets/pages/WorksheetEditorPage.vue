<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { cloneDraft } from '@/features/editor/lib/cloneDraft'
import { useUserProblemsStore } from '@/features/editor/stores/userProblems'
import type { ProblemEditorDraft } from '@/features/editor/types'

import { saveWorksheet } from '../api/saveWorksheet'
import { toWorksheetDraft, worksheetsApi } from '../api/worksheetsApi'
import WorksheetAddProblemsModal from '../components/WorksheetAddProblemsModal.vue'
import WorksheetEditorHeader from '../components/WorksheetEditorHeader.vue'
import WorksheetPaper from '../components/WorksheetPaper.vue'
import WorksheetSettingsPanel from '../components/WorksheetSettingsPanel.vue'
import { createEmptyWorksheetDraft } from '../lib/createEmptyWorksheetDraft'
import type { WorksheetDraft } from '../types'

// /worksheets/editor      -> a new worksheet
// /worksheets/editor/:id  -> edit an existing one
const props = defineProps<{ id?: string }>()

const router = useRouter()
const userProblems = useUserProblemsStore()

const draft = reactive<WorksheetDraft>(createEmptyWorksheetDraft())
const loadStatus = ref<'loading' | 'ready' | 'error'>('ready')
const loadError = ref<string | null>(null)
const saveError = ref<string | null>(null)
const isSaving = ref(false)
const isPickerOpen = ref(false)
const pageCount = ref(1)

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

// ---------- the sticky header ----------
// The settings panel sticks right below the header, whatever height the header
// has (it grows when its second row wraps on a narrow screen).

const headerSlot = ref<HTMLElement | null>(null)
const headerHeight = ref(0)
let headerObserver: ResizeObserver | null = null

onMounted(() => {
  // The "Přidat úlohy" window offers the user's own problems.
  void userProblems.fetchAll()

  if (headerSlot.value) {
    headerObserver = new ResizeObserver(([entry]) => {
      headerHeight.value = (entry?.target as HTMLElement | undefined)?.offsetHeight ?? 0
    })
    headerObserver.observe(headerSlot.value)
  }
})

onBeforeUnmount(() => headerObserver?.disconnect())

const rootStyle = computed(() => ({ '--ws-header-h': `${headerHeight.value}px` }))

// ---------- okruhy and štítky on offer ----------
// Taken from the user's own problems. The dropdown adds whatever the worksheet
// already has, so nothing picked ever disappears from the list.

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  return [...new Map(items.map((item) => [item.id, item])).values()]
}

const chapterOptions = computed(() =>
  uniqueById(userProblems.problems.flatMap((problem) => problem.chapters)),
)
const tagOptions = computed(() =>
  uniqueById(userProblems.problems.flatMap((problem) => problem.tags)),
)

// ---------- the worksheet content ----------

const pickedIds = computed(() => new Set(draft.problems.map((problem) => problem.id)))

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
    await router.push({ name: 'worksheets' })
  } catch (error) {
    saveError.value = error instanceof Error ? error.message : 'List se nepodařilo uložit.'
  } finally {
    isSaving.value = false
  }
}

function cancel() {
  void router.push({ name: 'worksheets' })
}
</script>

<template>
  <main class="ws-editor" :style="rootStyle">
    <div ref="headerSlot" class="ws-editor__header">
      <WorksheetEditorHeader
        v-model:name="draft.name"
        v-model:chapters="draft.chapters"
        v-model:tags="draft.tags"
        v-model:difficulty="draft.difficulty"
        v-model:public="draft.isPublic"
        :chapter-options="chapterOptions"
        :tag-options="tagOptions"
        :is-editing="isEditing"
        :is-saving="isSaving"
        :ready="loadStatus === 'ready'"
        @add-problems="isPickerOpen = true"
        @save="save"
        @cancel="cancel"
      />

      <p v-if="saveError" class="ws-editor__error" role="alert">{{ saveError }}</p>
    </div>

    <p v-if="loadStatus === 'loading'" class="ws-editor__hint">Načítám list...</p>

    <p v-else-if="loadStatus === 'error'" class="ws-editor__hint" role="alert">
      {{ loadError }}
    </p>

    <div v-else class="ws-editor__workspace">
      <section class="ws-editor__canvas" aria-label="Náhled listu">
        <WorksheetPaper
          :title="draft.name"
          :problems="draft.problems"
          :layout="draft.layout"
          @page-count="pageCount = $event"
        />
      </section>

      <aside class="ws-editor__panel" aria-label="Nastavení listu">
        <WorksheetSettingsPanel
          v-model:layout="draft.layout"
          :problems="draft.problems"
          :page-count="pageCount"
          @move="moveProblem"
          @remove="removeProblem"
        />
      </aside>
    </div>

    <WorksheetAddProblemsModal
      v-model:open="isPickerOpen"
      :problems="userProblems.problems"
      :picked-ids="pickedIds"
      :loading="userProblems.status === 'loading'"
      :error="userProblems.status === 'error' ? userProblems.error : null"
      @add="addProblem"
    />
  </main>
</template>

<style scoped>
.ws-editor {
  /* Point this at the height of the navbar if it stays on screen while scrolling,
     so the header sticks below it and not under it. */
  --ws-sticky-offset: var(--navbar-height, 0px);
  --ws-canvas: #d8dee2;

  box-sizing: border-box;
  width: 100%;
}

.ws-editor__header {
  position: sticky;
  top: var(--ws-sticky-offset);
  z-index: 20; /* above the paper, so the dropdowns open over it */
}

.ws-editor__error {
  margin: 0;
  padding: 0.6rem clamp(1rem, 3vw, 2rem);
  color: #991b1b;
  background: #fef2f2;
  border-bottom: 1px solid #fecaca;
  font-weight: 600;
}

.ws-editor__hint {
  margin: 0;
  padding: 2rem clamp(1rem, 3vw, 2rem);
  color: var(--color-muted);
}

/* ---------- canvas + panel ---------- */
.ws-editor__workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 20rem;
  align-items: start;
}

.ws-editor__canvas {
  min-width: 0;
  min-height: calc(100dvh - var(--ws-sticky-offset) - var(--ws-header-h, 0px));
  padding: 1.5rem 0 4rem;
  background: var(--ws-canvas);
}

.ws-editor__panel {
  position: sticky;
  top: calc(var(--ws-sticky-offset) + var(--ws-header-h, 0px));
  max-height: calc(100dvh - var(--ws-sticky-offset) - var(--ws-header-h, 0px));
  overflow-y: auto;
  background: var(--color-surface);
  border-left: 1px solid var(--color-border);
}

@media (max-width: 900px) {
  .ws-editor__header {
    position: static;
  }

  .ws-editor__workspace {
    grid-template-columns: minmax(0, 1fr);
  }

  .ws-editor__panel {
    position: static;
    max-height: none;
    border-top: 1px solid var(--color-border);
    border-left: 0;
  }
}
</style>
