<script setup lang="ts">
// An on/off switch with a text label (the default slot).
const checked = defineModel<boolean>({ required: true })
</script>

<template>
  <button
    type="button"
    role="switch"
    class="switch"
    :aria-checked="checked"
    @click="checked = !checked"
  >
    <span class="switch__track" aria-hidden="true">
      <span class="switch__thumb" />
    </span>
    <span class="switch__label"><slot /></span>
  </button>
</template>

<style scoped>
.switch {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.2rem 0;
  color: var(--color-ink);
  background: none;
  border: 0;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.switch__track {
  position: relative;
  flex: none;
  width: 2.5rem;
  height: 1.4rem;
  background: var(--color-border-strong);
  border-radius: 999px;
  transition: background 0.15s ease;
}

.switch__thumb {
  position: absolute;
  top: 0.2rem;
  left: 0.2rem;
  width: 1rem;
  height: 1rem;
  background: #fff;
  border-radius: 50%;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  transition: transform 0.15s ease;
}

.switch[aria-checked='true'] .switch__track {
  background: var(--color-primary);
}

.switch[aria-checked='true'] .switch__thumb {
  transform: translateX(1.1rem);
}

.switch:focus-visible {
  outline: 2px solid var(--color-accent-ink);
  outline-offset: 3px;
  border-radius: var(--radius-sm);
}

@media (prefers-reduced-motion: reduce) {
  .switch__track,
  .switch__thumb {
    transition: none;
  }
}
</style>
