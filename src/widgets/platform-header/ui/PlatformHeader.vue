<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useSession } from '@/features/session/model/session'
import { fetchNotifications, getApiErrorMessage } from '@/shared/api'
import type { NotificationDto } from '@/shared/api'
import { formatDate } from '@/shared/lib/formatters'

const route = useRoute()
const router = useRouter()
const session = useSession()
const notifications = ref<NotificationDto[]>([])
const isNotificationsOpen = ref(false)
const isNotificationsLoading = ref(false)
const notificationsError = ref('')

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
const unreadCount = computed(() => notifications.value.filter((item) => item.is_read === false).length)
const previewNotifications = computed(() => notifications.value.slice(0, 5))

async function loadNotifications() {
  if (!session.isAuthenticated.value) {
    notifications.value = []
    return
  }

  isNotificationsLoading.value = true
  notificationsError.value = ''

  try {
    notifications.value = await fetchNotifications()
  } catch (error) {
    notificationsError.value = getApiErrorMessage(error, 'Не удалось загрузить уведомления.')
    notifications.value = []
  } finally {
    isNotificationsLoading.value = false
  }
}

function toggleNotifications() {
  isNotificationsOpen.value = !isNotificationsOpen.value

  if (isNotificationsOpen.value && !notifications.value.length && !isNotificationsLoading.value) {
    void loadNotifications()
  }
}

function closeNotificationsOnOutsideClick(event: MouseEvent) {
  const target = event.target as HTMLElement | null

  if (!target?.closest('.notifications-menu-shell')) {
    isNotificationsOpen.value = false
  }
}

function getNotificationLink(notification: NotificationDto) {
  if (notification.related_entity_type === 'opportunity' && notification.related_entity_id) {
    return `/opportunities/${notification.related_entity_id}`
  }

  return '/notifications'
}

watch(
  () => session.isAuthenticated.value,
  (isAuthenticated) => {
    if (!isAuthenticated) {
      notifications.value = []
      isNotificationsOpen.value = false
      return
    }

    void loadNotifications()
  },
  { immediate: true },
)

watch(
  () => route.fullPath,
  () => {
    isNotificationsOpen.value = false
  },
)

onMounted(() => {
  document.addEventListener('click', closeNotificationsOnOutsideClick)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', closeNotificationsOnOutsideClick)
})
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
      <div v-if="session.isAuthenticated.value" class="notifications-menu-shell">
        <button class="nav-link icon-button" type="button" @click.stop="toggleNotifications">
          <span class="bell-icon" aria-hidden="true">◔</span>
          <span v-if="unreadCount" class="notification-badge">{{ unreadCount }}</span>
        </button>

        <div v-if="isNotificationsOpen" class="notifications-dropdown" @click.stop>
          <div class="dropdown-head">
            <strong>Уведомления</strong>
            <RouterLink to="/notifications" class="dropdown-link">Все</RouterLink>
          </div>

          <p v-if="notificationsError" class="dropdown-status error">{{ notificationsError }}</p>
          <p v-else-if="isNotificationsLoading" class="dropdown-status">Загружаем...</p>
          <p v-else-if="!previewNotifications.length" class="dropdown-status">Пока пусто</p>

          <div v-else class="dropdown-list">
            <RouterLink
              v-for="notification in previewNotifications"
              :key="notification.id"
              :to="getNotificationLink(notification)"
              class="dropdown-item"
            >
              <div class="dropdown-item-head">
                <strong>
                  {{ notification.type === 'recommendation_received' ? 'Вас пригласили' : notification.title || 'Уведомление' }}
                </strong>
                <span>{{ notification.created_at ? formatDate(notification.created_at) : '' }}</span>
              </div>
              <p>{{ notification.body || notification.title || 'Без текста уведомления' }}</p>
              <span v-if="notification.related_entity_id" class="dropdown-meta">
                {{ notification.related_entity_type || 'entity' }}: {{ notification.related_entity_id }}
              </span>
            </RouterLink>
          </div>
        </div>
      </div>
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
  border-bottom: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.94);
  backdrop-filter: blur(12px);
  box-shadow: var(--shadow-soft);
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
  color: var(--text);
}

.brand-dot {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  background: var(--accent);
}

.brand-copy {
  margin: 0;
  color: var(--muted);
  font-size: 0.8rem;
}

.header-nav {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.notifications-menu-shell {
  position: relative;
}

.nav-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 34px;
  padding: 0 12px;
  border-radius: 9px;
  border: 1px solid var(--border);
  background: var(--surface);
  text-decoration: none;
  color: var(--text);
  font-size: 0.9rem;
}

.icon-button {
  position: relative;
  width: 38px;
  padding: 0;
}

.bell-icon {
  font-size: 1rem;
  line-height: 1;
}

.notification-badge {
  position: absolute;
  top: -5px;
  right: -5px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--accent);
  color: #fff;
  font-size: 0.7rem;
  font-weight: 700;
}

.notifications-dropdown {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  z-index: 30;
  width: 340px;
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 16px 34px rgba(15, 23, 42, 0.12);
}

.dropdown-head,
.dropdown-item-head {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 10px;
}

.dropdown-head strong,
.dropdown-item-head strong {
  color: var(--text);
}

.dropdown-link,
.dropdown-meta {
  color: var(--accent-strong);
  text-decoration: none;
  font-size: 0.8rem;
}

.dropdown-status {
  margin: 0;
  color: var(--muted);
  font-size: 0.86rem;
}

.dropdown-status.error {
  color: var(--danger);
}

.dropdown-list {
  display: grid;
  gap: 8px;
}

.dropdown-item {
  display: grid;
  gap: 6px;
  padding: 10px 11px;
  border: 1px solid #e4eaf1;
  border-radius: 10px;
  background: #fafbfd;
  text-decoration: none;
}

.dropdown-item p,
.dropdown-item-head span {
  margin: 0;
  color: var(--muted);
  font-size: 0.8rem;
  line-height: 1.45;
}

.nav-link.accent {
  color: #fff;
  border-color: var(--accent);
  background: var(--accent);
}

.nav-link:hover {
  border-color: var(--border-strong);
  background: var(--surface-muted);
}

.nav-link.accent:hover {
  border-color: var(--accent-strong);
  background: var(--accent-strong);
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

  .notifications-dropdown {
    left: 0;
    right: auto;
    width: min(340px, calc(100vw - 32px));
  }
}
</style>
