<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import type { ProblemEditorDraft } from '@/features/editor/types'

import { paginate } from '../lib/paginate'
import {
  CONTENT_HEIGHT_PX,
  PAGE_WIDTH_PX,
  paperCssVars,
  type PaperBlock,
} from '../lib/paper'
import type { WorksheetLayout } from '../types'
import WorksheetPaperBlock from './WorksheetPaperBlock.vue'

// The worksheet as it will look on A4 paper. Like in Word, a block that no longer
// fits at the bottom moves to a new page, and pages appear and vanish as needed.
//
// How: the blocks are drawn once in an invisible copy that is exactly as wide as
// the text area of a page. Their heights are measured there, and `paginate`
// deals them out to pages. The visible pages are rebuilt from that.
const props = defineProps<{
  title: string
  problems: ProblemEditorDraft[]
  layout: WorksheetLayout
}>()

const emit = defineEmits<{ pageCount: [count: number] }>()

/** Space kept free left and right of the sheet when it is scaled down to fit. */
const GUTTER_PX = 24

const root = ref<HTMLElement | null>(null)
const measurer = ref<HTMLElement | null>(null)

const heights = ref<Record<string, number>>({})
const isReady = ref(false) // the first measurement is done
const availableWidth = ref(0)

const blocks = computed<PaperBlock[]>(() => {
  const list: PaperBlock[] = []

  if (props.layout.showTitle || props.layout.showStudentLine) {
    list.push({ kind: 'heading', key: 'heading' })
  }

  props.problems.forEach((problem, index) => {
    list.push({
      kind: 'problem',
      key: `problem-${problem.id ?? index}`,
      number: index + 1,
      problem,
    })
  })

  return list
})

const pages = computed<PaperBlock[][]>(() =>
  paginate(
    blocks.value.map((block) => ({ block, height: heights.value[block.key] ?? 0 })),
    CONTENT_HEIGHT_PX,
  ).map((page) => page.map((item) => item.block)),
)

const cssVars = computed(() => paperCssVars(props.layout))

// A narrow screen scales the sheet down instead of scrolling sideways.
const zoom = computed(() => {
  if (availableWidth.value === 0) return 1
  return Math.min(1, Math.max(0.3, (availableWidth.value - 2 * GUTTER_PX) / PAGE_WIDTH_PX))
})

function measure() {
  const element = measurer.value
  if (!element) return

  const next: Record<string, number> = {}

  for (const child of Array.from(element.children) as HTMLElement[]) {
    const key = child.dataset.key
    if (key) next[key] = Math.ceil(child.getBoundingClientRect().height)
  }

  heights.value = next
  isReady.value = true
}

function measureAfterRender() {
  void nextTick(measure)
}

// Another order or another type setting changes the heights.
watch(() => blocks.value.map((block) => block.key).join('|'), measureAfterRender)
watch(() => props.layout, measureAfterRender, { deep: true })

watch(
  () => pages.value.length,
  (count) => emit('pageCount', count),
  { immediate: true },
)

let rootObserver: ResizeObserver | null = null
let measurerObserver: ResizeObserver | null = null

onMounted(() => {
  // Images and fonts arrive late and change the heights: measuring again when
  // the invisible copy changes size covers that.
  if (measurer.value) {
    measurerObserver = new ResizeObserver(measure)
    measurerObserver.observe(measurer.value)
  }

  if (root.value) {
    rootObserver = new ResizeObserver(([entry]) => {
      availableWidth.value = entry?.contentRect.width ?? 0
    })
    rootObserver.observe(root.value)
  }

  measureAfterRender()
})

onBeforeUnmount(() => {
  rootObserver?.disconnect()
  measurerObserver?.disconnect()
})
</script>

<template>
  <div ref="root" class="paper" :style="cssVars">
    <!-- Invisible copy, laid out at the real text width, only for measuring. -->
    <div ref="measurer" class="paper__measurer" aria-hidden="true">
      <WorksheetPaperBlock
        v-for="block in blocks"
        :key="block.key"
        :data-key="block.key"
        :block="block"
        :title="title"
        :layout="layout"
      />
    </div>

    <div class="paper__stack" :class="{ 'paper__stack--ready': isReady }" :style="{ zoom }">
      <figure v-for="(page, pageIndex) in pages" :key="pageIndex" class="paper__page">
        <article class="sheet" :aria-label="`Strana ${pageIndex + 1} z ${pages.length}`">
          <WorksheetPaperBlock
            v-for="block in page"
            :key="block.key"
            :block="block"
            :title="title"
            :layout="layout"
          />

          <p v-if="pageIndex === 0 && problems.length === 0" class="sheet__empty">
            List je zatím prázdný. Úlohy přidáte tlačítkem „Přidat úlohy“.
          </p>
        </article>

        <figcaption class="paper__caption">Strana {{ pageIndex + 1 }} z {{ pages.length }}</figcaption>
      </figure>
    </div>
  </div>
</template>

<style scoped>
.paper {
  position: relative;
  min-width: 0;
}

/* The type of the sheet and of its measured copy has to be identical. */
.sheet,
.paper__measurer {
  color: #14181a;
  font-family: var(--paper-font);
  font-size: var(--paper-font-size);
  line-height: 1.45;
}

.paper__measurer {
  position: fixed; /* fixed, so a tall copy never makes the page scrollable */
  top: 0;
  left: 0;
  z-index: -1;
  box-sizing: border-box;
  width: calc(var(--page-w) - 2 * var(--margin-x));
  visibility: hidden;
  pointer-events: none;
}

.paper__stack {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.75rem;
  visibility: hidden; /* until measured, so the first paint is not one overfull page */
}

.paper__stack--ready {
  visibility: visible;
}

.paper__page {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
}

/* A4 portrait. min-height, not height: a problem taller than a page grows its page. */
.sheet {
  position: relative;
  box-sizing: border-box;
  width: var(--page-w);
  min-height: var(--page-h);
  padding: var(--margin-y) var(--margin-x);
  background: #fff;
  box-shadow:
    0 1px 2px rgba(6, 48, 61, 0.14),
    0 10px 28px rgba(6, 48, 61, 0.16);
}

.sheet__empty {
  position: absolute;
  top: 45%;
  right: var(--margin-x);
  left: var(--margin-x);
  margin: 0;
  color: #7b888f;
  font-family: system-ui, sans-serif;
  font-size: 0.95rem;
  text-align: center;
}

.paper__caption {
  color: #4a585f;
  font-size: 0.8rem;
}
</style>
