import type { RouteRecordRaw } from 'vue-router'

// meta.public: reachable without a login (the router guard sends everyone else to /login).
export const authRoutes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('./pages/LoginPage.vue'),
    meta: { public: true },
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('./pages/RegisterPage.vue'),
    meta: { public: true },
  },
  {
    // Simple page for trying the user endpoints (needs a login).
    path: '/user',
    name: 'account',
    component: () => import('./pages/AccountPage.vue'),
  },
]
