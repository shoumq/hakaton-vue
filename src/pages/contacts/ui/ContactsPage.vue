<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import {
  ContactRequestsList,
  ContactsList,
  useApplicantNetwork,
} from '@/features/contacts'
import { useSession } from '@/features/session/model/session'
import { RecommendationComposer } from '@/features/recommendations'
import { fetchStudents, getApiErrorMessage } from '@/shared/api'
import type { PublicStudentProfileDto } from '@/shared/api'
import { ensureChatWithUser } from '@/shared/lib/chat'
import { saveStudentProfilePreview } from '@/shared/lib/profile-preview'
import { showErrorToast, showSuccessToast } from '@/shared/lib/toast'

const router = useRouter()
const session = useSession()
const network = useApplicantNetwork()

const chatLoadingUserId = ref('')
const listLoading = ref(false)
const listError = ref('')
const students = ref<PublicStudentProfileDto[]>([])
const filters = reactive({
  search: '',
  universityName: '',
  faculty: '',
  specialization: '',
  studyYear: '',
})
const recommendationTarget = ref<{ userId: string; label: string } | null>(null)
let searchDebounce: number | null = null

const dashboardTarget = computed(() => {
  if (session.role.value === 'employer') {
    return '/dashboard/employer'
  }

  if (session.role.value === 'curator') {
    return '/dashboard/curator'
  }

  return '/dashboard/applicant'
})

const contacts = computed(() => network.contacts.value)
const requests = computed(() => network.requests.value)
const filteredContacts = computed(() => contacts.value)
const incomingRequests = computed(() =>
  requests.value.filter((item) => item.direction === 'incoming'),
)
const outgoingRequests = computed(() =>
  requests.value.filter((item) => item.direction === 'outgoing'),
)
const fallbackDirectory = computed(() => {
  const byUserId = new Map<
    string,
    {
      id: string
      userId: string
      displayName: string
      avatarUrl?: string
      headline: string
      about: string
      studyYear: string
      graduationYear: string
      hasResume: boolean
      hasPortfolio: boolean
      resumeCount: number
      portfolioCount: number
    }
  >()

  for (const item of [...contacts.value, ...incomingRequests.value, ...outgoingRequests.value]) {
    if (!item.userId || item.userId === session.currentUser.value?.id) {
      continue
    }

    if (byUserId.has(item.userId)) {
      continue
    }

    byUserId.set(item.userId, {
      id: item.userId,
      userId: item.userId,
      displayName: item.displayName || 'Соискатель',
      avatarUrl: item.avatarUrl,
      headline: item.headline || 'Профиль кандидата',
      about: item.message || '',
      studyYear: '',
      graduationYear: '',
      hasResume: false,
      hasPortfolio: false,
      resumeCount: 0,
      portfolioCount: 0,
    })
  }

  return [...byUserId.values()]
})
const heroTitle = computed(() =>
  session.role.value === 'employer' ? 'Список соискателей и коннектов' : 'Мои контакты и коннекты',
)
const heroDescription = computed(() =>
  session.role.value === 'employer'
    ? 'Здесь собраны соискатели, с которыми у вас уже есть контакт или запрос в сеть. Открывайте профиль и добавляйте новые коннекты.'
    : 'Управляйте текущими контактами, входящими и исходящими запросами, а также быстро переходите в чат.',
)
const studentCards = computed(() =>
  students.value.length
    ? students.value
        .filter((item) => item.user_id && item.user_id !== session.currentUser.value?.id)
        .map((item) => {
          const firstName = item.first_name?.trim() ?? ''
          const lastName = item.last_name?.trim() ?? ''
          const displayName = item.display_name?.trim() ?? ''
          const fullName =
            [firstName, lastName].filter(Boolean).join(' ') || displayName || item.user_id || 'Соискатель'
          const headline = [item.university_name, item.faculty, item.specialization].filter(Boolean).join(' • ')

          return {
            id: item.user_id || fullName,
            userId: item.user_id || '',
            displayName: fullName,
            avatarUrl: item.avatar_url,
            headline: headline || 'Профиль кандидата',
            about: item.about || '',
            studyYear: item.study_year ? `Курс ${item.study_year}` : '',
            graduationYear: item.graduation_year ? `Выпуск ${item.graduation_year}` : '',
            hasResume: Boolean(item.has_resume || item.resume_count),
            hasPortfolio: Boolean(item.has_portfolio || item.portfolio_count),
            resumeCount: item.resume_count ?? 0,
            portfolioCount: item.portfolio_count ?? 0,
          }
        })
    : fallbackDirectory.value,
)

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

async function loadStudents() {
  listLoading.value = true
  listError.value = ''

  try {
    students.value = await fetchStudents({
      search: filters.search,
      university_name: filters.universityName,
      faculty: filters.faculty,
      specialization: filters.specialization,
      study_year: filters.studyYear ? Number(filters.studyYear) : null,
    })
  } catch (error) {
    listError.value = getApiErrorMessage(error, 'Не удалось загрузить список соискателей.')
    students.value = []
  } finally {
    listLoading.value = false
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
    await Promise.allSettled([network.loadNetwork(session.currentUser.value.id), loadStudents()])
  } else {
    await loadStudents()
  }
})

watch(
  () => [filters.search, filters.universityName, filters.faculty, filters.specialization, filters.studyYear].join('|'),
  () => {
    if (searchDebounce) {
      window.clearTimeout(searchDebounce)
    }

    searchDebounce = window.setTimeout(() => {
      void loadStudents()
    }, 250)
  },
)
</script>

