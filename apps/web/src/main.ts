import { createApp } from 'vue'
import { createPinia } from 'pinia'

import { useAuthStore } from '@/features/auth/stores/authStore'

import { setSessionExpiredHandler } from '../shared/lib/http'
import '../shared/styles/global.css'

import App from './App.vue'
import router from './router'

const app = createApp(App)

app.use(createPinia())
app.use(router)

// The access cookie expired and the refresh cookie did not work either: back to the login page.
setSessionExpiredHandler(() => {
  useAuthStore().clear()
  const current = router.currentRoute.value
  if (!current.meta.public) {
    void router.push({ name: 'login', query: { redirect: current.fullPath } })
  }
})

app.mount('#app')
