<script setup lang="ts">
import type { Block } from '../../types'
import MarkdownRender from '../../../../../shared/ui/renderers/MarkdownRender.vue'
//import ImagePreview from '../../../../../shared/ui/renderers/ImageRenderer.vue'

defineProps<{
  blocks: Block[]
}>()
</script>

<template>
  <div class="problem-preview">
    <div
      v-for="block in blocks"
      :key="block.id"
      class="problem-preview__block"
      :class="`problem-preview__block--${block.type}`"
    >
      <MarkdownRender
        v-if="block.type === 'text'"
        :source="block.markdown"
      />

      <MarkdownRender
        v-else-if="block.type === 'math'"
        :source="`$$\n${block.latex}\n$$`"
      />

      <ImagePreview
        v-else-if="block.type === 'image'"
        :asset-id="block.assetId"
        :alt="block.alt ?? ''"
      />

      <ImagePreview
        v-else-if="block.type === 'geogebra'"
        :asset-id="block.previewAssetId"
        alt="GeoGebra preview"
      />
    </div>
  </div>
</template>

<style scoped>
.problem-preview {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.75rem;
  width: 100%;
  min-width: 0;
}

.problem-preview__block {
  width: 100%;
  min-width: 0;
}

.problem-preview__block--image,
.problem-preview__block--geogebra {
  max-width: 100%;
}
</style>