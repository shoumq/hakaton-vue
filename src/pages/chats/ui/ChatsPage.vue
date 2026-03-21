<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { useSession } from '@/features/session/model/session'
import {
  fetchChatMessages,
  fetchMyChats,
  getApiErrorMessage,
  sendChatMessage,
} from '@/shared/api'
import type { ChatConversationDto, ChatMessageDto } from '@/shared/api'
import { ChatSocketClient } from '@/shared/lib/chat'
import { formatDate } from '@/shared/lib/formatters'
import { saveCompanyProfilePreview, saveStudentProfilePreview } from '@/shared/lib/profile-preview'

type SocketState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected'

const route = useRoute()
const router = useRouter()
const session = useSession()

const chats = ref<ChatConversationDto[]>([])
const messages = ref<ChatMessageDto[]>([])
const isChatsLoading = ref(true)
const isMessagesLoading = ref(false)
const chatsError = ref('')
const messagesError = ref('')
const sendingError = ref('')
const isSending = ref(false)
const socketState = ref<SocketState>('idle')
const chatClient = ref<ChatSocketClient | null>(null)

const messageForm = reactive({
  body: '',
})

const selectedChatId = computed(() => {
  const value = route.params.id
  return typeof value === 'string' ? value : ''
})

const selectedChat = computed(() => chats.value.find((item) => item.id === selectedChatId.value) || null)
const currentUserId = computed(() => session.currentUser.value?.id || '')
const selectedChatProfileLink = computed(() => {
  const chat = selectedChat.value

  if (session.role.value === 'employer') {
    return chat?.participant_user_id ? `/profiles/students/${chat.participant_user_id}` : ''
  }

  const companyId = chat?.company_id || chat?.participant_user_id
  return companyId ? `/profiles/companies/${companyId}` : ''
})

function saveChatProfilePreview(chat: ChatConversationDto | null) {
  if (session.role.value === 'employer') {
    if (!chat?.participant_user_id) {
      return
    }

    saveStudentProfilePreview({
      id: chat.participant_user_id,
      displayName: chat.participant_name || 'Кандидат',
      avatarUrl: chat.participant_avatar_url,
      sourceOpportunityTitle: chat.opportunity_title,
    })
    return
  }

  const companyId = chat?.company_id || chat?.participant_user_id

  if (!companyId) {
    return
  }

  saveCompanyProfilePreview({
    id: companyId,
    companyName: chat.company_legal_name || chat.participant_name || 'Компания',
    avatarUrl: chat.participant_avatar_url,
    sourceOpportunityTitle: chat.opportunity_title,
  })
}

function sortAndDedupeMessages(list: ChatMessageDto[]) {
  const byId = new Map<string, ChatMessageDto>()

  list.forEach((item) => {
    byId.set(item.id, item)
  })

  return Array.from(byId.values()).sort((left, right) => {
    return new Date(left.created_at || 0).getTime() - new Date(right.created_at || 0).getTime()
  })
}

async function loadChats() {
  isChatsLoading.value = true
  chatsError.value = ''

  try {
    chats.value = await fetchMyChats()
    chats.value.forEach((chat) => saveChatProfilePreview(chat))

    if (!selectedChatId.value && chats.value[0]?.id) {
      await router.replace(`/chats/${chats.value[0].id}`)
    }
  } catch (error) {
    chatsError.value = getApiErrorMessage(error, 'Не удалось загрузить список чатов.')
    chats.value = []
  } finally {
    isChatsLoading.value = false
  }
}

async function loadMessages(chatId: string) {
  isMessagesLoading.value = true
  messagesError.value = ''

  try {
    messages.value = sortAndDedupeMessages(await fetchChatMessages(chatId))
  } catch (error) {
    messagesError.value = getApiErrorMessage(error, 'Не удалось загрузить сообщения.')
    messages.value = []
  } finally {
    isMessagesLoading.value = false
  }
}

function disconnectSocket() {
  chatClient.value?.close()
  chatClient.value = null
  socketState.value = 'disconnected'
}

function connectSocket(chatId: string) {
  disconnectSocket()

  const token = session.token.value

  if (!token) {
    socketState.value = 'disconnected'
    return
  }

  chatClient.value = new ChatSocketClient({
    token,
    conversationId: chatId,
    apiBaseHttp: import.meta.env.VITE_DEV_API_BASE_URL || import.meta.env.VITE_API_BASE_URL,
    wsBase: import.meta.env.VITE_WS_BASE_URL,
    onMessage: (message) => {
      messages.value = sortAndDedupeMessages([...messages.value, message])
    },
    onStateChange: (state) => {
      socketState.value = state
    },
    onError: (error) => {
      messagesError.value = getApiErrorMessage(error, 'Ошибка realtime-соединения чата.')
    },
    reconnect: true,
  })

  chatClient.value.connect()
}

