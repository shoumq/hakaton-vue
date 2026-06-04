<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import {
  createMyChat,
  fetchNetworking,
  getApiErrorMessage,
  updateContactRequest,
} from '@/shared/api'
import type {
  NetworkingContactRequestDto,
  NetworkingDto,
  NetworkingUserDto,
} from '@/shared/api'
import { formatDate } from '@/shared/lib/formatters'
import { showErrorToast, showSuccessToast } from '@/shared/lib/toast'

const router = useRouter()

const isLoading = ref(true)
const errorMessage = ref('')
const networking = ref<NetworkingDto | null>(null)
const updatingRequestId = ref('')
const openingChatUserId = ref('')

const contacts = computed(() => networking.value?.contacts ?? [])
const incomingRequests = computed(() => networking.value?.incoming_requests ?? [])
const outgoingRequests = computed(() => networking.value?.outgoing_requests ?? [])
const suggestedPeople = computed(() => networking.value?.suggested_people ?? [])

async function load() {
  isLoading.value = true
  errorMessage.value = ''
  try {
    networking.value = await fetchNetworking()
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, 'Не удалось загрузить нетворкинг.')
  } finally {
    isLoading.value = false
  }
}

async function handleAccept(request: NetworkingContactRequestDto) {
  updatingRequestId.value = request.id
  try {
    await updateContactRequest(request.id, { status: 'accepted' })
    showSuccessToast('Запрос принят')
    await load()
  } catch (error) {
    showErrorToast(getApiErrorMessage(error, 'Не удалось принять запрос.'))
  } finally {
    updatingRequestId.value = ''
  }
}

async function handleReject(request: NetworkingContactRequestDto) {
  updatingRequestId.value = request.id
  try {
    await updateContactRequest(request.id, { status: 'rejected' })
    showSuccessToast('Запрос отклонён')
    await load()
  } catch (error) {
    showErrorToast(getApiErrorMessage(error, 'Не удалось отклонить запрос.'))
  } finally {
    updatingRequestId.value = ''
  }
}

async function handleOpenChat(userId: string) {
  openingChatUserId.value = userId
  try {
    const chat = await createMyChat({ participant_user_id: userId })
    await router.push(`/chats/${chat.id}`)
  } catch (error) {
    showErrorToast(getApiErrorMessage(error, 'Не удалось открыть чат.'))
    openingChatUserId.value = ''
  }
}

