<script setup lang="ts">
import type { Block } from '../../types'

import MathBlock from './blocks/MathBlock.vue'
import TextBlock from './blocks/TextBlock.vue'

/**
 * Edits one list of content blocks: a main assignment or one subproblem.
 *
 * - text     = one Markdown + KaTeX block (formulas are inserted with
 *              "Přidat vzorec", MathLive or LaTeX input)
 * - image    = image block
 * - geogebra = GeoGebra block
 *
 * Extra toolbar buttons (e.g. "Přidat podúlohu") go into the `toolbar` slot.
 */
const blocks = defineModel<Block[]>({ required: true })

const blockTitles: Record<Block['type'], string> = {
  text: 'Text',
  math: 'Matematický výraz',
  image: 'Obrázek',
  geogebra: 'GeoGebra',
}

function addBlock(block: Block) {
  blocks.value = [...blocks.value, block]
}

function addTextBlock() {
  addBlock({ id: crypto.randomUUID(), type: 'text', markdown: '' })
}

function addImageBlock() {
  addBlock({ id: crypto.randomUUID(), type: 'image', assetId: 0 })
}

function addGeoGebraBlock() {
  addBlock({ id: crypto.randomUUID(), type: 'geogebra', assetId: 0, previewAssetId: 0 })
}

function updateBlock(id: string, patch: Partial<Block>) {
  blocks.value = blocks.value.map((block) =>
    block.id === id ? ({ ...block, ...patch } as Block) : block,
  )
}

function updateAssetId(id: string, event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  updateBlock(id, { assetId: value })
}

function moveBlock(id: string, direction: -1 | 1) {
  const list = [...blocks.value]
  const index = list.findIndex((block) => block.id === id)
  const target = index + direction

  if (index === -1 || target < 0 || target >= list.length) return

  const [block] = list.splice(index, 1)
  if (block) list.splice(target, 0, block)

  blocks.value = list
}

function removeBlock(id: string) {
  if (blocks.value.length <= 1) return

  blocks.value = blocks.value.filter((block) => block.id !== id)
}
</script>

<template>
  <div class="block-editor">
    <div class="block-toolbar">
      <button type="button" @click="addTextBlock">+ Text</button>
      <button type="button" @click="addImageBlock">+ Obrázek</button>
      <button type="button" @click="addGeoGebraBlock">+ GeoGebra</button>

      <slot name="toolbar" />
    </div>

    <div class="block-list">
      <article
        v-for="(block, index) in blocks"
        :key="block.id"
        class="block-card"
      >
        <header class="block-header">
          <div class="block-label">
            <span class="block-number">{{ index + 1 }}</span>
            <strong>{{ blockTitles[block.type] }}</strong>
          </div>

          <div class="block-actions">
            <button
              type="button"
              aria-label="Posunout blok nahoru"
              title="Posunout nahoru"
              :disabled="index === 0"
              @click="moveBlock(block.id, -1)"
            >
              ↑
            </button>

            <button
              type="button"
              aria-label="Posunout blok dolů"
              title="Posunout dolů"
              :disabled="index === blocks.length - 1"
              @click="moveBlock(block.id, 1)"
            >
              ↓
            </button>

            <button
              type="button"
              class="remove-button"
              aria-label="Odstranit blok"
              title="Odstranit blok"
              :disabled="blocks.length <= 1"
              @click="removeBlock(block.id)"
            >
              Odstranit
            </button>
          </div>
        </header>

        <TextBlock
          v-if="block.type === 'text'"
          :block="block"
          @update="updateBlock(block.id, $event)"
        />

        <MathBlock
          v-else-if="block.type === 'math'"
          :block="block"
          @update="updateBlock(block.id, $event)"
        />

        <div v-else-if="block.type === 'image'">
          <label :for="`image-${block.id}`">Vložit obrázek</label>

          <input
            :id="`image-${block.id}`"
            type="file"
            @input="updateAssetId(block.id, $event)"
          />
        </div>

        <div v-else-if="block.type === 'geogebra'">
          <label :for="`geogebra-${block.id}`">Vložit Graf</label>

          <input
            :id="`geogebra-${block.id}`"
            type="file"
            @input="updateAssetId(block.id, $event)"
          />
        </div>
      </article>

      <p v-if="blocks.length === 0" class="empty-state">
        Zatím zde nejsou žádné bloky.
      </p>
    </div>
  </div>
</template>

<style scoped>
.block-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 20px 0;
}

.block-toolbar :deep(button),
.block-actions button {
  padding: 8px 14px;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-ink);
  cursor: pointer;
}

.block-toolbar :deep(button:hover),
.block-actions button:hover:not(:disabled) {
  background: var(--color-tint);
}

.block-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.block-card {
  padding: 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.block-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
}

.block-label,
.block-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.block-number {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border-radius: 50%;
  background: var(--color-primary-soft);
  color: var(--color-on-primary);
  font-weight: 700;
}

.remove-button {
  color: var(--color-danger);
}

button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

label {
  display: block;
  margin: 12px 0 6px;
  font-weight: 600;
}

input {
  box-sizing: border-box;
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-ink);
  font: inherit;
}

.empty-state {
  padding: 24px;
  border: 1px dashed var(--color-border-strong);
  border-radius: var(--radius-md);
  color: var(--color-muted);
  text-align: center;
}
</style>
