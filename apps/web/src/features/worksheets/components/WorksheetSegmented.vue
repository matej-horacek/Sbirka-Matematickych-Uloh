<script setup lang="ts" generic="T extends string | number">
import { useId } from 'vue'

// A row of mutually exclusive choices (radio buttons styled as one pill).
defineProps<{
  legend: string
  options: { value: T; label: string }[]
}>()

const model = defineModel<T>({ required: true })

// Radio buttons of one group share a name.
const group = useId()
</script>

<template>
  <fieldset class="seg">
    <legend class="seg__legend">{{ legend }}</legend>

    <div class="seg__group">
      <label v-for="option in options" :key="option.value" class="seg__option">
        <input
          type="radio"
          class="seg__input"
          :name="group"
          :value="option.value"
          :checked="model === option.value"
          @change="model = option.value"
        />
        <span class="seg__text">{{ option.label }}</span>
      </label>
    </div>
  </fieldset>
</template>

<style scoped>
.seg {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.seg__legend {
  margin-bottom: 0.35rem;
  padding: 0;
  font-size: 0.9rem;
  font-weight: 600;
}

.seg__group {
  display: flex;
  overflow: hidden;
  background: var(--color-surface);
  border: 1px solid var(--color-border-strong);
  border-radius: 999px;
}

.seg__option {
  position: relative;
  flex: 1 1 0;
}

.seg__option + .seg__option {
  border-left: 1px solid var(--color-border);
}

.seg__input {
  position: absolute;
  inset: 0;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}

.seg__text {
  display: block;
  padding: 0.35rem 0.4rem;
  color: var(--color-muted);
  font-size: 0.88rem;
  font-weight: 600;
  text-align: center;
  user-select: none;
}

.seg__input:checked + .seg__text {
  color: var(--color-on-primary);
  background: var(--color-primary);
}

.seg__input:focus-visible + .seg__text {
  outline: 2px solid var(--color-accent-ink);
  outline-offset: -3px;
}
</style>
