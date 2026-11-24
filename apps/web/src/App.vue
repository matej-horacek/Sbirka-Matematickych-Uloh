<script setup lang="ts">
import { ref } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import AppNavbar from '../shared/ui/layout/Navbar.vue'

const route = useRoute()
const router = useRouter()


const ready = ref(false)
void router.isReady().then(() => {
  ready.value = true
})
</script>

<template>
  <AppNavbar v-if="ready && !route.meta.public" />
  <RouterView />
</template>