<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ApiError } from '../../../../shared/api/http'
import { authApi } from '../api/authApi'
import AuthCard from '../components/AuthCard.vue'
import { useAuthStore } from '../stores/authStore'

// A plain page for trying the user endpoints by hand: each button calls one endpoint
// and prints what came back.
const auth = useAuthStore()
const router = useRouter()
const output = ref('Zatím nic nezavoláno.')

async function run(label: string, call: () => Promise<unknown>) {
  try {
    const result = await call()
    output.value = `${label} → OK\n${JSON.stringify(result ?? null, null, 2)}`
  } catch (e) {
    output.value =
      e instanceof ApiError
        ? `${label} → ${e.status} ${e.code ?? ''}\n${e.message}`
        : `${label} → chyba\n${String(e)}`
  }
}

const me = () => run('GET /auth/me', authApi.me)
const refresh = () => run('POST /auth/refresh', authApi.refresh)

async function logout() {
  await auth.logout()
  await router.push({ name: 'login' })
}
</script>

<template>
  <AuthCard title="Můj účet">
    <dl v-if="auth.user" class="account">
      <dt>Jméno</dt>
      <dd>{{ auth.user.displayName }}</dd>
      <dt>Uživatelské jméno</dt>
      <dd>{{ auth.user.username }}</dd>
      <dt>E-mail</dt>
      <dd>{{ auth.user.email }}</dd>
      <dt>Role</dt>
      <dd>{{ auth.user.role }}</dd>
    </dl>

    <div class="account__buttons">
      <button class="auth__submit" type="button" @click="me">GET /auth/me</button>
      <button class="auth__submit" type="button" @click="refresh">POST /auth/refresh</button>
      <button class="auth__submit" type="button" @click="logout">Odhlásit</button>
    </div>

    <pre class="account__output">{{ output }}</pre>
  </AuthCard>
</template>

<style scoped>
.account {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.35rem 1rem;
  margin: 0 0 1.25rem;
}

.account dt {
  color: var(--color-muted);
}

.account dd {
  margin: 0;
  font-weight: 600;
}

.account__buttons {
  display: grid;
  gap: 0.5rem;
}

.account__output {
  margin: 1.25rem 0 0;
  padding: 0.75rem;
  overflow-x: auto;
  background: var(--color-tint);
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
}
</style>
