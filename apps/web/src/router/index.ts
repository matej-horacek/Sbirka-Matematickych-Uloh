import { createRouter, createWebHistory } from 'vue-router'
import { authRoutes } from '@/features/auth/routes'
import { useAuthStore } from '@/features/auth/stores/authStore'
import { editorRoutes } from '@/features/editor/routes'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/editor',
    },
    ...authRoutes,
    ...editorRoutes,
  ],
})

// Every page needs a login except those with meta.public (login, register).
router.beforeEach(async (to) => {
  const auth = useAuthStore()
  await auth.init() // asks the API once who the cookies belong to (also after a page reload)

  if (!to.meta.public && !auth.isLoggedIn) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  // Already logged in: no reason to see the login or register form.
  if (to.meta.public && auth.isLoggedIn) return '/'
})

export default router
