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
const filteredContacts = computed(() =>
  contacts.value.filter((c) => Boolean(c.userId)),
)
const incomingRequests = computed(() =>
  requests.value.filter((item) => item.direction === 'incoming' && item.status === 'pending'),
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

  for (const item of contacts.value) {
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
const hasActiveFilters = computed(() =>
  Boolean(filters.search || filters.universityName || filters.faculty || filters.specialization || filters.studyYear),
)

const studentCards = computed(() => {
  const hasStudents = students.value.length > 0
  const useStudents = hasStudents || hasActiveFilters.value

  return useStudents
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
    : fallbackDirectory.value
})

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
    <div class="cp-root">

      <!-- Hero -->
      <header class="cp-hero">
        <div class="cp-hero-inner">
          <div class="cp-hero-text">
            <p class="cp-eyebrow">Contacts</p>
            <h1 class="cp-title">{{ heroTitle }}</h1>
            <p class="cp-subtitle">{{ heroDescription }}</p>
          </div>
          <div class="cp-hero-stats">
            <div class="cp-stat">
              <span class="cp-stat-value">{{ studentCards.length }}</span>
              <span class="cp-stat-label">соискателей</span>
            </div>
            <div class="cp-stat">
              <span class="cp-stat-value">{{ filteredContacts.length }}</span>
              <span class="cp-stat-label">контактов</span>
            </div>
            <div class="cp-stat">
              <span class="cp-stat-value">{{ incomingRequests.length }}</span>
              <span class="cp-stat-label">запросов</span>
            </div>
          </div>
        </div>
        <div class="cp-hero-actions">
          <RouterLink :to="dashboardTarget" class="cp-btn cp-btn-ghost">В кабинет</RouterLink>
          <RouterLink to="/chats" class="cp-btn cp-btn-ghost">Чаты</RouterLink>
        </div>
      </header>

      <!-- Search -->
      <div class="cp-search-card">
        <div class="cp-search-label">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          Поиск соискателей
        </div>
        <div class="cp-search-grid">
          <input v-model="filters.search" class="cp-input cp-input-wide" type="text" placeholder="Имя, университет или специализация…" />
          <input v-model="filters.universityName" class="cp-input" type="text" placeholder="Университет" />
          <input v-model="filters.faculty" class="cp-input" type="text" placeholder="Факультет" />
          <input v-model="filters.specialization" class="cp-input" type="text" placeholder="Специализация" />
          <input v-model="filters.studyYear" class="cp-input cp-input-narrow" type="number" min="1" placeholder="Курс" />
        </div>
      </div>

      <!-- Main layout -->
      <div class="cp-layout">

        <!-- Left: directory -->
        <div class="cp-main">
          <div class="cp-section-header">
            <div>
              <p class="cp-section-eyebrow">Каталог</p>
              <h2 class="cp-section-title">Соискатели</h2>
            </div>
            <span class="cp-count-badge">{{ studentCards.length }}</span>
          </div>

          <div v-if="listLoading" class="cp-status">
            <div class="cp-spinner"></div>
            Загружаем список…
          </div>
          <div v-else-if="listError && studentCards.length" class="cp-status cp-status-warn">{{ listError }}</div>
          <div v-else-if="listError" class="cp-status cp-status-error">{{ listError }}</div>
          <div v-else-if="!studentCards.length" class="cp-empty">
            <div class="cp-empty-icon">👤</div>
            <strong>Соискатели не найдены</strong>
            <p>Попробуйте изменить поиск или фильтры.</p>
          </div>

          <div v-else class="cp-directory-grid">
            <article
              v-for="item in studentCards"
              :key="item.id"
              class="cp-student-card"
              role="button"
              tabindex="0"
              @click="savePreview(item.userId, item.displayName, item.avatarUrl, item.headline); router.push(`/profiles/students/${item.userId}`)"
              @keydown.enter="savePreview(item.userId, item.displayName, item.avatarUrl, item.headline); router.push(`/profiles/students/${item.userId}`)"
            >
              <div class="cp-student-top">
                <div class="cp-student-avatar">
                  <img v-if="item.avatarUrl" :src="item.avatarUrl" :alt="item.displayName" class="cp-avatar-img" />
                  <span v-else class="cp-avatar-fallback">{{ item.displayName.slice(0, 2).toUpperCase() }}</span>
                </div>
                <div class="cp-student-body">
                  <strong class="cp-student-name">{{ item.displayName }}</strong>
                  <span class="cp-student-headline">{{ item.headline }}</span>
                </div>
              </div>
              <div v-if="item.studyYear || item.graduationYear || item.hasResume || item.hasPortfolio" class="cp-student-tags">
                <span v-if="item.studyYear" class="cp-tag">{{ item.studyYear }}</span>
                <span v-if="item.graduationYear" class="cp-tag">{{ item.graduationYear }}</span>
                <span v-if="item.hasResume" class="cp-tag cp-tag-green">Резюме</span>
                <span v-if="item.hasPortfolio" class="cp-tag cp-tag-blue">Портфолио</span>
              </div>
            </article>
          </div>
        </div>

        <!-- Right: network -->
        <aside class="cp-sidebar">

          <!-- Contacts -->
          <div class="cp-sidebar-section">
            <div class="cp-section-header">
              <div>
                <p class="cp-section-eyebrow">Сеть</p>
                <h2 class="cp-section-title">Ваши контакты</h2>
              </div>
              <span v-if="filteredContacts.length" class="cp-count-badge">{{ filteredContacts.length }}</span>
            </div>

            <ContactsList
              :items="filteredContacts"
              :get-item-link="(item) => `/profiles/students/${item.userId}`"
              empty-title="Контактов пока нет"
              empty-text="Когда вы примете запрос или добавите соискателя в сеть, контакт появится здесь."
            />
          </div>

          <!-- Incoming requests -->
          <div class="cp-sidebar-section">
            <div class="cp-section-header">
              <div>
                <p class="cp-section-eyebrow">Входящие</p>
                <h2 class="cp-section-title">Запросы</h2>
              </div>
              <span v-if="incomingRequests.length" class="cp-count-badge cp-count-badge-accent">{{ incomingRequests.length }}</span>
            </div>

            <ContactRequestsList
              :items="incomingRequests"
              empty-title="Входящих запросов нет"
              empty-text="Новые запросы появятся здесь."
            >
              <template #actions="{ item }">
                <RouterLink
                  :to="`/profiles/students/${item.userId}`"
                  class="cp-btn cp-btn-ghost cp-btn-sm"
                  @click="savePreview(item.userId, item.displayName, item.avatarUrl, item.headline)"
                >
                  Профиль
                </RouterLink>
                <button
                  v-if="item.status === 'pending'"
                  class="cp-btn cp-btn-primary cp-btn-sm"
                  type="button"
                  :disabled="network.updatingByRequestId.value[item.id]"
                  @click="handleRequestAction(() => network.acceptRequest(item.id), 'Запрос принят.')"
                >
                  {{ network.updatingByRequestId.value[item.id] ? '…' : 'Принять' }}
                </button>
                <button
                  v-if="item.status === 'pending'"
                  class="cp-btn cp-btn-ghost cp-btn-sm"
                  type="button"
                  :disabled="network.updatingByRequestId.value[item.id]"
                  @click="handleRequestAction(() => network.rejectRequest(item.id), 'Запрос отклонён.')"
                >
                  Отклонить
                </button>
              </template>
            </ContactRequestsList>
          </div>

        </aside>
      </div>

    </div>

    <RecommendationComposer
      v-if="recommendationTarget"
      :open="Boolean(recommendationTarget)"
      :to-user-id="recommendationTarget.userId"
      :target-label="recommendationTarget.label"
      @close="recommendationTarget = null"
      @submitted="recommendationTarget = null"
    />
  </main>
</template>

<style scoped>
/* ── Root ── */
.cp-root {
  display: grid;
  gap: 20px;
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 4px;
}

/* ── Hero ── */
.cp-hero {
  position: relative;
  overflow: hidden;
  padding: 32px 32px 28px;
  border-radius: 20px;
  background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 55%, #3b82f6 100%);
  color: #fff;
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  align-items: flex-end;
  justify-content: space-between;
}

.cp-hero::before {
  content: '';
  position: absolute;
  inset: 0;
  background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.04'%3E%3Ccircle cx='30' cy='30' r='28'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E") repeat;
  pointer-events: none;
}

.cp-hero-inner {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  align-items: flex-end;
}

.cp-hero-text {
  display: grid;
  gap: 8px;
}

.cp-eyebrow {
  margin: 0;
  font: 700 0.68rem/1 var(--font-mono, monospace);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(255,255,255,0.65);
}

.cp-title {
  margin: 0;
  font-family: var(--font-heading);
  font-size: clamp(1.6rem, 3vw, 2.2rem);
  color: #fff;
  line-height: 1.15;
}

.cp-subtitle {
  margin: 0;
  font-size: 0.9rem;
  color: rgba(255,255,255,0.75);
  max-width: 440px;
  line-height: 1.6;
}

.cp-hero-stats {
  display: flex;
  gap: 24px;
}

.cp-stat {
  display: grid;
  gap: 2px;
  text-align: center;
}

.cp-stat-value {
  font-size: 1.6rem;
  font-weight: 800;
  color: #fff;
  line-height: 1;
  font-family: var(--font-heading);
}

.cp-stat-label {
  font-size: 0.72rem;
  color: rgba(255,255,255,0.6);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.cp-hero-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

/* ── Search ── */
.cp-search-card {
  padding: 18px 20px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--surface);
  box-shadow: 0 2px 12px rgba(15,23,42,0.04);
  display: grid;
  gap: 12px;
}

.cp-search-label {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.cp-search-label svg {
  flex-shrink: 0;
  color: var(--border-strong);
}

.cp-search-grid {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr 80px;
  gap: 10px;
}

/* ── Inputs ── */
.cp-input {
  min-height: 40px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface-strong);
  font: inherit;
  font-size: 0.88rem;
  color: var(--text);
  transition: border-color 0.15s, box-shadow 0.15s;
  outline: none;
}

.cp-input::placeholder {
  color: var(--border-strong);
}

.cp-input:focus {
  border-color: #3b82f6;
  background: var(--surface);
  box-shadow: 0 0 0 3px rgba(59,130,246,0.12);
}

/* ── Main layout ── */
.cp-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 20px;
  align-items: start;
}

/* ── Section headers ── */
.cp-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 14px;
}

