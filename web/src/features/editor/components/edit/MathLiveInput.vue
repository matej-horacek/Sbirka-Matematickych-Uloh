<script setup lang="ts">
import { ref } from 'vue'
import type { MathfieldElement } from 'mathlive'
import { useMathField } from '../../composables/useMathField'

const latex = defineModel<string>({ required: true })
const field = ref<MathfieldElement | null>(null)

useMathField(field, latex)
</script>

<template>
  <math-field ref="field" style="display: block; font-size: 1.4rem" />
</template>