<script setup lang="ts">
import { computed } from 'vue'
import katex from 'katex'
import 'katex/dist/katex.min.css'

const props = defineProps<{ latex: string; displayMode?: boolean }>()

const html = computed(() =>
  katex.renderToString(props.latex, {
    displayMode: props.displayMode ?? true,
    throwOnError: false, 
  }),
)
</script>

<template>
  <span v-html="html" />
</template>