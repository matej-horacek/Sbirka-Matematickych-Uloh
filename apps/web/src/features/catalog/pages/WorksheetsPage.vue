<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'

import WorksheetTile from '@/features/worksheets/components/WorksheetTile.vue'
import { useWorksheetsStore } from '@/features/worksheets/stores/worksheetsStore'
import type { WorksheetListItem } from '@/features/worksheets/types'

const store = useWorksheetsStore()

// idle = the first render, before onMounted has started the request.
const isLoading = computed(() => store.status === 'loading' || store.status === 'idle')

function load() {
  void store.fetchAll()
}

onMounted(load)

async function deleteWorksheet(worksheet: WorksheetListItem) {
  if (
    !window.confirm(
      `Opravdu chcete list „${worksheet.name}“ smazat? Úlohy v něm zůstanou zachovány.`,
    )
  ) {
    return
  }

  try {
    await store.remove(worksheet.id)
  } catch (error) {
    window.alert(error instanceof Error ? error.message : 'List se nepodařilo smazat.')
  }
}
</script>

<template>
  <main class="worksheets-page">
    <header class="worksheets-page__header">
      <h1 class="worksheets-page__title">Moje listy</h1>

      <span v-if="store.status === 'ready'" class="worksheets-page__count">
        {{ store.items.length }}
      </span>
    </header>

    <!-- One row: "Nový list" first, then the worksheets. It scrolls sideways when it overflows. -->
    <section class="shelf" aria-label="Moje listy">
      <ul class="worksheets-row" :aria-busy="isLoading">
        <li class="worksheets-row__item">
          <RouterLink :to="{ name: 'worksheet-editor' }" class="new-tile">
            <span class="new-tile__box" aria-hidden="true" />
            <span class="new-tile__label">Nový list</span>
          </RouterLink>
        </li>

        <template v-if="isLoading">
          <li v-for="n in 3" :key="`skeleton-${n}`" class="worksheets-row__item" aria-hidden="true">
            <div class="skeleton">
              <span class="skeleton__paper" />
              <span class="skeleton__bar" />
            </div>
          </li>
        </template>

        <template v-else-if="store.status === 'ready'">
          <li v-for="worksheet in store.items" :key="worksheet.id" class="worksheets-row__item">
            <WorksheetTile :worksheet="worksheet" @delete="deleteWorksheet" />
          </li>
        </template>
      </ul>
    </section>

    <div v-if="store.status === 'error'" class="notice notice--error" role="alert">
      <div>
        <p class="notice__title">Listy se nepodařilo načíst.</p>
        <p class="notice__detail">{{ store.error }}</p>
      </div>

      <button type="button" class="notice__button" @click="load">Zkusit znovu</button>
    </div>

    <div v-else-if="store.status === 'ready' && store.items.length === 0" class="notice">
      <div>
        <p class="notice__title">Zatím tu nemáte žádný list.</p>
        <p class="notice__detail">
          Začněte kliknutím na „Nový list“ a poskládejte ho z úloh ze své sbírky.
        </p>
      </div>
    </div>
  </main>
</template>

<style scoped>
.worksheets-page {
  /* The width of one tile (the paper and the "Nový list" box). */
  --tile-width: 9.5rem;

  width: min(80rem, 100%);
  box-sizing: border-box;
  margin: 0 auto;
  padding: 2rem clamp(1rem, 4vw, 2.5rem) 3rem;
}

/* ---------- heading ---------- */
.worksheets-page__header {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  margin-bottom: 1.5rem;
}

.worksheets-page__title {
  margin: 0;
  font-size: 1.6rem;
  font-weight: 500;
  text-decoration: underline;
  text-decoration-color: var(--color-primary);
  text-decoration-thickness: 3px;
  text-underline-offset: 6px;
}

.worksheets-page__count {
  padding: 0.05rem 0.7rem;
  background: var(--color-primary-soft);
  border-radius: 999px;
  font-size: 0.9rem;
  font-weight: 700;
}

/* ---------- the panel the row sits on ---------- */
.shelf {
  background: rgba(255, 255, 255, 0.55);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
}

.worksheets-row {
  display: flex;
  align-items: flex-start;
  gap: clamp(1.5rem, 4vw, 3.5rem);
  margin: 0;
  /* Room for the hover lift and the shadows, which overflow-x would otherwise clip. */
  padding: 1.5rem 1.75rem 1.25rem;
  overflow-x: auto;
  list-style: none;
  scroll-snap-type: x proximity;
}

.worksheets-row__item {
  flex: 0 0 var(--tile-width);
  min-width: 0;
  scroll-snap-align: start;
}

/* ---------- "Nový list" ---------- */
.new-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  color: var(--color-ink);
  text-decoration: none;
}

.new-tile__box {
  position: relative;
  width: 100%;
  aspect-ratio: 210 / 297; /* the same size as a sheet of paper */
  margin-bottom: 0.55rem;
  background: #d9d9d9;
  border-radius: 4px;
  transition:
    background 0.18s ease,
    transform 0.18s ease,
    box-shadow 0.18s ease;
}

/* The white plus. */
.new-tile__box::before,
.new-tile__box::after {
  position: absolute;
  top: 50%;
  left: 50%;
  background: #fff;
  border-radius: 2px;
  content: '';
  transform: translate(-50%, -50%);
}

.new-tile__box::before {
  width: 58%;
  height: 11%;
}

.new-tile__box::after {
  width: 11%;
  height: 40%;
}

.new-tile:hover .new-tile__box,
.new-tile:focus-visible .new-tile__box {
  background: var(--color-primary);
  box-shadow: 0 14px 28px rgba(6, 48, 61, 0.18);
  transform: translateY(-4px);
}

.new-tile__label {
  font-size: 1.05rem;
  font-weight: 600;
}

/* ---------- loading skeleton ---------- */
.skeleton {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.9rem;
}

.skeleton__paper {
  width: 100%;
  aspect-ratio: 210 / 297;
  border-radius: 4px;
}

.skeleton__bar {
  width: 70%;
  height: 0.9rem;
  border-radius: 999px;
}

.skeleton__paper,
.skeleton__bar {
  background: linear-gradient(
    90deg,
    var(--color-tint) 25%,
    var(--color-surface) 50%,
    var(--color-tint) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.4s linear infinite;
}

@keyframes shimmer {
  to {
    background-position: -200% 0;
  }
}

/* ---------- empty + error messages ---------- */
.notice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
  margin-top: 1.25rem;
  padding: 1rem 1.25rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-left: 5px solid var(--color-primary);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-card);
}

.notice--error {
  border-color: #fecaca;
  border-left-color: var(--color-danger);
}

.notice__title {
  margin: 0;
  font-weight: 700;
}

.notice__detail {
  margin: 0.2rem 0 0;
  color: var(--color-muted);
  font-size: 0.9rem;
  overflow-wrap: anywhere;
}

.notice__button {
  padding: 0.45rem 1.1rem;
  color: var(--color-on-primary);
  background: var(--color-primary);
  border: 1px solid var(--color-primary);
  border-radius: 999px;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.notice__button:hover {
  background: var(--color-primary-hover);
}

@media (prefers-reduced-motion: reduce) {
  .new-tile__box {
    transition: none;
  }

  .new-tile:hover .new-tile__box,
  .new-tile:focus-visible .new-tile__box {
    transform: none;
  }

  .skeleton__paper,
  .skeleton__bar {
    animation: none;
  }
}
</style>
