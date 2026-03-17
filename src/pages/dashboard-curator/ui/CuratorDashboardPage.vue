<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import { useSession } from '@/features/session/model/session'
import {
  fetchCuratorAuditLogs,
  fetchCuratorCompanyVerifications,
  fetchCuratorModerationQueue,
  getApiErrorMessage,
  uploadMyAvatar,
} from '@/shared/api'
import type { AuditLogDto, ModerationQueueItemDto, VerificationDto } from '@/shared/api'

const session = useSession()
const moderationQueue = ref<ModerationQueueItemDto[]>([])
const companyVerifications = ref<VerificationDto[]>([])
const auditLogs = ref<AuditLogDto[]>([])
const isLoading = ref(true)
const errorMessage = ref('')
const avatarError = ref('')

const queueSize = computed(() => moderationQueue.value.length + companyVerifications.value.length)
const avatarFallback = computed(() => {
  const value = session.currentUser.value?.displayName || session.currentUser.value?.email || 'U'

  return value
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
})

async function handleAvatarChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  if (!file) {
    return
  }

  isLoading.value = true
  avatarError.value = ''

  try {
    const user = await uploadMyAvatar(file)
    session.patchCurrentUser({
      displayName: user.display_name || session.currentUser.value?.displayName || user.email,
      avatarUrl: user.avatar_url,
    })
  } catch (error) {
    avatarError.value = getApiErrorMessage(error, 'Не удалось загрузить аватар.')
  } finally {
    isLoading.value = false
    input.value = ''
  }
}

function getQueueTitle(item: ModerationQueueItemDto | VerificationDto) {
  if ('title' in item && typeof item.title === 'string' && item.title) {
    return item.title
  }

  if ('company_id' in item && item.company_id) {
    return item.company_id
  }

  if ('entity_id' in item && item.entity_id) {
    return item.entity_id
  }

  return 'Элемент модерации'
}

function getQueueType(item: ModerationQueueItemDto | VerificationDto) {
  if ('entity_type' in item && item.entity_type) {
    return item.entity_type
  }

  if ('verification_method' in item && item.verification_method) {
    return item.verification_method
  }

  return 'moderation'
}

function getQueueDetails(item: ModerationQueueItemDto | VerificationDto) {
  if ('documents_comment' in item && item.documents_comment) {
    return item.documents_comment
  }

  if ('created_at' in item && item.created_at) {
    return item.created_at
  }

  if ('submitted_at' in item && item.submitted_at) {
    return item.submitted_at
  }

  return 'Дополнительные детали не указаны.'
}