function initials(name?: string) {
  if (!name) return '?'
  return name
    .split(' ')
    .map((w) => w[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function onlineLabel(user: NetworkingUserDto) {
  if (user.is_online) return 'онлайн'
  if (user.last_seen_at) return `был(а) ${formatDate(user.last_seen_at)}`
  return ''
}

function requestStatusLabel(status?: string) {
  const map: Record<string, string> = {
    pending: 'Ожидает',
    accepted: 'Принят',
    rejected: 'Отклонён',
    cancelled: 'Отменён',
  }
  return map[status ?? ''] ?? status ?? ''
}

function sourceLabel(source: string) {
  return source === 'mutual_contacts' ? 'Общие контакты' : 'Профиль студента'
}

onMounted(load)
</script>

<template>
  <main class="page-shell">
    <section class="nw-page">
      <header class="nw-header">
        <div>
          <p class="eyebrow">Network</p>
          <h1>Нетворкинг</h1>
        </div>
      </header>

      <p v-if="errorMessage" class="status-banner error">{{ errorMessage }}</p>
      <p v-else-if="isLoading" class="status-banner">Загружаем нетворкинг...</p>

      <template v-if="!isLoading && !errorMessage">

        <!-- Входящие запросы -->
        <section class="nw-section" :class="{ 'has-items': incomingRequests.length }">
          <div class="nw-section-head">
            <h2>Входящие запросы</h2>
            <span v-if="incomingRequests.length" class="nw-badge">{{ incomingRequests.length }}</span>
          </div>
          <p v-if="!incomingRequests.length" class="nw-empty">Входящих запросов нет.</p>
          <ul v-else class="nw-list">
            <li v-for="req in incomingRequests" :key="req.id" class="nw-request-card">
              <div class="nw-person">
                <div class="nw-avatar">
                  <img v-if="req.sender_avatar_url" :src="req.sender_avatar_url" :alt="req.sender_name" class="nw-avatar-img" />
                  <span v-else class="nw-avatar-fallback">{{ initials(req.sender_name) }}</span>
                </div>
                <div class="nw-person-copy">
                  <strong>{{ req.sender_name || req.sender_user_id || 'Пользователь' }}</strong>
                  <span v-if="req.message" class="nw-message">«{{ req.message }}»</span>
                  <span class="nw-meta">{{ formatDate(req.created_at) }}</span>
                </div>
              </div>
              <div class="nw-request-actions">
                <button
                  class="primary-button"
                  type="button"
                  :disabled="updatingRequestId === req.id"
                  @click="handleAccept(req)"
                >
                  {{ updatingRequestId === req.id ? '...' : 'Принять' }}
                </button>
                <button
                  class="ghost-button"
                  type="button"
                  :disabled="updatingRequestId === req.id"
                  @click="handleReject(req)"
                >
                  Отклонить
                </button>
              </div>
            </li>
          </ul>
        </section>

        <!-- Мои контакты -->
        <section class="nw-section">
          <div class="nw-section-head">
            <h2>Мои контакты</h2>
            <span v-if="contacts.length" class="nw-badge">{{ contacts.length }}</span>
          </div>
          <p v-if="!contacts.length" class="nw-empty">Контактов пока нет.</p>
          <ul v-else class="nw-grid">
            <li v-for="user in contacts" :key="user.id" class="nw-user-card">
              <div class="nw-avatar">
                <img v-if="user.avatar_url" :src="user.avatar_url" :alt="user.display_name" class="nw-avatar-img" />
                <span v-else class="nw-avatar-fallback">{{ initials(user.display_name) }}</span>
                <span v-if="user.is_online" class="nw-online-dot" />
              </div>
              <div class="nw-user-copy">
                <strong>{{ user.display_name || user.email || user.id }}</strong>
                <span v-if="onlineLabel(user)" class="nw-status" :class="{ online: user.is_online }">
                  {{ onlineLabel(user) }}
                </span>
              </div>
              <div class="nw-user-actions">
                <button
                  class="ghost-button small"
                  type="button"
                  :disabled="openingChatUserId === user.id"
                  @click="handleOpenChat(user.id)"
                >
                  {{ openingChatUserId === user.id ? '...' : 'Чат' }}
                </button>
              </div>
            </li>
          </ul>
        </section>

        <!-- Рекомендованные -->
        <section class="nw-section">
          <div class="nw-section-head">
            <h2>Рекомендованные люди</h2>
          </div>
          <p v-if="!suggestedPeople.length" class="nw-empty">Рекомендаций пока нет.</p>
          <ul v-else class="nw-grid">
            <li v-for="item in suggestedPeople" :key="item.user.id" class="nw-user-card">
              <div class="nw-avatar">
                <img v-if="item.user.avatar_url" :src="item.user.avatar_url" :alt="item.user.display_name" class="nw-avatar-img" />
                <span v-else class="nw-avatar-fallback">{{ initials(item.user.display_name) }}</span>
                <span v-if="item.user.is_online" class="nw-online-dot" />
              </div>
              <div class="nw-user-copy">
                <strong>{{ item.user.display_name || item.user.email || item.user.id }}</strong>
                <span class="nw-reason">{{ item.reason }}</span>
                <span class="nw-meta">{{ sourceLabel(item.source) }}</span>
              </div>
            </li>
          </ul>
        </section>

        <!-- Исходящие запросы -->
        <section class="nw-section">
          <div class="nw-section-head">
            <h2>Исходящие запросы</h2>
            <span v-if="outgoingRequests.length" class="nw-badge">{{ outgoingRequests.length }}</span>
          </div>
          <p v-if="!outgoingRequests.length" class="nw-empty">Исходящих запросов нет.</p>
          <ul v-else class="nw-list">
            <li v-for="req in outgoingRequests" :key="req.id" class="nw-request-card">
              <div class="nw-person">
                <div class="nw-avatar">
                  <img v-if="req.receiver_avatar_url" :src="req.receiver_avatar_url" :alt="req.receiver_name" class="nw-avatar-img" />
                  <span v-else class="nw-avatar-fallback">{{ initials(req.receiver_name) }}</span>
                </div>
                <div class="nw-person-copy">
                  <strong>{{ req.receiver_name || req.receiver_user_id || 'Пользователь' }}</strong>
                  <span v-if="req.message" class="nw-message">«{{ req.message }}»</span>
                  <span class="nw-meta">{{ formatDate(req.created_at) }} · {{ requestStatusLabel(req.status) }}</span>
                </div>
              </div>
            </li>
          </ul>
        </section>

      </template>
    </section>
  </main>
</template>

<style scoped>
.nw-page {
  display: grid;
  gap: 20px;
  max-width: 860px;
  margin: 0 auto;
}

.nw-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
}

.nw-header h1 {
  margin: 4px 0 0;
  font-family: var(--font-heading);
  font-size: 1.7rem;
  color: #1d2939;
}

.eyebrow {
  margin: 0;
  color: var(--muted);
  font: 700 0.7rem/1 var(--font-mono, monospace);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.status-banner {
  padding: 12px 16px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  font-size: 0.9rem;
}

.status-banner.error {
  color: var(--danger, #d65a4b);
  border-color: #f5c6c2;
  background: #fef7f6;
}

.nw-section {
  padding: 18px 20px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--surface);
  display: grid;
  gap: 14px;
}

.nw-section.has-items {
  border-color: rgba(53, 96, 223, 0.18);
}

.nw-section-head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.nw-section-head h2 {
  margin: 0;
  font-family: var(--font-heading);
  font-size: 1rem;
  color: #1d2939;
}

.nw-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  border-radius: 999px;
  background: #3560df;
  color: #fff;
  font-size: 0.72rem;
  font-weight: 700;
}

.nw-empty {
  margin: 0;
  color: #8a9ab5;
  font-size: 0.88rem;
}

/* ---- list layout (requests) ---- */
.nw-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 10px;
}

.nw-request-card {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid #e8edf3;
  border-radius: 10px;
  background: var(--surface-strong);
}

/* ---- grid layout (contacts / suggested) ---- */
.nw-grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px;
}

