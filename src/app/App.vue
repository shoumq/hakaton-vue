<script setup lang="ts">
import { RouterView } from 'vue-router'

import { PlatformHeader } from '@/widgets/platform-header'
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
