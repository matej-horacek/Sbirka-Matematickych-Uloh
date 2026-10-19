<!-- MathBlock.vue -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import type { MathBlock as MathBlockData } from '../../types'
import MathLiveInput from '../MathLiveInput.vue'
import KaTeXInput from '../KaTeXInput.vue'

const props = defineProps<{ block: MathBlockData }>()
const emit = defineEmits<{ update: [patch: Partial<MathBlockData>] }>()

const mode = ref<'mathlive' | 'katex'>('mathlive')

const latex = computed({
  get: () => props.block.latex,
  set: (v) => emit('update', { latex: v }),
})
</script>

<template>
  <div class="math-block">
    <div>
      <button :disabled="mode === 'mathlive'" @click="mode = 'mathlive'">Klávesnice</button>
      <button :disabled="mode === 'katex'" @click="mode = 'katex'">LaTeX</button>
    </div>

    <MathLiveInput v-if="mode === 'mathlive'" v-model="latex" />
    <KaTeXInput v-else v-model="latex" />
  </div>
</template>