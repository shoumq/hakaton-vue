<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useSession } from '@/features/session/model/session'

const route = useRoute()
const router = useRouter()
const session = useSession()

const dashboardTarget = computed(() => {
  switch (session.role.value) {
    case 'student':
      return '/dashboard/applicant'
    case 'employer':
      return '/dashboard/employer'
    case 'curator':
      return '/dashboard/curator'
    default:
      return '/login'
  }
})

function signOut() {
  session.logout()
  router.push('/')
}

const isDashboardRoute = computed(() => route.path.startsWith('/dashboard'))
</script>

<template>
  <header class="platform-header">
    <div class="brand-block">
      <RouterLink class="brand-link" to="/">
        <span class="brand-dot"></span>
        Career Atlas
      </RouterLink>
      <p class="brand-copy">Вакансии, стажировки, менторство и карьерные события на одной карте.</p>
    </div>

    <nav class="header-nav">
      <RouterLink to="/" class="nav-link">Главная</RouterLink>
      <RouterLink v-if="!session.isAuthenticated.value" to="/login" class="nav-link">
        Вход
      </RouterLink>
      <RouterLink v-if="!session.isAuthenticated.value" to="/register" class="nav-link accent">
        Регистрация
      </RouterLink>
      <RouterLink v-else :to="dashboardTarget" class="nav-link accent">
        {{ isDashboardRoute ? 'Кабинет' : 'Открыть кабинет' }}
      </RouterLink>
      <button v-if="session.isAuthenticated.value" class="nav-link button-link" @click="signOut">
        Выйти
      </button>
    </nav>
  </header>
</template>

<style scoped>
.platform-header {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 12px 24px;
  border-bottom: 1px solid #d9e1ea;
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(12px);
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
}

.brand-block {
  display: grid;
  gap: 6px;
}

.brand-link {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font: 700 1.02rem/1 var(--font-heading);
  text-decoration: none;
  color: #1d2939;
}

.brand-dot {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  background: #0a66c2;
}

.brand-copy {
  margin: 0;
  color: #667085;
  font-size: 0.8rem;
}

.header-nav {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.nav-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 34px;
  padding: 0 12px;
  border-radius: 9px;
  border: 1px solid #d4dde7;
  background: #fff;
  text-decoration: none;
  color: #344054;
  font-size: 0.9rem;
}

.nav-link.accent {
  color: #fff;
  border-color: #0a66c2;
  background: #0a66c2;
}

.button-link {
  cursor: pointer;
}

@media (max-width: 900px) {
  .platform-header {
    flex-direction: column;
    align-items: flex-start;
    padding: 16px;
  }
}
</style>
