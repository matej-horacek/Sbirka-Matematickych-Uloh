<script setup lang="ts" generic="T extends { id: string; name: string }">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'

// A multi-select in a dropdown: the button shows the current choice on one line,
// so the header keeps its height however many items are picked.
const props = defineProps<{
  label: string
  options: T[]
  emptyText?: string
}>()

const selected = defineModel<T[]>({ required: true })

const panelId = useId()

const open = ref(false)
const query = ref('')
const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const searchInput = ref<HTMLInputElement | null>(null)

const selectedIds = computed(() => new Set(selected.value.map((item) => item.id)))
const summary = computed(() => selected.value.map((item) => item.name).join(', '))
const showSearch = computed(() => props.options.length > 8)

// Everything on offer plus what is already picked (so a loaded worksheet never
// loses a chapter just because none of the user's problems uses it).
const items = computed(() => {
  const byId = new Map<string, T>()

  for (const item of [...props.options, ...selected.value]) {
    if (!byId.has(item.id)) byId.set(item.id, item)
  }

  const needle = query.value.trim().toLowerCase()

  return [...byId.values()]
    .filter((item) => !needle || item.name.toLowerCase().includes(needle))
    .sort((a, b) => a.name.localeCompare(b.name, 'cs'))
})

function toggle(item: T) {
  selected.value = selectedIds.value.has(item.id)
    ? selected.value.filter((picked) => picked.id !== item.id)
    : [...selected.value, item]
}

function clear() {
  selected.value = []
}

function close(returnFocus = false) {
  open.value = false
  if (returnFocus) trigger.value?.focus()
}

watch(open, async (isOpen) => {
  if (!isOpen) return

  query.value = ''
  await nextTick()
  searchInput.value?.focus()
})

function onPointerDown(event: PointerEvent) {
  if (open.value && root.value && !root.value.contains(event.target as Node)) close()
}

onMounted(() => document.addEventListener('pointerdown', onPointerDown))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onPointerDown))
</script>

<template>
  <div ref="root" class="select" @keydown.esc.stop="close(true)">
    <button
      ref="trigger"
      type="button"
      class="select__trigger"
      :aria-expanded="open"
      :aria-controls="panelId"
      @click="open = !open"
    >
      <span class="select__label">{{ label }}</span>
      <span class="select__value" :class="{ 'select__value--empty': selected.length === 0 }">
        {{ summary || 'Vybrat' }}
      </span>
      <span class="select__caret" aria-hidden="true" />
    </button>

    <div v-if="open" :id="panelId" class="select__panel" role="group" :aria-label="label">
      <input
        v-if="showSearch"
        ref="searchInput"
        v-model="query"
        type="search"
        class="select__search"
        placeholder="Hledat"
        aria-label="Hledat"
      />

      <ul v-if="items.length > 0" class="select__list">
        <li v-for="item in items" :key="item.id">
          <label class="select__option">
            <input type="checkbox" :checked="selectedIds.has(item.id)" @change="toggle(item)" />
            <span>{{ item.name }}</span>
          </label>
        </li>
      </ul>

      <p v-else class="select__empty">{{ emptyText ?? 'Není z čeho vybírat.' }}</p>

      <button v-if="selected.length > 0" type="button" class="select__clear" @click="clear">
        Zrušit výběr
      </button>
    </div>
  </div>
</template>

<style scoped>
.select {
  position: relative;
  min-width: 0;
}

.select__trigger {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  max-width: 18rem;
  padding: 0.4rem 0.9rem;
  color: var(--color-ink);
  background: var(--color-surface);
  border: 1px solid var(--color-border-strong);
  border-radius: 999px;
  font: inherit;
  cursor: pointer;
}

.select__trigger:hover {
  background: var(--color-tint);
}

.select__trigger[aria-expanded='true'] {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-soft);
}

.select__trigger:focus-visible {
  outline: 2px solid var(--color-accent-ink);
  outline-offset: 2px;
}

.select__label {
  flex: none;
  font-weight: 700;
}

.select__value {
  min-width: 0;
  overflow: hidden;
  color: var(--color-ink);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.select__value--empty {
  color: var(--color-muted);
}

.select__caret {
  flex: none;
  width: 0;
  height: 0;
  border-top: 5px solid currentColor;
  border-right: 4px solid transparent;
  border-left: 4px solid transparent;
}

.select__panel {
  position: absolute;
  top: calc(100% + 0.4rem);
  left: 0;
  z-index: 30;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 18rem;
  max-width: calc(100vw - 2rem);
  padding: 0.6rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-pop);
}

.select__search {
  box-sizing: border-box;
  width: 100%;
  padding: 0.35rem 0.8rem;
  color: var(--color-ink);
  background: var(--color-surface);
  border: 1px solid var(--color-border-strong);
  border-radius: 999px;
  font: inherit;
}

.select__list {
  display: flex;
  flex-direction: column;
  max-height: 14rem;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  list-style: none;
}

.select__option {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.35rem 0.5rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.select__option:hover {
  background: var(--color-tint);
}

.select__empty {
  margin: 0;
  padding: 0.25rem 0.25rem 0.1rem;
  color: var(--color-muted);
  font-size: 0.9rem;
}

.select__clear {
  align-self: flex-start;
  padding: 0.15rem 0.4rem;
  color: var(--color-accent-ink);
  background: none;
  border: 0;
  font: inherit;
  font-size: 0.9rem;
  font-weight: 600;
  text-decoration: underline;
  cursor: pointer;
}
</style>
