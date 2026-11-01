<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

import { useEditorStore } from '../../stores/editorStore'
import type { MathInputMode } from '../../types'

import MathLiveInput from './MathLiveInput.vue'
import KaTeXInput from './KaTeXInput.vue'

const editorStore = useEditorStore()

const isMathPickerOpen = ref(false)
const mathMenuRef = ref<HTMLElement | null>(null)

function toggleMathPicker() {
  isMathPickerOpen.value = !isMathPickerOpen.value
}

function closeMathPicker() {
  isMathPickerOpen.value = false
}

function onDocumentPointerDown(event: PointerEvent) {
  if (!isMathPickerOpen.value) return
  if (mathMenuRef.value?.contains(event.target as Node)) return
  closeMathPicker()
}

function onDocumentKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !isMathPickerOpen.value) return
  event.stopPropagation()
  closeMathPicker()
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown)
  document.addEventListener('keydown', onDocumentKeydown, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown)
  document.removeEventListener('keydown', onDocumentKeydown, true)
})

function addTextBlock() {
  editorStore.addBlock({
    id: crypto.randomUUID(),
    type: 'text',
    markdown: '',
  })
}

function addMathBlock(inputMode: MathInputMode) {
  editorStore.addBlock({
    id: crypto.randomUUID(),
    type: 'math',
    latex: '',
    inputMode,
  })

  closeMathPicker()
}

function addImageBlock() {
  editorStore.addBlock({
    id: crypto.randomUUID(),
    type: 'image',
    assetId: 0,
  })
}

function addGeoGebraBlock() {
  editorStore.addBlock({
    id: crypto.randomUUID(),
    type: 'geogebra',
    assetId: 0,
    previewAssetId: 0,
  })
}

function updateText(id: string, event: Event) {
  const value = (event.target as HTMLTextAreaElement).value
  editorStore.updateBlock(id, { markdown: value })
}

function updateLatexValue(id: string, latex: string) {
  editorStore.updateBlock(id, { latex })
}

function updateAssetId(id: string, event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  editorStore.updateBlock(id, { assetId: value })
}

function updatePreviewAssetId(id: string, event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  editorStore.updateBlock(id, { previewAssetId: value })
}

function moveBlock(id: string, direction: -1 | 1) {
  editorStore.moveBlock(id, direction)
}

function removeBlock(id: string) {
  editorStore.removeBlock(id)
}
</script>

