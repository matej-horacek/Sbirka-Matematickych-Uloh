<script setup lang="ts">
import type { GeoGebraBlock as GeoGebraBlockData } from '../../../types'
defineProps<{ block: GeoGebraBlockData }>()
defineEmits<{ update: [patch: Partial<GeoGebraBlockData>] }>()
</script>

<template>
  <p>Graf (asset #{{ block.assetId }}, náhled #{{ block.previewAssetId }}), GeoGebra přijde později</p>
</template>