.cp-section-eyebrow {
  margin: 0 0 2px;
  font: 700 0.65rem/1 var(--font-mono, monospace);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #3b82f6;
}

.cp-section-title {
  margin: 0;
  font-family: var(--font-heading);
  font-size: 1.05rem;
  color: var(--text);
}

.cp-count-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 7px;
  border-radius: 999px;
  background: var(--surface-muted);
  color: var(--muted);
  font-size: 0.75rem;
  font-weight: 700;
}

.cp-count-badge-accent {
  background: #eff6ff;
  color: #2563eb;
}

/* ── Status / empty states ── */
.cp-status {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface-strong);
  font-size: 0.88rem;
  color: var(--muted);
}

.cp-status-warn {
  border-color: var(--border-yellow);
  background: var(--surface-yellow);
  color: #92400e;
}

.cp-status-error {
  border-color: var(--border-red);
  background: var(--surface-red);
  color: #991b1b;
}

.cp-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid #e2e8f0;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  flex-shrink: 0;
}

@keyframes spin { to { transform: rotate(360deg); } }

.cp-empty {
  display: grid;
  gap: 6px;
  justify-items: center;
  text-align: center;
  padding: 40px 20px;
  border: 1.5px dashed #e2e8f0;
  border-radius: 16px;
  color: var(--muted);
}

