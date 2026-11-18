<script setup lang="ts">
import { subproblemLabel } from '../../lib/subproblemLabel'
import { useEditorStore } from '../../stores/editorStore'

import BlockListEditor from './BlockListEditor.vue'
import CategoryPicker from './CategoryPicker.vue'

const editorStore = useEditorStore()

function removeSubproblem(key: string, isSaved: boolean) {
  // A saved subproblem is a problem of its own: it is deleted when the main
  // problem is saved.
  if (
    isSaved &&
    !window.confirm('Podúloha bude po uložení příkladu trvale smazána. Pokračovat?')
  ) {
    return
  }

  editorStore.removeSubproblem(key)
}
</script>

<template>
  <div v-if="editorStore.problem" class="problem-edit-form">
    <section class="categories-section">
      <h3 class="section-title">Zařazení</h3>

      <CategoryPicker
        :chapters="editorStore.problem.chapters"
        :tags="editorStore.problem.tags"
        :has-subproblems="editorStore.problem.subproblems.length > 0"
        @update:chapters="editorStore.setChapters($event)"
        @update:tags="editorStore.setTags($event)"
      />
    </section>

    <section class="assignment-section">
      <h3 class="section-title">Zadání</h3>

      <BlockListEditor
        :model-value="editorStore.problem.assignment"
        @update:model-value="editorStore.setAssignment($event)"
      >
        <template #toolbar>
          <button type="button" @click="editorStore.addSubproblem()">
            + Přidat podúlohu
          </button>
        </template>
      </BlockListEditor>
    </section>

    <section
      v-if="editorStore.problem.subproblems.length > 0"
      class="subproblems"
    >
      <h3 class="section-title">Podúlohy</h3>

      <p class="muted">
        Každá podúloha se uloží jako samostatný příklad navázaný na tento příklad.
      </p>

      <article
        v-for="(sub, index) in editorStore.problem.subproblems"
        :key="sub.key"
        class="subproblem-card"
      >
        <header class="subproblem-header">
          <strong class="subproblem-label">
            {{ subproblemLabel(index) }}
          </strong>

          <div class="subproblem-actions">
            <button
              type="button"
              aria-label="Posunout podúlohu nahoru"
              title="Posunout nahoru"
              :disabled="index === 0"
              @click="editorStore.moveSubproblem(sub.key, -1)"
            >
              ↑
            </button>

            <button
              type="button"
              aria-label="Posunout podúlohu dolů"
              title="Posunout dolů"
              :disabled="index === editorStore.problem.subproblems.length - 1"
              @click="editorStore.moveSubproblem(sub.key, 1)"
            >
              ↓
            </button>

            <button
              type="button"
              class="remove-button"
              aria-label="Odstranit podúlohu"
              title="Odstranit podúlohu"
              @click="removeSubproblem(sub.key, sub.id !== null)"
            >
              Odstranit
            </button>
          </div>
        </header>

        <!-- Sets cannot be nested: no "Přidat podúlohu" inside a subproblem. -->
        <BlockListEditor
          :model-value="sub.assignment"
          @update:model-value="editorStore.setSubproblemAssignment(sub.key, $event)"
        />
      </article>

      <button
        type="button"
        class="add-subproblem"
        @click="editorStore.addSubproblem()"
      >
        + Přidat podúlohu
      </button>
    </section>
  </div>
</template>

<style scoped>
.problem-edit-form {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.section-title {
  margin: 0 0 12px;
  font-size: 1.2rem;
}

.muted {
  margin: 4px 0 16px;
  color: var(--color-muted);
  font-size: 0.9rem;
}

.subproblems {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.subproblem-card {
  padding: 16px;
  border: 1px solid var(--color-border-strong);
  border-left: 4px solid var(--color-primary);
  border-radius: var(--radius-md);
  background: var(--color-tint);
}

.subproblem-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.subproblem-label {
  font-size: 1.1rem;
}

.subproblem-actions {
  display: flex;
  gap: 8px;
}

.subproblem-actions button,
.add-subproblem {
  padding: 8px 14px;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-ink);
  cursor: pointer;
}

.subproblem-actions button:hover:not(:disabled),
.add-subproblem:hover {
  background: var(--color-tint);
}

.add-subproblem {
  align-self: flex-start;
}

.remove-button {
  color: var(--color-danger);
}

button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