function saveSelectedChatProfilePreview() {
  saveChatProfilePreview(selectedChat.value)
}

async function handleSendMessage() {
  sendingError.value = ''
  const body = messageForm.body

  if (!selectedChatId.value || !body.trim()) {
    return
  }

  isSending.value = true

  try {
    const sentViaSocket = chatClient.value?.send(body) ?? false

    if (!sentViaSocket) {
      const message = await sendChatMessage(selectedChatId.value, { body })
      messages.value = sortAndDedupeMessages([...messages.value, message])
    }

    messageForm.body = ''
  } catch (error) {
    sendingError.value = getApiErrorMessage(error, 'Не удалось отправить сообщение.')
  } finally {
    isSending.value = false
  }
}

onMounted(async () => {
  await session.restoreSession()
  await loadChats()
})

watch(
  selectedChatId,
  async (chatId) => {
    sendingError.value = ''

    if (!chatId) {
      disconnectSocket()
      messages.value = []
      return
    }

    await loadMessages(chatId)
    connectSocket(chatId)
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  disconnectSocket()
})
</script>

<template>
  <main class="page-shell">
    <section class="chats-page">

      <div class="chat-layout">
        <aside class="chat-sidebar">
          <div class="panel-head">
            <h2>Диалоги</h2>
          </div>
          <p v-if="chatsError" class="panel-status error">{{ chatsError }}</p>
          <p v-else-if="isChatsLoading" class="panel-status">Загружаем чаты...</p>
          <p v-else-if="!chats.length" class="panel-status">Чатов пока нет.</p>

          <div v-else class="conversation-list">
            <RouterLink
              v-for="chat in chats"
              :key="chat.id"
              :to="`/chats/${chat.id}`"
              class="conversation-card"
              :class="{ active: selectedChatId === chat.id }"
            >
              <div class="conversation-head">
                <div class="conversation-avatar">
                  <img
                    v-if="chat.participant_avatar_url"
                    :src="chat.participant_avatar_url"
                    alt="avatar"
                    class="avatar-image"
                  />
                  <span v-else class="avatar-fallback">
                    {{ (chat.participant_name || chat.company_legal_name || 'C').slice(0, 2).toUpperCase() }}
                  </span>
                </div>
                <div class="conversation-copy">
                  <strong>{{ chat.participant_name || 'Собеседник' }}</strong>
                  <span>{{ chat.company_legal_name || 'Компания не указана' }}</span>
                </div>
              </div>
              <p class="conversation-opportunity">{{ chat.opportunity_title || 'Возможность не указана' }}</p>
              <div class="conversation-meta">
                <span>{{ chat.last_message || 'Сообщений пока нет' }}</span>
                <span>{{ chat.last_message_at ? formatDate(chat.last_message_at) : '' }}</span>
              </div>
            </RouterLink>
          </div>
        </aside>

        <section class="chat-main">
          <div v-if="selectedChat" class="chat-panel">
            <div class="panel-head">
              <div>
                <h2>{{ selectedChat.participant_name || selectedChat.company_legal_name || 'Чат' }}</h2>
                <p class="hero-copy">{{ selectedChat.opportunity_title || 'Без привязки к возможности' }}</p>
              </div>
              <RouterLink
                v-if="selectedChatProfileLink"
                :to="selectedChatProfileLink"
                class="ghost-button"
                @click="saveSelectedChatProfilePreview"
              >
                {{ session.role.value === 'employer' ? 'Профиль кандидата' : 'Профиль компании' }}
              </RouterLink>
            </div>

            <p v-if="messagesError" class="panel-status error">{{ messagesError }}</p>
            <p v-else-if="isMessagesLoading" class="panel-status">Загружаем сообщения...</p>
            <p v-else-if="!messages.length" class="panel-status">Сообщений пока нет. Начните диалог.</p>

            <div v-else class="messages-list">
              <article
                v-for="message in messages"
                :key="message.id"
                class="message-card"
                :class="{ mine: message.sender_user_id === currentUserId }"
              >
                <div class="message-avatar">
                  <img
                    v-if="message.sender_avatar_url"
                    :src="message.sender_avatar_url"
                    alt="avatar"
                    class="avatar-image"
                  />
                  <span v-else class="avatar-fallback">
                    {{ (message.sender_name || 'U').slice(0, 2).toUpperCase() }}
                  </span>
                </div>
                <div class="message-bubble">
                  <strong>{{ message.sender_name || message.sender_user_id || 'Пользователь' }}</strong>
                  <p class="message-body">{{ message.body || '' }}</p>
                  <span>{{ message.created_at ? formatDate(message.created_at) : '' }}</span>
                </div>
              </article>
            </div>

            <form class="message-form" @submit.prevent="handleSendMessage">
              <textarea
                v-model="messageForm.body"
                rows="3"
                placeholder="Введите сообщение"
              />
              <div class="message-form-actions">
                <p v-if="sendingError" class="panel-status error">{{ sendingError }}</p>
                <button class="primary-button" type="submit" :disabled="isSending || !messageForm.body.trim()">
                  {{ isSending ? 'Отправляем...' : 'Отправить' }}
                </button>
              </div>
            </form>
          </div>

          <div v-else class="chat-panel empty-state">
            <h2>Выберите чат</h2>
            <p class="hero-copy">Откройте диалог из списка слева или перейдите из приглашения в уведомлениях.</p>
          </div>
        </section>
      </div>
    </section>
  </main>