<template>
  <main class="page-shell">
    <section class="contacts-page">
      <header class="contacts-hero">
        <div class="hero-copy">
          <p class="eyebrow">Network</p>
          <h1>{{ heroTitle }}</h1>
          <p>{{ heroDescription }}</p>
        </div>
        <div class="hero-actions">
          <RouterLink :to="dashboardTarget" class="ghost-button">В кабинет</RouterLink>
          <RouterLink to="/chats" class="ghost-button">Чаты</RouterLink>
        </div>
      </header>

      <article class="section-card compact">
        <div class="section-head">
          <div>
            <p class="section-label">Поиск</p>
            <h2>Найти соискателя</h2>
          </div>
        </div>
        <div class="search-grid">
          <input v-model="filters.search" type="text" placeholder="Имя, университет или специализация" />
          <input v-model="filters.universityName" type="text" placeholder="Университет" />
          <input v-model="filters.faculty" type="text" placeholder="Факультет" />
          <input v-model="filters.specialization" type="text" placeholder="Специализация" />
          <input v-model="filters.studyYear" type="number" min="1" placeholder="Курс" />
        </div>
        <div class="search-meta-row">
          <span class="search-meta">{{ studentCards.length }} соискателей</span>
        </div>
      </article>

      <section class="content-grid1">
        <div class="main-column">
          <article class="section-card">
            <div class="section-head">
              <div>
                <p class="section-label">Соискатели</p>
                <h2>Каталог кандидатов</h2>
              </div>
            </div>
            <p v-if="listLoading" class="status-banner">Загружаем список соискателей...</p>
            <p v-else-if="listError && studentCards.length" class="status-banner">
              {{ listError }} Показываем контакты и запросы, которые уже есть в вашей сети.
            </p>
            <p v-else-if="listError" class="status-banner error">{{ listError }}</p>
            <div v-else-if="!studentCards.length" class="empty-directory">
              <strong>Соискатели не найдены</strong>
              <p>Попробуйте изменить поиск или фильтры.</p>
            </div>
            <div v-else class="directory-grid">
              <article v-for="item in studentCards" :key="item.id" class="student-card">
                <div class="student-card-head">
                  <div class="student-avatar">
                    <img v-if="item.avatarUrl" :src="item.avatarUrl" :alt="item.displayName" class="student-avatar-image" />
                    <span v-else class="student-avatar-fallback">{{ item.displayName.slice(0, 2).toUpperCase() }}</span>
                  </div>
                  <div class="student-copy">
                    <strong>{{ item.displayName }}</strong>
                    <span>{{ item.headline }}</span>
                  </div>
                </div>

                <div class="student-actions">
                  <button
                    class="primary-button"
                    type="button"
                    :disabled="chatLoadingUserId === item.userId"
                    @click="handleOpenChat(item.userId)"
                  >
                    {{ chatLoadingUserId === item.userId ? 'Открываем чат...' : 'Написать' }}
                  </button>
                </div>
              </article>
            </div>
          </article>

          <article class="section-card">
            <div class="section-head">
              <div>
                <p class="section-label">Контакты</p>
                <h2>Ваши связи</h2>
              </div>
            </div>

            <ContactsList
              :items="filteredContacts"
              empty-title="Контактов пока нет"
              empty-text="Когда вы примете запрос или добавите соискателя в сеть, контакт появится здесь."
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
                  <h2>Запросы от соискателей</h2>
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

          </div>
        </div>
      </section>

      <RecommendationComposer
        v-if="recommendationTarget"
        :open="Boolean(recommendationTarget)"
        :to-user-id="recommendationTarget.userId"
        :target-label="recommendationTarget.label"
        @close="recommendationTarget = null"
        @submitted="recommendationTarget = null"
      />
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

.search-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
}

.search-grid input {
  min-height: 44px;
  padding: 0 13px;
  border: 1px solid rgba(148, 163, 184, 0.3);
  border-radius: 10px;
  background: #fff;
  font: inherit;
}

.search-meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: space-between;
}

.section-copy,
.hero-copy p,
.field span,
.search-meta,
.status-banner {
  color: #5f6b7a;
  line-height: 1.5;
}

.directory-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

.student-card,
.empty-directory {
  display: grid;
  gap: 12px;
  padding: 14px;
  border: 1px solid rgba(18, 38, 63, 0.08);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.92);
}

.student-card {
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
}

.empty-directory p,
.student-about {
  margin: 0;
  color: #5f6b7a;
  line-height: 1.55;
}

.student-card-head,
.student-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.student-card-head {
  display: contents;
}

.student-avatar {
  width: 46px;
  height: 46px;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 50%;
  border: 1px solid #d7dee7;
  background: #eef3f8;
}

.student-avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.student-avatar-fallback {
  color: #24456b;
  font-size: 0.9rem;
  font-weight: 700;
}

.student-copy {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.student-copy strong {
  color: #162033;
  line-height: 1.3;
}

.student-copy span {
  color: #5f6b7a;
  line-height: 1.45;
  font-size: 0.92rem;
}

.student-actions > * {
  min-height: 40px;
  padding: 0 16px;
  font-size: 0.9rem;
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
  .requests-grid,
  .search-grid,
  .directory-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .contacts-hero,
  .section-card,
  .status-banner {
    padding: 16px;
  }

  .student-card {
    grid-template-columns: 1fr;
    align-items: start;
  }

  .student-card-head {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 10px;
    align-items: center;
  }

  .student-actions {
    justify-content: start;
  }
}
</style>
