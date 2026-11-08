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
const username = ref('')
const displayName = ref('')
const password = ref('')
const error = ref('')
const busy = ref(false)

async function submit() {
  error.value = ''
  busy.value = true
  try {
    // registering also logs in (the API sets both cookies)
    await auth.register({
      email: email.value,
      username: username.value,
      password: password.value,
      displayName: displayName.value.trim() || null,
    })
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
  <AuthCard title="Registrace učitele">
    <form class="auth__form" @submit.prevent="submit">
      <label class="auth__field">
        E-mail
        <input v-model="email" type="email" autocomplete="email" required />
      </label>

      <label class="auth__field">
        Uživatelské jméno
        <input v-model="username" type="text" autocomplete="username" minlength="2" maxlength="100" required />
      </label>

      <label class="auth__field">
        Zobrazované jméno
        <input v-model="displayName" type="text" autocomplete="name" maxlength="100" />
        <span class="auth__hint">Nepovinné. Bez něj se zobrazí uživatelské jméno.</span>
      </label>

      <label class="auth__field">
        Heslo
        <input v-model="password" type="password" autocomplete="new-password" minlength="8" maxlength="255" required />
        <span class="auth__hint">Alespoň 8 znaků.</span>
      </label>

      <p v-if="error" class="auth__error" role="alert">{{ error }}</p>

      <button class="auth__submit" type="submit" :disabled="busy">
        {{ busy ? 'Vytvářím účet…' : 'Vytvořit účet' }}
      </button>
    </form>

    <p class="auth__switch">
      Už máte účet? <RouterLink :to="{ name: 'login', query: route.query }">Přihlaste se</RouterLink>
    </p>
  </AuthCard>
</template>
