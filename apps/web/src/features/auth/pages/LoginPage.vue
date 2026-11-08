<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { authErrorMessage } from '../auth-messages'
import AuthCard from '../components/AuthCard.vue'
import { useAuthStore } from '../stores/authStore'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const email = ref('')
const password = ref('')
const error = ref('')
const busy = ref(false)

async function submit() {
  error.value = ''
  busy.value = true
  try {
    await auth.login({ email: email.value, password: password.value })
    // back to the page the guard interrupted (only paths inside the app)
    const target = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    await router.replace(target.startsWith('/') && !target.startsWith('//') ? target : '/')
  } catch (e) {
    error.value = authErrorMessage(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <AuthCard title="Přihlášení">
    <form class="auth__form" @submit.prevent="submit">
      <label class="auth__field">
        E-mail
        <input v-model="email" type="email" autocomplete="email" required />
      </label>

      <label class="auth__field">
        Heslo
        <input v-model="password" type="password" autocomplete="current-password" required />
      </label>

      <p v-if="error" class="auth__error" role="alert">{{ error }}</p>

      <button class="auth__submit" type="submit" :disabled="busy">
        {{ busy ? 'Přihlašuji…' : 'Přihlásit se' }}
      </button>
    </form>

    <p class="auth__switch">
      Nemáte účet? <RouterLink :to="{ name: 'register', query: route.query }">Zaregistrujte se</RouterLink>
    </p>
  </AuthCard>
</template>