.cp-empty-icon {
  font-size: 2rem;
  margin-bottom: 4px;
  filter: grayscale(0.3);
}

.cp-empty strong {
  font-size: 0.95rem;
  color: var(--text);
}

.cp-empty p {
  margin: 0;
  font-size: 0.84rem;
  color: var(--border-strong);
}

/* ── Directory grid ── */
.cp-directory-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}

/* ── Student card ── */
.cp-student-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--surface);
  transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;
  cursor: pointer;
}

.cp-student-card:hover {
  border-color: #bfdbfe;
  box-shadow: 0 4px 16px rgba(59,130,246,0.1);
  transform: translateY(-1px);
}

.cp-student-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
}

.cp-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cp-avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
  color: #fff;
  font-size: 0.78rem;
  font-weight: 700;
}

.cp-student-body {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.cp-student-top {
  display: flex;
  gap: 10px;
  align-items: center;
}

.cp-student-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text);
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cp-student-headline {
  font-size: 0.78rem;
  color: var(--muted);
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cp-student-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}

.cp-tag {
  display: inline-flex;
  align-items: center;
  height: 18px;
  padding: 0 7px;
  border-radius: 5px;
  background: var(--surface-muted);
  color: var(--muted);
  font-size: 0.68rem;
  font-weight: 600;
  white-space: nowrap;
}