onMounted(async () => {
  isLoading.value = true
  errorMessage.value = ''

  try {
    const [queue, verifications, logs] = await Promise.all([
      fetchCuratorModerationQueue(),
      fetchCuratorCompanyVerifications(),
      fetchCuratorAuditLogs(),
    ])

    moderationQueue.value = queue
    companyVerifications.value = verifications
    auditLogs.value = logs
  } catch (error) {
    errorMessage.value = getApiErrorMessage(
      error,
      'Не удалось загрузить curator-ручки. Нужен вход через /api/auth/curator/login.',
    )
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <main class="page-shell">
    <section class="dashboard">
      <div class="dashboard-hero">
        <div>
          <p class="eyebrow">Кабинет куратора</p>
          <h1>Модерация платформы</h1>
          <p class="hero-copy">
            Куратор модерирует карточки возможностей, подтверждает компании и управляет качеством данных
            на платформе.
          </p>
        </div>
        <div class="hero-panel">
          <div class="avatar-shell large">
            <img
              v-if="session.currentUser.value?.avatarUrl"
              :src="session.currentUser.value.avatarUrl"
              alt="Аватар пользователя"
              class="avatar-image"
            />
            <span v-else class="avatar-fallback">{{ avatarFallback }}</span>
          </div>
          <label class="avatar-upload">
            <input type="file" accept="image/*" @change="handleAvatarChange" />
            {{ isLoading ? 'Загрузка...' : 'Загрузить фото' }}
          </label>
          <span v-if="avatarError" class="upload-error">{{ avatarError }}</span>
          <strong>{{ queueSize }} задач в очереди</strong>
          <span>Проверка компаний</span>
          <span>Модерация возможностей</span>
          <span>Аудит действий</span>
        </div>
      </div>

      <p v-if="errorMessage" class="status-banner error">{{ errorMessage }}</p>
      <p v-else-if="isLoading" class="status-banner">Загружаем curator-данные...</p>

      <section class="dashboard-grid">
        <article class="section-card">
          <h2>Администрирование кураторов</h2>
          <p>
            В API уже есть ручка `POST /api/curator/users` для создания новых кураторов. На этом этапе
            страница интегрирована с очередью, верификациями и аудитом.
          </p>
        </article>

        <article class="section-card">
          <h2>Эффективная модерация</h2>
          <p>
            Очередь строится по приоритету и типу сущности: сначала верификация компаний, затем публикация
            возможностей, затем ревизия профилей.
          </p>
        </article>
      </section>

      <section class="dashboard-section">
        <h2>Очередь модерации</h2>
        <div class="queue-list">
          <div v-if="!moderationQueue.length && !companyVerifications.length" class="queue-card">
            <strong>Очередь пуста или недоступна</strong>
            <span>API не вернул элементов модерации.</span>
          </div>
          <div
            v-for="item in [...companyVerifications, ...moderationQueue]"
            :key="item.id"
            class="queue-card"
          >
            <strong>{{ getQueueTitle(item) }}</strong>
            <span>Статус: {{ item.status || 'pending' }}</span>
            <span>Тип: {{ getQueueType(item) }}</span>
            <p>{{ getQueueDetails(item) }}</p>
          </div>
        </div>
      </section>

      <section class="dashboard-section">
        <h2>Аудит действий</h2>
        <div class="queue-list">
          <div v-if="!auditLogs.length" class="queue-card">
            <strong>Логи пока не получены</strong>
            <span>Эта секция подключена к `GET /api/curator/audit-logs`.</span>
          </div>
          <div v-for="log in auditLogs" :key="log.id" class="queue-card">
            <strong>{{ log.action || 'curator action' }}</strong>
            <span>Сущность: {{ log.entity_type || 'unknown' }}</span>
            <p>{{ log.created_at || 'Время не указано' }}</p>
          </div>
        </div>
      </section>
    </section>
  </main>
</template>

<style scoped>
.dashboard,
.dashboard-grid,
.dashboard-section,
.queue-list {
  display: grid;
  gap: 16px;
}

.dashboard {
  max-width: 1240px;
  margin: 0 auto;
}

.dashboard-hero,
.section-card,
.dashboard-section {
  padding: 18px 20px;
  border: 1px solid #d7dee7;
  border-radius: 14px;
  background: var(--surface);
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
}

.dashboard-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 16px;
}

.hero-panel,
.queue-card {
  display: grid;
  gap: 8px;
  padding: 14px;
  border: 1px solid #e4eaf1;
  border-radius: 10px;
  background: var(--surface-strong);
}

.avatar-shell {
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 999px;
  background: var(--surface);
  border: 1px solid var(--border);
}

.avatar-shell.large {
  width: 96px;
  height: 96px;
}

.avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-fallback {
  font: 700 1.1rem/1 var(--font-mono);
  color: var(--accent-strong);
}

.avatar-upload {
  color: var(--accent-strong);
  font-size: 0.88rem;
  cursor: pointer;
}

.avatar-upload input {
  display: none;
}

.upload-error {
  color: var(--danger);
  font-size: 0.8rem;
}

.eyebrow {
  margin: 0;
  color: var(--accent-strong);
  font: 700 0.72rem/1 var(--font-mono);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

h1,
h2 {
  margin: 0;
  font-family: var(--font-heading);
}

h1 {
  font-size: clamp(1.55rem, 3vw, 1.95rem);
}

.hero-copy,
.section-card p,
.hero-panel span,
.queue-card span,
.queue-card p {
  margin: 0;
  color: var(--muted);
  line-height: 1.5;
  font-size: 0.92rem;
}

.status-banner {
  margin: 0;
  padding: 12px 14px;
  border: 1px solid #d7dee7;
  border-radius: 12px;
  background: var(--surface);
  font-size: 0.9rem;
}

.status-banner.error {
  color: var(--danger);
}

.dashboard-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

@media (max-width: 900px) {
  .dashboard-hero,
  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}
</style>
