import { createRouter, createWebHistory } from 'vue-router'
import { editorRoutes } from '@/features/editor/routes'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/editor',
    },
    ...editorRoutes,
  ],
})

export default router