.cp-tag-green {
  background: var(--chip-green);
  color: var(--success);
}

.cp-tag-blue {
  background: var(--chip-blue);
  color: var(--chip-blue-text);
}

/* ── Sidebar ── */
.cp-sidebar {
  display: grid;
  gap: 16px;
}

.cp-sidebar-section {
  padding: 18px 20px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--surface);
  box-shadow: 0 2px 10px rgba(15,23,42,0.04);
}

/* ── Buttons ── */
.cp-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 36px;
  padding: 0 16px;
  border-radius: 10px;
  border: 1px solid transparent;
  font: inherit;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  text-decoration: none;
  transition: background 0.15s, border-color 0.15s, transform 0.1s;
  white-space: nowrap;
}

.cp-btn:active { transform: scale(0.97); }
.cp-btn:disabled { opacity: 0.55; pointer-events: none; }

.cp-btn-primary {
  background: #2563eb;
  border-color: #2563eb;
  color: #fff;
}
.cp-btn-primary:hover { background: #1d4ed8; border-color: var(--chip-blue-text); }

.cp-btn-ghost {
  background: transparent;
  border-color: var(--border);
  color: var(--muted);
}
.cp-btn-ghost:hover { background: var(--surface-strong); border-color: var(--border-strong); }

.cp-btn-purple {
  background: #7c3aed;
  border-color: #7c3aed;
  color: #fff;
}
.cp-btn-purple:hover { background: #6d28d9; border-color: var(--chip-purple-text); }

.cp-card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-self: flex-start;
}

/* For hero white ghost buttons */
.cp-hero .cp-btn-ghost {
  border-color: rgba(255,255,255,0.35);
  color: #fff;
  background: rgba(255,255,255,0.1);
}
.cp-hero .cp-btn-ghost:hover { background: rgba(255,255,255,0.2); }

.cp-btn-sm {
  min-height: 30px;
  padding: 0 12px;
  font-size: 0.8rem;
  border-radius: 8px;
}

/* ── Responsive ── */
@media (max-width: 1100px) {
  .cp-layout {
    grid-template-columns: 1fr;
  }
  .cp-sidebar {
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    grid-auto-flow: dense;
  }
}

@media (max-width: 860px) {
  .cp-search-grid {
    grid-template-columns: 1fr 1fr;
  }
  .cp-input-wide { grid-column: 1 / -1; }
  .cp-input-narrow { grid-column: auto; }
}

@media (max-width: 640px) {
  .cp-hero { padding: 24px 20px 20px; }
  .cp-hero-stats { gap: 16px; }
  .cp-stat-value { font-size: 1.3rem; }
  .cp-search-grid { grid-template-columns: 1fr; }
  .cp-sidebar { grid-template-columns: 1fr; }
  .cp-directory-grid { grid-template-columns: 1fr; }
  .cp-student-card { grid-template-columns: 40px minmax(0,1fr) auto; }
}

:global(.dark) .cp-status-warn  { border-color: #78350f; background: #1c1205; color: #fbbf24; }
:global(.dark) .cp-status-error { border-color: #7f1d1d; background: #1f0808; color: #fca5a5; }
:global(.dark) .cp-tag-green { background: #091a0d; color: #4ade80; }
:global(.dark) .cp-tag-blue  { background: #0f1e38; color: #60a5fa; }
:global(.dark) .cp-btn-purple { background: #4c1d95; border-color: #4c1d95; }
:global(.dark) .cp-btn-purple:hover { background: #5b21b6; border-color: #5b21b6; }
</style>
