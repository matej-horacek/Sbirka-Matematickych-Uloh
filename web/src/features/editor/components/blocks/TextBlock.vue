<!-- TextBlock.vue -->
<script setup lang="ts">
import { nextTick, ref } from 'vue'
import type { TextBlock as TextBlockData } from '../../types'
import MarkdownRender from '../../../../../shared/ui/renderers/MarkdownRender.vue'

const props = defineProps<{ block: TextBlockData }>()
const emit = defineEmits<{ update: [patch: Partial<TextBlockData>] }>()

const area = ref<HTMLTextAreaElement | null>(null)

// The toolbar (B / I / list / inline $math$) will call this via a template ref
function wrap(before: string, after = before) {
  const el = area.value
  if (!el) return
  const { selectionStart: s, selectionEnd: e, value } = el
  emit('update', { markdown: value.slice(0, s) + before + value.slice(s, e) + after + value.slice(e) })
  nextTick(() => {
    el.focus()
    el.setSelectionRange(s + before.length, e + before.length)
  })
}

defineExpose({ wrap })
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
    <MarkdownRender v-if="props.block.markdown" :source="props.block.markdown" />
  </div>
</template>