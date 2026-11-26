import type { RouteRecordRaw } from 'vue-router'

// The static "editor" segment never collides with a future /worksheets/:id page.
export const worksheetRoutes: RouteRecordRaw[] = [
  {
    // The list of the user's worksheets.
    path: '/worksheets',
    name: 'worksheets',
    component: () => import('./pages/WorksheetsPage.vue'),
  },
  {
    // No id = a new worksheet, with id = edit that worksheet.
    path: '/worksheets/editor/:id?',
    name: 'worksheet-editor',
    component: () => import('./pages/WorksheetEditorPage.vue'),
    props: true,
  },
]
