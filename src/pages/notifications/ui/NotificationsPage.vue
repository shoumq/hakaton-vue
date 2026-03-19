<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import { useSession } from '@/features/session/model/session'
import {
  fetchNotifications,
  fetchOpportunityById,
  getApiErrorMessage,
} from '@/shared/api'
import type { NotificationDto, OpportunityDetails } from '@/shared/api'
import { startChatFromNotification } from '@/shared/lib/chat'
import { formatDate } from '@/shared/lib/formatters'

type NotificationFilter = 'all' | 'recommendations'

interface InvitationNotificationViewModel {
  notification: NotificationDto
  opportunity: OpportunityDetails | null
  loadError: string
}

const notifications = ref<NotificationDto[]>([])
const opportunitiesById = ref<Record<string, OpportunityDetails | null>>({})
const opportunityErrors = ref<Record<string, string>>({})
const isLoading = ref(true)
const startingChatId = ref('')
const errorMessage = ref('')
const activeFilter = ref<NotificationFilter>('all')
const router = useRouter()
const session = useSession()
const currentUserId = computed(() => session.currentUser.value?.id || '')
const chatButtonLabel = computed(() =>
  session.role.value === 'employer' ? 'Написать кандидату' : 'Написать работодателю',
)

const invitationNotifications = computed(() =>
  notifications.value.filter((item) => item.type === 'recommendation_received'),
)

const visibleNotifications = computed(() => {
  if (activeFilter.value === 'recommendations') {
    return invitationNotifications.value
  }

  return notifications.value
})

const invitationCards = computed<InvitationNotificationViewModel[]>(() =>
  invitationNotifications.value.map((notification) => ({
    notification,
    opportunity: notification.related_entity_id
      ? opportunitiesById.value[notification.related_entity_id] ?? null
      : null,
    loadError: notification.related_entity_id
      ? opportunityErrors.value[notification.related_entity_id] ?? ''
      : '',
  })),
)

async function loadNotifications() {
  isLoading.value = true
  errorMessage.value = ''

  try {
    const list = await fetchNotifications()
    notifications.value = list

    const opportunityIds = Array.from(
      new Set(
        list
          .filter(
            (item) =>
              item.type === 'recommendation_received' &&
              item.related_entity_type === 'opportunity' &&
              item.related_entity_id,
          )
          .map((item) => item.related_entity_id as string),
      ),
    )

    if (!opportunityIds.length) {
      opportunitiesById.value = {}
      opportunityErrors.value = {}
      return
    }

    const results = await Promise.allSettled(opportunityIds.map((id) => fetchOpportunityById(id)))
    const detailsMap: Record<string, OpportunityDetails | null> = {}
    const errorMap: Record<string, string> = {}

    results.forEach((result, index) => {
      const id = opportunityIds[index]

      if (result.status === 'fulfilled') {
        detailsMap[id] = result.value
        return
      }

      detailsMap[id] = null
      errorMap[id] = getApiErrorMessage(result.reason, 'Не удалось загрузить карточку возможности.')
    })

    opportunitiesById.value = detailsMap
    opportunityErrors.value = errorMap
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, 'Не удалось загрузить уведомления.')
    notifications.value = []
    opportunitiesById.value = {}
    opportunityErrors.value = {}
  } finally {
    isLoading.value = false
  }
}

function getNotificationTitle(notification: NotificationDto) {
  if (notification.type === 'recommendation_received') {
    return notification.title || 'Вас пригласили'
  }

  return notification.title || 'Уведомление'
}

function getNotificationBody(notification: NotificationDto) {
  return notification.body || 'Текст уведомления отсутствует.'
}

function canStartChat(notification: NotificationDto) {
  return Boolean(
    notification.employer_user_id &&
      currentUserId.value &&
      notification.employer_user_id !== currentUserId.value,
  )
}

async function handleStartChat(notification: NotificationDto) {
  if (!canStartChat(notification)) {
    errorMessage.value = 'Нельзя открыть чат с самим собой.'
    return
  }

  startingChatId.value = notification.id
  errorMessage.value = ''

  try {
    const chat = await startChatFromNotification(notification)
    await router.push(`/chats/${chat.id}`)
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, 'Не удалось открыть чат с работодателем.')
  } finally {
    startingChatId.value = ''
  }
}

