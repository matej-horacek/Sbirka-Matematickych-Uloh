<script setup lang="ts">
import { ref } from 'vue'
import type { TextBlock as TextBlockData } from '../../../types.ts'
import MarkdownRender from '../../../../../../shared/ui/renderers/MarkdownRender.vue'
import FormulaEditor from './FormulaEditor.vue'
import { useFormulaInsert } from '../../../composables/useFormulaInsert.ts'

const props = defineProps<{ block: TextBlockData }>()
const emit = defineEmits<{ update: [patch: Partial<TextBlockData>] }>()

const area = ref<HTMLTextAreaElement | null>(null)

const { open, draft, start, confirm, cancel } = useFormulaInsert(
  area,
  () => props.block.markdown,
  (markdown) => emit('update', { markdown }),
)
//  button z templatu na přidáni KaTex/MathLive bloku  <button type="button" @click="start">Přidat vzorec</button>
</script>

<template>
  <div>

    <textarea
      ref="area"
      :value="block.markdown"
      rows="4"
      style="width: 100%"
      @input="emit('update', { markdown: ($event.target as HTMLTextAreaElement).value })"
    />

    <FormulaEditor v-if="open" v-model="draft" @confirm="confirm" @cancel="cancel" />

    <MarkdownRender v-if="block.markdown" :source="block.markdown" />
  </div>
</template>