<script setup lang="ts">
import { ref } from 'vue'
import MathLiveInput from '../MathLiveInput.vue'
import KaTeXInput from '../KaTeXInput.vue'

const latex = defineModel<string>({ required: true })
const emit = defineEmits<{ confirm: []; cancel: [] }>()

const mode = ref<'mathlive' | 'katex'>('mathlive')
</script>

<template>
  <div class="formula-editor">
    <div>
      <button type="button" :disabled="mode === 'mathlive'" @click="mode = 'mathlive'">Klávesnice</button>
      <button type="button" :disabled="mode === 'katex'" @click="mode = 'katex'">LaTeX</button>
    </div>

    <MathLiveInput v-if="mode === 'mathlive'" v-model="latex" />
    <KaTeXInput v-else v-model="latex" />

    <button type="button" @click="emit('confirm')">Vložit</button>
    <button type="button" @click="emit('cancel')">Zrušit</button>
  </div>
</template>