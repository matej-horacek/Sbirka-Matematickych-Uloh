import type { RouteRecordRaw } from 'vue-router'

// The editor lives under /catalog/worksheets, next to the list.
// The static "editor" segment never collides with a future /catalog/worksheets/:id page.
export const worksheetRoutes: RouteRecordRaw[] = [
  {
    // No id = a new worksheet, with id = edit that worksheet.
    path: '/catalog/worksheets/editor/:id?',
    name: 'worksheet-editor',
    component: () => import('./pages/WorksheetEditorPage.vue'),
    props: true,
  },
]
