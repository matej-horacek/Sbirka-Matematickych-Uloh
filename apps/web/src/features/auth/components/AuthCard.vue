<script setup lang="ts">
defineProps<{ title: string }>()
</script>

<template>
  <main class="auth">
    <section class="auth__card">
      <h1 class="auth__title">{{ title }}</h1>
      <slot />
    </section>
  </main>
</template>

<style>
/* Not scoped: the pages put their own form controls into the slot and share these styles. */
.auth {
  display: grid;
  place-items: start center;
  padding: 3rem 1rem;
}

.auth__card {
  width: min(26rem, 100%);
  padding: 1.75rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
}

.auth__title {
  margin: 0 0 1.25rem;
  font-size: 1.6rem;
}

.auth__form {
  display: grid;
  gap: 1rem;
}

.auth__field {
  display: grid;
  gap: 0.3rem;
  font-weight: 600;
}

.auth__field input {
  min-height: 2.5rem;
  padding: 0.3rem 0.75rem;
  box-sizing: border-box;
  font: inherit;
  font-weight: 400;
  color: var(--color-ink);
  background: var(--color-surface);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
}

.auth__hint {
  color: var(--color-muted);
  font-size: 0.85rem;
  font-weight: 400;
}

.auth__error {
  margin: 0;
  padding: 0.6rem 0.75rem;
  color: var(--color-danger);
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: var(--radius-sm);
}

.auth__submit {
  min-height: 2.6rem;
  color: var(--color-on-primary);
  background: var(--color-primary);
  border: 0;
  border-radius: var(--radius-sm);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.auth__submit:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.auth__submit:disabled {
  background: var(--color-muted-soft);
  cursor: progress;
}

.auth__switch {
  margin: 1.25rem 0 0;
  color: var(--color-muted);
}
</style>
