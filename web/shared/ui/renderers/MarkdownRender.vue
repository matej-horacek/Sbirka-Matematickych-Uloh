

<script setup lang="ts">
/*
a b c d $\sum_{k=1}^{n} \frac{1}{k^2}$

a b c d \( \sum_{k=1}^{n} \frac{1}{k^2 }\)

# Pracovní list

## Příklad 1

# Řeště rovnice: #
$542\int_0^{\infty}\!x\,\mathrm{d}x=y$

\(542\int_0^{\infty}\!x\,\mathrm{d}x=y\)

$542\int_0^{\infty}\!x\,\mathrm{d}x=y$

\(542\int_0^{\infty}\!x\,\mathrm{d}x=y\)

test test
## test ## test

---

## Příklad 2

## **Vyjmenuj vyjmenovaná slova po B**

---

## Příklad 3

adwa


*/
import { computed } from 'vue'
import MarkdownIt from 'markdown-it'
import { katex as katexPlugin } from '@mdit/plugin-katex'
import 'katex/dist/katex.min.css'

const md = new MarkdownIt().use(katexPlugin, {
  delimiters: 'all',
  throwOnError: false })
  
const props = defineProps<{ source: string }>()
const html = computed(() => md.render(props.source))
</script>

<template>
  <div class="markdown" v-html="html" />
</template>