onMounted(loadNotifications)
</script>

<template>
  <main class="page-shell">
    <section class="notifications-page">
      <header class="notifications-hero">
        <div class="hero-copy">
          <p class="eyebrow">Notifications</p>
          <h1>Уведомления</h1>
          <p class="hero-text">Все уведомления аккаунта в одном месте. Отдельно можно посмотреть только приглашения.</p>
        </div>
        <div class="hero-actions">
          <button
            type="button"
            class="filter-button"
            :class="{ active: activeFilter === 'all' }"
            @click="activeFilter = 'all'"
          >
            Все · {{ notifications.length }}
          </button>
          <button
            type="button"
            class="filter-button"
            :class="{ active: activeFilter === 'recommendations' }"
            @click="activeFilter = 'recommendations'"
          >
            Приглашения · {{ invitationNotifications.length }}
          </button>
          <RouterLink to="/" class="secondary-button">На главную</RouterLink>
        </div>
      </header>

      <p v-if="errorMessage" class="status-banner error">{{ errorMessage }}</p>
      <p v-else-if="isLoading" class="status-banner">Загружаем уведомления...</p>
      <p v-else-if="!visibleNotifications.length" class="status-banner">
        {{ activeFilter === 'recommendations' ? 'Приглашений пока нет.' : 'Уведомлений пока нет.' }}
      </p>

      <section v-if="!isLoading && activeFilter === 'all' && visibleNotifications.length" class="notifications-list">
        <article
          v-for="notification in visibleNotifications"
          :key="notification.id"
          class="notification-card"
          :class="{ unread: notification.is_read === false }"
        >
          <div class="notification-head">
            <div>
              <p class="notification-type">
                {{ notification.type === 'recommendation_received' ? 'Приглашение' : notification.type || 'Системное уведомление' }}
              </p>
              <h2>{{ getNotificationTitle(notification) }}</h2>
            </div>
            <span class="notification-date">
              {{ notification.created_at ? formatDate(notification.created_at) : 'Дата не указана' }}
            </span>
          </div>
          <p class="notification-body">{{ getNotificationBody(notification) }}</p>
          <div class="notification-meta">
            <span>{{ notification.is_read ? 'Прочитано' : 'Не прочитано' }}</span>
            <span v-if="notification.related_entity_type && notification.related_entity_id">
              {{ notification.related_entity_type }}: {{ notification.related_entity_id }}
            </span>
          </div>
          <div class="card-actions">
            <RouterLink
              v-if="notification.related_entity_type === 'opportunity' && notification.related_entity_id"
              :to="`/opportunities/${notification.related_entity_id}`"
              class="secondary-button"
            >
              Открыть возможность
            </RouterLink>
            <button
              v-if="canStartChat(notification)"
              type="button"
              class="primary-button"
              :disabled="startingChatId === notification.id"
              @click="handleStartChat(notification)"
            >
              {{ startingChatId === notification.id ? 'Открываем чат...' : chatButtonLabel }}
            </button>
          </div>
        </article>
      </section>

      <section
        v-if="!isLoading && activeFilter === 'recommendations' && invitationCards.length"
        class="invitation-list"
      >
        <article
          v-for="card in invitationCards"
          :key="card.notification.id"
          class="invitation-card"
          :class="{ unread: card.notification.is_read === false }"
        >
          <div class="notification-head">
            <div>
              <p class="notification-type">Вас пригласили</p>
              <h2>{{ getNotificationTitle(card.notification) }}</h2>
            </div>
            <span class="notification-date">
              {{ card.notification.created_at ? formatDate(card.notification.created_at) : 'Дата не указана' }}
            </span>
          </div>

          <p class="notification-body">{{ getNotificationBody(card.notification) }}</p>

          <div class="invitation-grid">
            <div class="invitation-detail">
              <span>Возможность</span>
              <strong>{{ card.notification.opportunity_title || card.opportunity?.title || `ID: ${card.notification.related_entity_id || 'не указан'}` }}</strong>
            </div>
            <div class="invitation-detail">
              <span>Компания</span>
              <strong>{{ card.notification.company_legal_name || card.opportunity?.companyName || 'Не удалось загрузить' }}</strong>
            </div>
            <div class="invitation-detail">
              <span>Тип</span>
              <strong>{{ card.opportunity?.type || 'Не удалось загрузить' }}</strong>
            </div>
            <div class="invitation-detail">
              <span>Контакты работодателя</span>
              <strong>{{ card.notification.employer_contacts || 'Не указаны' }}</strong>
            </div>
            <div class="invitation-detail">
              <span>Статус уведомления</span>
              <strong>{{ card.notification.is_read ? 'Прочитано' : 'Не прочитано' }}</strong>
            </div>
          </div>

          <p v-if="card.loadError" class="inline-error">
            {{ card.loadError }} {{ card.notification.related_entity_id ? `ID: ${card.notification.related_entity_id}` : '' }}
          </p>

          <div class="card-actions">
            <RouterLink
              v-if="card.notification.related_entity_id"
              :to="`/opportunities/${card.notification.related_entity_id}`"
              class="primary-button"
            >
              Открыть
            </RouterLink>
            <button
              v-if="card.notification.employer_user_id"
              type="button"
              class="secondary-button"
              :disabled="startingChatId === card.notification.id"
              @click="handleStartChat(card.notification)"
            >
              {{ startingChatId === card.notification.id ? 'Открываем чат...' : 'Написать работодателю' }}
            </button>
          </div>
        </article>
      </section>
    </section>
  </main>
