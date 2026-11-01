<script setup lang="ts">
defineProps<{
  open: boolean
  title: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  cancel: []
}>()

function closeDialog() {
  emit('cancel')
  emit('update:open', false)
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="modal-backdrop"
      @click.self="closeDialog"
    >
      <section
        class="problem-modal"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
      >
        <header class="modal-header">
          <h2>{{ title }}</h2>

          <button
            type="button"
            class="close-button"
            aria-label="Zavřít editor"
            @click="closeDialog"
          >
            ✕
          </button>
        </header>

        <div class="modal-content">
          <slot />
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgb(0 0 0 / 55%);
}

.problem-modal {
  display: flex;
  flex-direction: column;
  width: min(1100px, 100%);
  max-height: 92vh;
  overflow: hidden;
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgb(0 0 0 / 25%);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  padding: 16px 24px;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h2 {
  margin: 0;
  font-size: 1.25rem;
}

.close-button {
  border: none;
  background: transparent;
  font-size: 1.4rem;
  cursor: pointer;
}

.modal-content {
  overflow-y: auto;
  padding: 24px;
}
</style>