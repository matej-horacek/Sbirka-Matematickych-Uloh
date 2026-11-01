
<script setup lang="ts">
import { computed } from 'vue'
import { useUserProblemsStore } from '../../stores/userProblems'
import type { Sqid } from '../../types'
import ProblemCard from './ProblemCard.vue'

const props = defineProps<{
  selectedId?: Sqid | null
}>()

const emit = defineEmits<{
  edit: [id: Sqid]
}>()

const problemStore = useUserProblemsStore()

const problems = computed(() => problemStore.problems)

function editProblem(id: Sqid | null) {
  if (id !== null) {
    emit('edit', id)
  }
}
</script>

<template>
  <section class="problem-list" aria-label="Seznam příkladů">

    <p
      v-if="problemStore.status === 'loading'"
      class="problem-list__empty"
    >
      Načítání příkladů...
    </p>

    <p
      v-else-if="problemStore.status === 'error'"
      class="problem-list__empty"
    >
      {{ problemStore.error ?? 'Příklady se nepodařilo načíst.' }}
    </p>

    <p
      v-else-if="problems.length === 0"
      class="problem-list__empty"
    >
      Zatím nemáte žádné příklady.
    </p>

    <ProblemCard
      v-for="problem in problems"
      :key="problem.id ?? problem.name"
      :title="problem.name || 'Bez názvu'"
      :blocks="problem.assignment"
      :selected="problem.id === selectedId"
    >
      <template #actions>
        <button
          v-if="problem.id !== null"
          type="button"
          @click="editProblem(problem.id)"
        >
          Upravit
        </button>
      </template>
    </ProblemCard>

  </section>
</template>

<style scoped>
.problem-list {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 20px;

  width: 100%;
  min-width: 0;
}

.problem-list > * {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.problem-list__empty {
  color: var(--color-muted);
}
</style>