</template>

<style scoped>
.notifications-page {
  max-width: 1080px;
  margin: 0 auto;
  display: grid;
  gap: 16px;
}

.notifications-hero,
.notification-card,
.invitation-card,
.status-banner {
  border: 1px solid rgba(18, 38, 63, 0.08);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 10px 22px rgba(15, 23, 42, 0.045);
}

.notifications-hero {
  display: grid;
  gap: 14px;
  padding: 18px;
}

.hero-copy,
.hero-actions,
.notifications-list,
.invitation-list {
  display: grid;
  gap: 12px;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
}

.eyebrow,
.notification-type {
  margin: 0;
  color: #2952cc;
  font-size: 0.74rem;
  font-weight: 700;
  text-transform: uppercase;
}

h1,
h2 {
  margin: 0;
  color: #162033;
  font-family: var(--font-heading);
}

h1 {
  font-size: clamp(1.7rem, 3vw, 2.3rem);
}

h2 {
  font-size: 1.05rem;
}

.hero-text,
.notification-body,
.notification-meta,
.notification-date,
.invitation-detail span {
  margin: 0;
  color: #5f6b7a;
  line-height: 1.55;
}

.filter-button,
.secondary-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 36px;
  padding: 0 13px;
  border-radius: 8px;
  text-decoration: none;
  font: inherit;
  cursor: pointer;
}

.filter-button,
.secondary-button {
  border: 1px solid #d7dee7;
  background: #fff;
  color: #2952cc;
}

.filter-button.active {
  border-color: rgba(41, 82, 204, 0.28);
  background: rgba(41, 82, 204, 0.08);
  color: #1e3fa0;
}

.notification-card,
.invitation-card {
  display: grid;
  gap: 12px;
  padding: 16px;
}

.card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.notification-card.unread,
.invitation-card.unread {
  border-color: rgba(41, 82, 204, 0.22);
  box-shadow: 0 10px 24px rgba(41, 82, 204, 0.07);
}

.notification-head {
  display: flex;
  flex-wrap: wrap;
  align-items: start;
  justify-content: space-between;
  gap: 10px;
}

.notification-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 0.86rem;
}

.invitation-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.invitation-detail {
  display: grid;
  gap: 5px;
  padding: 11px 12px;
  border: 1px solid #e4eaf1;
  border-radius: 10px;
  background: #fafbfd;
}

.invitation-detail strong {
  color: #162033;
  line-height: 1.4;
}

.status-banner {
  margin: 0;
  padding: 12px 14px;
  font-size: 0.92rem;
}

.status-banner.error,
.inline-error {
  color: var(--danger);
}

.inline-error {
  margin: 0;
  font-size: 0.88rem;
}

@media (max-width: 720px) {
  .notifications-hero,
  .notification-card,
  .invitation-card {
    padding: 14px;
  }

  .invitation-grid {
    grid-template-columns: 1fr;
  }
}
</style>