.nw-user-card {
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 8px;
  padding: 14px;
  border: 1px solid #e8edf3;
  border-radius: 10px;
  background: var(--surface-strong);
}

/* ---- person row ---- */
.nw-person {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  flex: 1;
}

/* ---- avatar ---- */
.nw-avatar {
  position: relative;
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  overflow: visible;
}

.nw-avatar-img {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
}

.nw-avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #3560df 0%, #17338f 100%);
  color: #fff;
  font-size: 0.78rem;
  font-weight: 700;
}

.nw-online-dot {
  position: absolute;
  bottom: 1px;
  right: 1px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #1f9d67;
  border: 2px solid #fff;
}

/* ---- copy ---- */
.nw-person-copy,
.nw-user-copy {
  display: grid;
  gap: 2px;
}

.nw-person-copy strong,
.nw-user-copy strong {
  font-size: 0.9rem;
  color: #1d2939;
  line-height: 1.3;
}

.nw-message {
  font-size: 0.82rem;
  color: var(--muted);
  font-style: italic;
}

.nw-meta {
  font-size: 0.76rem;
  color: #8a9ab5;
}

.nw-reason {
  font-size: 0.8rem;
  color: #3560df;
  font-weight: 500;
}

.nw-status {
  font-size: 0.76rem;
  color: #8a9ab5;
}

.nw-status.online {
  color: #1f9d67;
  font-weight: 500;
}

/* ---- actions ---- */
.nw-request-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
  align-items: center;
}

.nw-user-actions {
  margin-top: 4px;
}

.ghost-button.small {
  min-height: 30px;
  padding: 0 12px;
  font-size: 0.8rem;
}
</style>

<style scoped>
:global(.dark) .nw-section { background: var(--surface); border-color: var(--border); }
:global(.dark) .nw-request-card { background: var(--surface-strong); border-color: var(--border); }
:global(.dark) .nw-user-card { background: var(--surface-strong); border-color: var(--border); }
:global(.dark) .nw-badge { background: #0f1e38; color: #60a5fa; }
:global(.dark) .nw-avatar { background: var(--surface-muted); border-color: var(--border); }
:global(.dark) .nw-section-head h2 { color: var(--text); }
:global(.dark) .nw-person-copy strong, :global(.dark) .nw-user-copy strong { color: var(--text); }
:global(.dark) .nw-message, :global(.dark) .nw-meta { color: var(--muted); }
:global(.dark) .status-banner { background: var(--surface); border-color: var(--border); color: var(--muted); }
:global(.dark) .status-banner.error { background: #1f0808; border-color: #7f1d1d; color: #fca5a5; }
</style>
