import { createApp } from 'vue'
import { createPinia } from 'pinia'

//import { useAuthStore } from '@/features/auth/stores/authStore'

import '../shared/styles/global.css'

import App from './App.vue'
import router from './router'

const app = createApp(App)

app.use(createPinia())
app.use(router)

//useAuthStore().init()

app.mount('#app')
