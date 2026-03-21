<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import {
  ContactRequestsList,
  ContactsList,
  useApplicantNetwork,
} from '@/features/contacts'
import { useSession } from '@/features/session/model/session'
import { ensureChatWithUser } from '@/shared/lib/chat'
import { saveStudentProfilePreview } from '@/shared/lib/profile-preview'
import { showErrorToast, showSuccessToast } from '@/shared/lib/toast'

const router = useRouter()
const session = useSession()
const network = useApplicantNetwork()

const form = reactive({
  toUserId: '',
  message: '',
})

const chatLoadingUserId = ref('')

const contacts = computed(() => network.contacts.value)
const requests = computed(() => network.requests.value)
const incomingRequests = computed(() => requests.value.filter((item) => item.direction === 'incoming'))
const outgoingRequests = computed(() => requests.value.filter((item) => item.direction === 'outgoing'))

async function handleSendRequest() {
  try {
    await network.sendRequest(form.toUserId, form.message)
    showSuccessToast('Запрос в контакты отправлен.')
    form.toUserId = ''
    form.message = ''
  } catch (error) {
    showErrorToast(error instanceof Error ? error.message : 'Не удалось отправить запрос.')
  }
}

async function handleOpenChat(userId: string) {
  chatLoadingUserId.value = userId

  try {
    const chat = await ensureChatWithUser({ participantUserId: userId })
    await router.push(`/chats/${chat.id}`)
  } catch (error) {
    showErrorToast(error instanceof Error ? error.message : 'Не удалось открыть чат.')
  } finally {
    chatLoadingUserId.value = ''
  }
}

function savePreview(userId: string, displayName: string, avatarUrl?: string, headline?: string) {
  saveStudentProfilePreview({
    id: userId,
    displayName,
    avatarUrl,
    headline,
  })
}

async function handleRequestAction(action: () => Promise<void>, successMessage: string) {
  try {
    await action()
    showSuccessToast(successMessage)
  } catch (error) {
    showErrorToast(error instanceof Error ? error.message : 'Не удалось обновить запрос.')
  }
}

onMounted(async () => {
  await session.restoreSession()

  if (session.currentUser.value?.id) {
    await network.loadNetwork(session.currentUser.value.id)
  }
})
</script>

