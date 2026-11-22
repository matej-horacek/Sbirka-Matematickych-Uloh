import type { RouteRecordRaw } from 'vue-router'

// The /catalog area. Today it only holds the worksheet list; the public
// catalog of all worksheets and problems will grow here.
export const catalogRoutes: RouteRecordRaw[] = [
  {
    path: '/catalog',
    redirect: { name: 'catalog-worksheets' },
  },
  {
    path: '/catalog/worksheets',
    name: 'catalog-worksheets',
    component: () => import('./pages/WorksheetsPage.vue'),
  },
]
