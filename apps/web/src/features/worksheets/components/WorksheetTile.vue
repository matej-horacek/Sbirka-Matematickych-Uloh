<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import type { WorksheetListItem } from '../types'

const props = defineProps<{
  worksheet: WorksheetListItem
}>()

const emit = defineEmits<{
  delete: [worksheet: WorksheetListItem]
}>()

// 1 úloha, 2-4 úlohy, 0 and 5+ úloh
const problemCount = computed(() => {
  const count = props.worksheet.itemCount

  if (count === 1) return '1 úloha'
  if (count >= 2 && count <= 4) return `${count} úlohy`
  return `${count} úloh`
})

// The list API sends no rendered preview, so the "paper" is a sketch of the
// page: one pair of faint lines per problem (up to a full page).
const MAX_PREVIEW_ROWS = 8
const previewRows = computed(() =>
  Math.min(Math.max(props.worksheet.itemCount, 0), MAX_PREVIEW_ROWS),
)
</script>

<template>
  <div class="tile">
    <RouterLink
      class="tile__link"
      :to="{ name: 'worksheet-editor', params: { id: worksheet.id } }"
      :title="`Upravit list ${worksheet.name}`"
    >
      <span class="tile__paper" aria-hidden="true">
        <span class="tile__paper-title" />

        <span v-for="row in previewRows" :key="row" class="tile__paper-row">
          <span class="tile__paper-line" />
          <span class="tile__paper-line" />
        </span>
      </span>

      <span class="tile__name">{{ worksheet.name || 'Bez názvu' }}</span>
      <span class="tile__count">{{ problemCount }}</span>
    </RouterLink>

    <button
      type="button"
      class="tile__delete"
      aria-label="Smazat list"
      title="Smazat list"
      @click="emit('delete', worksheet)"
    >
      🗑
    </button>
  </div>
</template>

<style scoped>
.tile {
  position: relative;
}

.tile__link {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  color: var(--color-ink);
  text-align: center;
  text-decoration: none;
}

/* ---------- the sheet of paper ---------- */
.tile__paper {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  width: 100%;
  aspect-ratio: 210 / 297; /* A4 portrait */
  box-sizing: border-box;
  margin-bottom: 0.65rem;
  padding: 0.85rem 0.7rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border-strong);
  box-shadow: var(--shadow-card);
  overflow: hidden;
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease;
}

.tile__link:hover .tile__paper,
.tile__link:focus-visible .tile__paper {
  box-shadow: var(--shadow-pop);
  transform: translateY(-3px);
}

.tile__paper-title {
  align-self: center;
  width: 70%;
  height: 0.4rem;
  margin-bottom: 0.3rem;
  background: var(--color-accent-ink);
  border-radius: 2px;
  opacity: 0.75;
}

.tile__paper-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.tile__paper-line {
  height: 0.28rem;
  background: var(--color-border);
  border-radius: 2px;
}

/* ---------- the labels ---------- */
.tile__name {
  display: -webkit-box;
  max-width: 100%;
  overflow: hidden;
  font-weight: 600;
  line-height: 1.3;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

.tile__count {
  color: var(--color-muted);
  font-size: 0.8rem;
}

/* ---------- delete ---------- */
.tile__delete {
  position: absolute;
  top: 0.4rem;
  right: 0.4rem;
  display: grid;
  place-items: center;
  width: 1.9rem;
  height: 1.9rem;
  padding: 0;
  background: var(--color-surface);
  border: 1px solid var(--color-border-strong);
  border-radius: 999px;
  box-shadow: var(--shadow-card);
  font-size: 0.9rem;
  opacity: 0;
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.tile:hover .tile__delete,
.tile:focus-within .tile__delete {
  opacity: 1;
}

.tile__delete:hover {
  color: var(--color-danger);
  background: #fef2f2;
}

/* No hover on touch screens: keep the button visible. */
@media (hover: none) {
  .tile__delete {
    opacity: 1;
  }
}
</style>