<template>
  <div class="problem-edit-form">
    <section class="assignment-section">
      <div class="section-heading"></div>

      <div class="block-toolbar">
        <button type="button" @click="addTextBlock">
          + Text
        </button>

        <div ref="mathMenuRef" class="math-menu">
          <button
            type="button"
            :class="{ active: isMathPickerOpen }"
            aria-haspopup="menu"
            :aria-expanded="isMathPickerOpen"
            @click="toggleMathPicker"
          >
            + vzorec
          </button>

          <Transition name="math-menu-pop">
            <div
              v-if="isMathPickerOpen"
              class="math-menu__panel"
              role="menu"
            >
              <button
                type="button"
                role="menuitem"
                class="math-menu__item"
                @click="addMathBlock('mathlive')"
              >
                MathLive
              </button>

              <button
                type="button"
                role="menuitem"
                class="math-menu__item"
                @click="addMathBlock('katex')"
              >
                KaTeX
              </button>
            </div>
          </Transition>
        </div>

        <button type="button" @click="addImageBlock">
          + Obrázek
        </button>

        <button type="button" @click="addGeoGebraBlock">
          + GeoGebra
        </button>
      </div>

      <div
        v-if="editorStore.problem"
        class="block-list"
      >
        <article
          v-for="(block, index) in editorStore.problem.assignment"
          :key="block.id"
          class="block-card"
        >
          <header class="block-header">
            <div class="block-label">
              <span class="block-number">{{ index + 1 }}</span>

              <strong>
                {{
                  block.type === 'text'
                    ? 'Text'
                    : block.type === 'math'
                      ? 'Matematický výraz'
                      : block.type === 'image'
                        ? 'Obrázek'
                        : 'GeoGebra'
                }}
              </strong>
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
                :disabled="index === editorStore.problem!.assignment.length - 1"
                @click="moveBlock(block.id, 1)"
              >
                ↓
              </button>

              <button
                type="button"
                class="remove-button"
                aria-label="Odstranit blok"
                title="Odstranit blok"
                :disabled="editorStore.problem!.assignment.length <= 1"
                @click="removeBlock(block.id)"
              >
                Odstranit
              </button>
            </div>
          </header>

          <div v-if="block.type === 'text'">
            <label :for="`text-${block.id}`">
              Text v Markdownu
            </label>

            <textarea
              :id="`text-${block.id}`"
              :value="block.markdown"
              rows="5"
              placeholder="Napište zadání příkladu..."
              @input="updateText(block.id, $event)"
            />
          </div>

          <div v-else-if="block.type === 'math'">
            <span class="field-label">
              {{ block.inputMode === 'katex' ? 'LaTeX (KaTeX)' : 'Vzorec (MathLive)' }}
            </span>

            <KaTeXInput
              v-if="block.inputMode === 'katex'"
              :model-value="block.latex"
              @update:model-value="updateLatexValue(block.id, $event)"
            />

            <MathLiveInput
              v-else
              :model-value="block.latex"
              @update:model-value="updateLatexValue(block.id, $event)"
            />
          </div>

          <div v-else-if="block.type === 'image'">
            <label :for="`image-${block.id}`">
              Vložit obrázek
            </label>

            <input
              :id="`image-${block.id}`"
              type="file"
              @input="updateAssetId(block.id, $event)"
            />
          </div>

          <div v-else-if="block.type === 'geogebra'">
            <label :for="`geogebra-${block.id}`">
              Vložit Graf
            </label>

            <input
              :id="`geogebra-${block.id}`"
              type="file"
              @input="updateAssetId(block.id, $event)"
            />
          </div>
        </article>

        <p
          v-if="editorStore.problem.assignment.length === 0"
          class="empty-state"
        >
          Zatím zde nejsou žádné bloky.
        </p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.problem-edit-form {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.section-heading h3 {
  margin: 0;
  font-size: 1.2rem;
}

.muted {
  color: var(--color-muted);
  font-size: 0.9rem;
}

.block-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 20px 0;
}

.block-toolbar > button,
.math-menu > button,
.block-actions button {
  padding: 8px 14px;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-ink);
  cursor: pointer;
}

.block-toolbar > button:hover,
.math-menu > button:hover,
.block-actions button:hover:not(:disabled) {
  background: var(--color-tint);
}

.math-menu > button.active {
  background: var(--color-tint);
  border-color: var(--color-primary);
}

.math-menu {
  position: relative;
}

.math-menu__panel {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  z-index: 20;

  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 2px;
  min-width: 11rem;
  padding: 8px;

  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-pop);
  transform-origin: top left;
}

.math-menu__item {
  padding: 10px 18px;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-ink);
  font: inherit;
  font-size: 1rem;
  text-align: center;
  cursor: pointer;
}

.math-menu__item:hover,
.math-menu__item:focus-visible {
  background: var(--color-tint);
}

.math-menu-pop-enter-active,
.math-menu-pop-leave-active {
  transition:
    opacity 0.16s ease,
    transform 0.16s ease;
}

.math-menu-pop-enter-from,
.math-menu-pop-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.97);
}

@media (prefers-reduced-motion: reduce) {
  .math-menu-pop-enter-active,
  .math-menu-pop-leave-active {
    transition: none;
  }
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

label,
.field-label {
  display: block;
  margin: 12px 0 6px;
  font-weight: 600;
}

textarea,
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

textarea:focus,
input:focus {
  border-color: var(--color-primary);
  outline: 3px solid var(--color-tint);
}

textarea {
  resize: vertical;
}

.empty-state {
  padding: 24px;
  border: 1px dashed var(--color-border-strong);
  border-radius: var(--radius-md);
  color: var(--color-muted);
  text-align: center;
}
</style>