</template>

<style scoped>
.chats-page {
  max-width: 1180px;
  margin: 0 auto;
  display: grid;
  gap: 16px;
}

.chats-hero,
.chat-sidebar,
.chat-panel {
  border: 1px solid rgba(18, 38, 63, 0.08);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 10px 22px rgba(15, 23, 42, 0.045);
}

.chats-hero,
.chat-sidebar,
.chat-panel {
  padding: 16px;
}

.chat-layout {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

.hero-actions,
.conversation-list,
.messages-list,
.message-form,
.chat-sidebar,
.chat-panel {
  display: grid;
  gap: 12px;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
}

.eyebrow {
  margin: 0 0 6px;
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

.hero-copy,
.panel-status,
.conversation-meta,
.conversation-opportunity {
  margin: 0;
  color: #5f6b7a;
  line-height: 1.5;
}

.panel-status.error {
  color: var(--danger);
}

.panel-head,
.conversation-head,
.message-form-actions {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 10px;
}

.conversation-card {
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid #e4eaf1;
  border-radius: 10px;
  background: #fafbfd;
  text-decoration: none;
}

.conversation-card.active {
  border-color: rgba(41, 82, 204, 0.22);
  background: rgba(41, 82, 204, 0.06);
}

.conversation-avatar,
.message-avatar {
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 50%;
  background: #eef3f8;
  border: 1px solid #d7dee7;
}

.avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-fallback {
  color: #24456b;
  font-size: 0.82rem;
  font-weight: 700;
}

.conversation-copy {
  display: grid;
  gap: 4px;
}

.conversation-copy strong,
.message-bubble strong {
  color: #162033;
}

.conversation-copy span {
  color: #5f6b7a;
  font-size: 0.82rem;
}

.conversation-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 0.8rem;
}

.socket-state {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  background: #eef3f8;
  color: #24456b;
  font-size: 0.8rem;
  text-transform: capitalize;
}

.socket-state.connected {
  background: rgba(25, 135, 84, 0.12);
  color: #198754;
}

.socket-state.reconnecting,
.socket-state.connecting {
  background: rgba(197, 138, 28, 0.12);
  color: #c58a1c;
}

.socket-state.disconnected {
  background: rgba(196, 69, 54, 0.12);
  color: #c44536;
}

.message-card {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr);
  gap: 10px;
  align-items: end;
}

.message-card.mine {
  grid-template-columns: minmax(0, 1fr) 44px;
}

.message-card.mine .message-avatar {
  order: 2;
}

.message-card.mine .message-bubble {
  order: 1;
  background: rgba(41, 82, 204, 0.08);
}

.message-bubble {
  display: grid;
  gap: 6px;
  padding: 12px;
  border: 1px solid #e4eaf1;
  border-radius: 12px;
  background: #fafbfd;
}

.message-bubble p,
.message-bubble span {
  margin: 0;
  color: #162033;
  line-height: 1.5;
}

.message-body {
  white-space: pre-wrap;
  word-break: break-word;
}

.message-bubble span {
  color: #5f6b7a;
  font-size: 0.8rem;
}

.message-form textarea {
  min-height: 92px;
  padding: 11px 12px;
  border: 1px solid #d7dee7;
  border-radius: 10px;
  background: #fff;
  resize: vertical;
  font: inherit;
}

.secondary-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 36px;
  padding: 0 13px;
  border-radius: 8px;
  text-decoration: none;
  font: inherit;
}

.secondary-button {
  border: 1px solid #d7dee7;
  background: #fff;
  color: #2952cc;
}

.empty-state {
  align-content: center;
  min-height: 300px;
}

@media (max-width: 900px) {
  .chat-layout {
    grid-template-columns: 1fr;
  }
}
</style>