<template>
  <main class="page-shell">
    <section class="contacts-page">
      <header class="contacts-hero">
        <div class="hero-copy">
          <p class="eyebrow">Network</p>
          <h1>Мои контакты и коннекты</h1>
          <p>
            Управляйте текущими контактами, входящими и исходящими запросами, а также быстро переходите в чат.
          </p>
        </div>
        <div class="hero-actions">
          <RouterLink to="/dashboard/applicant" class="ghost-button">В кабинет</RouterLink>
          <RouterLink to="/chats" class="ghost-button">Чаты</RouterLink>
        </div>
      </header>

      <p v-if="network.errorMessage.value" class="status-banner error">{{ network.errorMessage.value }}</p>
      <p v-else-if="network.isLoading.value" class="status-banner">Загружаем сеть контактов...</p>

      <section class="content-grid">
        <div class="main-column">
          <article class="section-card">
            <div class="section-head">
              <div>
                <p class="section-label">Контакты</p>
                <h2>Текущие связи</h2>
              </div>
            </div>

            <ContactsList
              :items="contacts"
              empty-title="Контактов пока нет"
              empty-text="Когда вы примете запрос или отправите успешный коннект, контакт появится здесь."
            >
              <template #actions="{ item }">
                <RouterLink
                  :to="`/profiles/students/${item.userId}`"
                  class="ghost-button"
                  @click="savePreview(item.userId, item.displayName, item.avatarUrl, item.headline)"
                >
                  Профиль
                </RouterLink>
                <button
                  class="primary-button"
                  type="button"
                  :disabled="chatLoadingUserId === item.userId"
                  @click="handleOpenChat(item.userId)"
                >
                  {{ chatLoadingUserId === item.userId ? 'Открываем чат...' : 'Написать' }}
                </button>
              </template>
            </ContactsList>
          </article>

          <div class="requests-grid">
            <article class="section-card">
              <div class="section-head">
                <div>
                  <p class="section-label">Входящие</p>
                  <h2>Запросы в контакты</h2>
                </div>
              </div>

              <ContactRequestsList
                :items="incomingRequests"
                empty-title="Входящих запросов нет"
                empty-text="Новые запросы появятся здесь."
              >
                <template #actions="{ item }">
                  <RouterLink
                    :to="`/profiles/students/${item.userId}`"
                    class="ghost-button"
                    @click="savePreview(item.userId, item.displayName, item.avatarUrl, item.headline)"
                  >
                    Профиль
                  </RouterLink>
                  <button
                    v-if="item.status === 'pending'"
                    class="primary-button"
                    type="button"
                    :disabled="network.updatingByRequestId.value[item.id]"
                    @click="handleRequestAction(() => network.acceptRequest(item.id), 'Запрос принят.')"
                  >
                    {{ network.updatingByRequestId.value[item.id] ? 'Сохраняем...' : 'Принять' }}
                  </button>
                  <button
                    v-if="item.status === 'pending'"
                    class="ghost-button"
                    type="button"
                    :disabled="network.updatingByRequestId.value[item.id]"
                    @click="handleRequestAction(() => network.rejectRequest(item.id), 'Запрос отклонён.')"
                  >
                    Отклонить
                  </button>
                </template>
              </ContactRequestsList>
            </article>

            <article class="section-card">
              <div class="section-head">
                <div>
                  <p class="section-label">Исходящие</p>
                  <h2>Отправленные запросы</h2>
                </div>
              </div>

              <ContactRequestsList
                :items="outgoingRequests"
                empty-title="Исходящих запросов нет"
                empty-text="Отправленные вами запросы появятся здесь."
              >
                <template #actions="{ item }">
                  <RouterLink
                    :to="`/profiles/students/${item.userId}`"
                    class="ghost-button"
                    @click="savePreview(item.userId, item.displayName, item.avatarUrl, item.headline)"
                  >
                    Профиль
                  </RouterLink>
                  <button
                    v-if="item.status === 'pending'"
                    class="ghost-button"
                    type="button"
                    :disabled="network.updatingByRequestId.value[item.id]"
                    @click="handleRequestAction(() => network.cancelRequest(item.id), 'Запрос отменён.')"
                  >
                    {{ network.updatingByRequestId.value[item.id] ? 'Сохраняем...' : 'Отменить' }}
                  </button>
                </template>
              </ContactRequestsList>
            </article>
          </div>
        </div>

        <aside class="side-column">
          <article class="section-card compact">
            <div class="section-head">
              <div>
                <p class="section-label">Новый коннект</p>
                <h2>Отправить запрос</h2>
              </div>
            </div>

            <form class="request-form" @submit.prevent="handleSendRequest">
              <label class="field">
                <span>to_user_id</span>
                <input v-model="form.toUserId" type="text" placeholder="user_123" required />
              </label>

              <label class="field">
                <span>message</span>
                <textarea v-model="form.message" rows="4" placeholder="Короткое сообщение к запросу" />
              </label>

              <button
                class="primary-button"
                type="submit"
                :disabled="!form.toUserId.trim() || network.sendingByUserId.value[form.toUserId.trim()]"
              >
                {{
                  network.sendingByUserId.value[form.toUserId.trim()]
                    ? 'Отправляем...'
                    : 'Отправить запрос'
                }}
              </button>
            </form>
          </article>

          <article class="section-card compact">
            <div class="section-head">
              <div>
                <p class="section-label">Рекомендации</p>
                <h2>Только action-flow</h2>
              </div>
            </div>
            <p class="section-copy">
              История рекомендаций пока не выводится отдельной страницей: backend поддерживает создание рекомендации,
              но ещё не отдаёт список.
            </p>
            <p class="section-copy">
              Рекомендовать соискателя можно прямо из его профиля.
            </p>
          </article>
        </aside>
      </section>
    </section>
  </main>
</template>

<style scoped>
.contacts-page,
.content-grid,
.main-column,
.side-column,
.requests-grid {
  display: grid;
  gap: 16px;
}

.contacts-page {
  max-width: 1240px;
  margin: 0 auto;
}

.contacts-hero,
.section-card,
.status-banner {
  padding: 20px;
  border: 1px solid rgba(18, 38, 63, 0.08);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 14px 30px rgba(15, 23, 42, 0.05);
}

.contacts-hero,
.section-head,
.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: start;
  justify-content: space-between;
}

.hero-copy {
  display: grid;
  gap: 8px;
}

.eyebrow,
.section-label {
  margin: 0;
  color: #2952cc;
  font: 700 0.72rem/1 var(--font-mono);
  text-transform: uppercase;
}

h1,
h2,
p {
  margin: 0;
}

h1,
h2 {
  color: #162033;
  font-family: var(--font-heading);
}

h1 {
  font-size: clamp(1.8rem, 3vw, 2.4rem);
}

.content-grid {
  grid-template-columns: minmax(0, 1fr) 320px;
  align-items: start;
}

.requests-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.section-card.compact {
  gap: 14px;
}

.section-copy,
.hero-copy p,
.field span,
.status-banner {
  color: #5f6b7a;
  line-height: 1.5;
}

.status-banner.error {
  color: var(--danger);
}

.request-form {
  display: grid;
  gap: 12px;
}

.field {
  display: grid;
  gap: 8px;
}

.field span {
  font-size: 0.82rem;
  font-weight: 600;
}

.field input,
.field textarea {
  min-height: 44px;
  padding: 11px 13px;
  border: 1px solid rgba(148, 163, 184, 0.3);
  border-radius: 10px;
  background: #fff;
  font: inherit;
}

.field textarea {
  min-height: 120px;
  resize: vertical;
}

@media (max-width: 1024px) {
  .content-grid,
  .requests-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .contacts-hero,
  .section-card,
  .status-banner {
    padding: 16px;
  }
}
</style>
