import type { RouteRecordRaw } from 'vue-router'

export const editorRoutes: RouteRecordRaw[] = [
  {
    path: '/editor',
    name: 'editor',
    component: () => import('./pages/EditorPage.vue'),
  },
]