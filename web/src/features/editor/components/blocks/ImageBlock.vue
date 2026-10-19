<script setup lang="ts">
import type { ImageBlock as ImageBlockData } from '../../types'
defineProps<{ block: ImageBlockData }>()
defineEmits<{ update: [patch: Partial<ImageBlockData>] }>()
</script>

<template>
  <p>Obrázek (asset #{{ block.assetId }}), upload bude později</p>
</template>