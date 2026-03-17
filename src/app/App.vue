<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'

import { useSession } from '@/features/session/model/session'
import { PlatformHeader } from '@/widgets/platform-header'

const session = useSession()

onMounted(() => {
  void session.restoreSession()
})
</script>

<template>
  <div class="app-shell">
    <PlatformHeader />
    <RouterView />
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
  background: var(--bg);
}
</style>
