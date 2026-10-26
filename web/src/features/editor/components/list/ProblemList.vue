<script setup lang="ts">
import { computed } from 'vue'
import {
  useWorksheetProblemsStore,
  
} from '../../stores/worksheetProblems'
import {type WorksheetId } from '../../types'
import ProblemCard from './ProblemCard.vue'

const props = defineProps<{
  worksheetId: WorksheetId
}>()

const emit = defineEmits<{
  edit: [localId: string]
}>()

const worksheetStore = useWorksheetProblemsStore()

const problems = computed(() =>
  worksheetStore.problemsForWorksheet(props.worksheetId),
)

function moveProblem(localId: string, direction: -1 | 1) {
  worksheetStore.moveProblem(
    props.worksheetId,
    localId,
    direction,
  )
}
</script>

<template>
  <section class="problem-list" aria-label="Otázky pracovního listu">
    <p v-if="problems.length === 0" class="problem-list__empty">
      Tento pracovní list zatím neobsahuje žádné otázky.
    </p>

    <ProblemCard
  v-for="(item, index) in problems"
  :key="item.localId"
  :item="item"
  :index="index"
  :total="problems.length"
  @edit="emit('edit', item.localId)"
  @move="moveProblem(item.localId, $event)"
/>
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
</style>