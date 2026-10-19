<script setup lang="ts">
import type { Block } from '../../types'
import TextBlock from './TextBlock.vue'
import MathBlock from './MathBlock.vue'
import ImageBlock from './ImageBlock.vue'
import GeoGebraBlock from './GeoGebraBlock.vue'

defineProps<{ block: Block }>()
defineEmits<{ update: [patch: Partial<Block>] }>()
</script>

<template>
  <TextBlock v-if="block.type === 'text'" :block="block" @update="$emit('update', $event)" />
  <MathBlock v-else-if="block.type === 'math'" :block="block" @update="$emit('update', $event)" />
  <ImageBlock v-else-if="block.type === 'image'" :block="block" @update="$emit('update', $event)" />
  <GeoGebraBlock v-else-if="block.type === 'geogebra'" :block="block" @update="$emit('update', $event)" />
</template>