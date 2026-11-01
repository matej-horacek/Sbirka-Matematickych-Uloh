import { createApp } from 'vue'
import { createPinia } from 'pinia'

//import { useAuthStore } from '@/features/auth/stores/authStore'

import { setAccessToken } from '../shared/lib/http'
import '../shared/styles/global.css'

import App from './App.vue'
import router from './router'

// Demo login until the real auth exists: the mock API takes `Bearer <username>` (jan, eva, petr).
const demoUser = import.meta.env.VITE_DEMO_USER
if (demoUser) setAccessToken(demoUser)

const app = createApp(App)

app.use(createPinia())
app.use(router)

//useAuthStore().init()

app.mount('#app')
