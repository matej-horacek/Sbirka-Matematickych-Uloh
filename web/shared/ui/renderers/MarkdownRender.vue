<script setup lang="ts">
import { computed } from 'vue'
import MarkdownIt from 'markdown-it'
import * as katexModule from '@vscode/markdown-it-katex'
import 'katex/dist/katex.min.css'

const katexPlugin = (katexModule as any).default?.default
  ?? (katexModule as any).default
  ?? katexModule

const md = new MarkdownIt().use(katexPlugin)

const props = defineProps<{ source: string }>()
const html = computed(() => md.render(props.source))
</script>

<template>
  <div class="markdown" v-html="html" />
</template>