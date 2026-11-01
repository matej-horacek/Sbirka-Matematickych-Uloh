<script setup lang="ts">
import KatexRender from '../../../../../shared/ui/renderers/KatexRender.vue'

const latex = defineModel<string>({ required: true })
</script>

<template>
  <div>
    <textarea v-model="latex" rows="2" spellcheck="false" style="width: 100%; font-family: monospace" />
    <KatexRender :latex="latex" display-mode/>
  </div>
</template>