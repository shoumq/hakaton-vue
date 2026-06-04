<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import LucideArrowRight from '~icons/lucide/arrow-right'
import type { Opportunity } from '@/entities/opportunity/model/types'
import { useSession } from '@/features/session/model/session'
import OpportunityCard from '@/entities/opportunity/ui/OpportunityCard.vue'
import {
  fetchContacts,
  fetchContactRequests,
  fetchCurrentUser,
  fetchFavoriteOpportunities,
  fetchMyApplications,
  fetchNotifications,
  fetchPortfolioProjects,
  createPortfolioProject,
  fetchPublicCatalog,
  fetchResumes,
  fetchStudentProfile,
  getApiErrorMessage,
} from '@/shared/api'
import type {
  ApplicationDto,
  ContactDto,
  NotificationDto,
  PortfolioProjectDto,
  PortfolioProjectCreateInput,
  ResumeDto,
  StudentProfileDto,
} from '@/shared/api'
import { formatDate } from '@/shared/lib/formatters'

const session = useSession()
const currentUserName = ref('')
const studentProfile = ref<StudentProfileDto | null>(null)
const applications = ref<ApplicationDto[]>([])
const favoriteOpportunities = ref<Opportunity[]>([])
const portfolioProjects = ref<PortfolioProjectDto[]>([])
const resumes = ref<ResumeDto[]>([])
const contacts = ref<ContactDto[]>([])
const contactRequests = ref<ContactDto[]>([])
const notifications = ref<NotificationDto[]>([])
const publicOpportunities = ref<Opportunity[]>([])
const isLoading = ref(true)
const errorMessage = ref('')

const applicationCards = computed(() => {
  const opportunitiesById = Object.fromEntries(publicOpportunities.value.map((item) => [item.id, item]))

  return applications.value.map((item) => ({
    id: item.id ?? item.opportunity_id ?? Math.random().toString(),
    status: item.status ?? 'unknown',
    updatedAt: item.updated_at ?? item.created_at ?? '',
    opportunity: item.opportunity_id ? opportunitiesById[item.opportunity_id] : undefined,
    opportunityId: item.opportunity_id ?? '',
  }))
})

const fullName = computed(() => {
  const profile = studentProfile.value

  if (!profile) {
    return currentUserName.value || session.currentUser.value?.displayName || 'Соискатель'
  }

  const firstName = profile.first_name?.trim() ?? ''
  const lastName = profile.last_name?.trim() ?? ''
  const displayName = profile.display_name?.trim() ?? ''

  return [firstName, lastName].filter(Boolean).join(' ') || displayName || currentUserName.value || 'Соискатель'
})

const profileSummary = computed(() => {
  const profile = studentProfile.value
  const parts = [
    profile?.university_name?.trim() ?? '',
    profile?.faculty?.trim() ?? '',
    profile?.specialization?.trim() ?? '',
  ].filter(Boolean)

  return parts.join(' • ') || 'Профиль еще не заполнен. Добавьте образование, специализацию и ссылки на работы.'
})

const privacyLabel = computed(() => {
  const visibility = studentProfile.value?.profile_visibility ?? 'authorized_only'

  if (visibility === 'public_inside_platform' || visibility === 'public') {
    return 'Публичный внутри платформы'
  }

  if (visibility === 'private') {
    return 'Приватный'
  }

  if (visibility === 'contacts_only') {
    return 'Только контактам'
  }

  return 'Только авторизованные'
})

const aboutText = computed(
  () =>
    studentProfile.value?.about ||
    'Краткое описание пока отсутствует. Этот блок стоит использовать для позиционирования и карьерных интересов.',
)

const avatarFallback = computed(() => {
  const value = fullName.value || session.currentUser.value?.email || 'U'

  return value
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
})

const profileFacts = computed(() => [
  { label: 'Приватность', value: privacyLabel.value },
  { label: 'Резюме', value: resumes.value.length ? String(resumes.value.length) : 'Не добавлено' },
  { label: 'Портфолио', value: portfolioProjects.value.length ? String(portfolioProjects.value.length) : 'Пусто' },
  { label: 'Уведомления', value: String(notifications.value.length) },
])

const profileHighlights = computed(() => [
  { label: 'Университет', value: studentProfile.value?.university_name || 'Не указано' },
  { label: 'Факультет', value: studentProfile.value?.faculty || 'Не указано' },
  { label: 'Специализация', value: studentProfile.value?.specialization || 'Не указано' },
  { label: 'Telegram', value: studentProfile.value?.telegram || 'Не указан' },
  { label: 'GitHub', value: studentProfile.value?.github_url || 'Не указан' },
  { label: 'Сайт', value: studentProfile.value?.website_url || 'Не указан' },
])

const activityMetrics = computed(() => [
  { label: 'Отклики', value: applications.value.length, icon: '📋', color: 'blue' },
  { label: 'Избранное', value: favoriteOpportunities.value.length, icon: '⭐', color: 'yellow' },
  { label: 'Контакты', value: contacts.value.length, icon: '👥', color: 'green' },
  { label: 'Запросы', value: contactRequests.value.length, icon: '📨', color: 'purple' },
])

// ── Portfolio ──────────────────────────────────────────────────────────────
const portfolioFormOpen = ref(false)
const isSavingProject = ref(false)
const portfolioSaveError = ref('')
const portfolioForm = ref<PortfolioProjectCreateInput>({
  title: '',
  description: '',
  project_url: '',
  repository_url: '',
  demo_url: '',
  started_at: '',
  finished_at: '',
})

function openPortfolioForm() {
  portfolioForm.value = { title: '', description: '', project_url: '', repository_url: '', demo_url: '', started_at: '', finished_at: '' }
  portfolioSaveError.value = ''
  portfolioFormOpen.value = true
}

function formatMonthYear(dateStr?: string) {
  if (!dateStr) return ''
  const [year, month] = dateStr.split('-').map(Number)
  return new Date(year, (month || 1) - 1, 1).toLocaleDateString('ru-RU', { year: 'numeric', month: 'long' })
}

async function handleCreateProject() {
  if (!portfolioForm.value.title.trim()) return
  isSavingProject.value = true
  portfolioSaveError.value = ''
  try {
    const created = await createPortfolioProject({
      ...portfolioForm.value,
      title: portfolioForm.value.title.trim(),
      description: portfolioForm.value.description?.trim() || undefined,
      project_url: portfolioForm.value.project_url?.trim() || undefined,
      repository_url: portfolioForm.value.repository_url?.trim() || undefined,
      demo_url: portfolioForm.value.demo_url?.trim() || undefined,
      started_at: portfolioForm.value.started_at || undefined,
      finished_at: portfolioForm.value.finished_at || undefined,
    })
    portfolioProjects.value = [created, ...portfolioProjects.value]
    portfolioFormOpen.value = false
  } catch (error) {
    portfolioSaveError.value = getApiErrorMessage(error, 'Не удалось создать проект.')
  } finally {
    isSavingProject.value = false
  }
}

function statusMeta(status: string): { label: string; color: string } {
  const map: Record<string, { label: string; color: string }> = {
    pending:   { label: 'На рассмотрении', color: 'blue' },
    submitted: { label: 'Отправлен', color: 'blue' },
    reviewing: { label: 'Проверяется', color: 'purple' },
    accepted:  { label: 'Принят', color: 'green' },
    approved:  { label: 'Одобрен', color: 'green' },
    rejected:  { label: 'Отклонён', color: 'red' },
    cancelled: { label: 'Отменён', color: 'grey' },
    unknown:   { label: 'Статус неизвестен', color: 'grey' },
  }
  return map[status] ?? { label: status, color: 'grey' }
}

onMounted(async () => {
  isLoading.value = true
  errorMessage.value = ''

  try {
    const [
      me,
      profile,
      applicationList,
      favorites,
      resumeList,
      portfolioList,
      contactList,
      contactRequestList,
      notificationList,
      catalog,
    ] = await Promise.all([
      fetchCurrentUser(),
      fetchStudentProfile(),
      fetchMyApplications(),
      fetchFavoriteOpportunities(),
      fetchResumes(),
      fetchPortfolioProjects(),
      fetchContacts(),
      fetchContactRequests(),
      fetchNotifications(),
      fetchPublicCatalog(),
    ])

    currentUserName.value = me.user.display_name ?? ''
    studentProfile.value = profile
    applications.value = applicationList
    favoriteOpportunities.value = favorites
    resumes.value = resumeList
    portfolioProjects.value = portfolioList
    contacts.value = contactList
    contactRequests.value = contactRequestList
    notifications.value = notificationList ?? []
    publicOpportunities.value = catalog.opportunities
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, 'Не удалось загрузить кабинет соискателя.')
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <main class="page-shell">
    <div class="ad-root">

      <!-- Hero -->
      <div class="ad-hero">
        <div class="ad-cover"></div>
        <div class="ad-hero-body">
          <div class="ad-avatar">
            <img
              v-if="session.currentUser.value?.avatarUrl"
              :src="session.currentUser.value.avatarUrl"
              alt="Фото профиля"
              class="ad-avatar-img"
            />
            <span v-else class="ad-avatar-fallback">{{ avatarFallback }}</span>
          </div>
          <div class="ad-identity">
            <p class="ad-eyebrow">Кабинет соискателя</p>
            <h1 class="ad-name">{{ fullName }}</h1>
            <p class="ad-headline">{{ profileSummary }}</p>
            <p class="ad-about">{{ aboutText }}</p>
            <div class="ad-actions">
              <RouterLink to="/profile" class="ad-btn ad-btn-primary">Редактировать профиль</RouterLink>
              <RouterLink to="/" class="ad-btn ad-btn-ghost">Поиск вакансий</RouterLink>
            </div>
          </div>
        </div>
      </div>

      <!-- Status -->
      <div v-if="errorMessage" class="ad-status ad-status-error">{{ errorMessage }}</div>
      <div v-else-if="isLoading" class="ad-status">
        <div class="ad-spinner"></div>Загружаем данные кабинета…
      </div>

      <!-- Metrics strip -->
      <div class="ad-metrics">
        <div v-for="m in activityMetrics" :key="m.label" class="ad-metric" :class="`ad-metric--${m.color}`">
          <span class="ad-metric-icon">{{ m.icon }}</span>
          <strong class="ad-metric-value">{{ m.value }}</strong>
          <span class="ad-metric-label">{{ m.label }}</span>
        </div>
      </div>

      <!-- Body layout -->
      <div class="ad-layout">

        <!-- Main column -->
        <div class="ad-main">

          <!-- Profile details -->
          <section class="ad-card">
            <div class="ad-card-header">
              <div>
                <p class="ad-section-eyebrow">Профиль</p>
                <h2>Профиль и настройки</h2>
              </div>
              <RouterLink to="/profile" class="ad-btn ad-btn-ghost ad-btn-sm">Редактировать</RouterLink>
            </div>
            <div class="ad-highlights-grid">
              <div v-for="item in profileHighlights" :key="item.label" class="ad-highlight-item">
                <span class="ad-hl-label">{{ item.label }}</span>
                <strong class="ad-hl-value">{{ item.value }}</strong>
              </div>
            </div>
          </section>

          <!-- Resumes -->
          <section class="ad-card">
            <div class="ad-card-header">
              <div>
                <p class="ad-section-eyebrow">Резюме</p>
                <h2>Мои резюме</h2>
              </div>
              <div style="display:flex;gap:8px;align-items:center;">
                <span v-if="resumes.length" class="ad-count-badge">{{ resumes.length }}</span>
                <RouterLink to="/profile" class="ad-btn ad-btn-ghost ad-btn-sm">Управлять</RouterLink>
              </div>
            </div>

            <div v-if="!resumes.length" class="ad-empty">
              <span class="ad-empty-icon">📄</span>
              <strong>Резюме не добавлено</strong>
              <p>Создайте резюме, чтобы откликаться на вакансии.</p>
              <RouterLink to="/profile" class="ad-btn ad-btn-primary" style="margin-top:4px;">Создать резюме</RouterLink>
            </div>

            <div v-else class="ad-resume-list">
              <RouterLink
                v-for="r in resumes"
                :key="r.id"
                :to="`/profiles/students/${session.currentUser.value?.id}/resumes/${r.id}`"
                class="ad-resume-row"
              >
                <div class="ad-resume-icon">📄</div>
                <div class="ad-resume-info">
                  <div class="ad-resume-title-row">
                    <strong>{{ r.title || 'Без названия' }}</strong>
                    <span v-if="r.is_primary" class="ad-resume-badge">⭐ Основное</span>
                  </div>
                  <span v-if="r.summary" class="ad-resume-summary">{{ r.summary }}</span>
                  <span class="ad-resume-date">{{ r.created_at ? formatDate(r.created_at) : '' }}</span>
                </div>
                <LucideArrowRight class="ad-resume-arrow" />
              </RouterLink>
            </div>
          </section>

          <!-- Applications -->
          <section class="ad-card">
            <div class="ad-card-header">
              <div>
                <p class="ad-section-eyebrow">Активность</p>
                <h2>История откликов</h2>
              </div>
              <span v-if="applicationCards.length" class="ad-count-badge">{{ applicationCards.length }}</span>
            </div>

            <div v-if="!applicationCards.length" class="ad-empty">
              <span class="ad-empty-icon">📋</span>
              <strong>Откликов пока нет</strong>
              <p>После отправки отклика история появится здесь.</p>
            </div>

            <div v-else class="ad-app-list">
              <div v-for="item in applicationCards" :key="item.id" class="ad-app-row">
                <div class="ad-app-info">
                  <strong>{{ item.opportunity?.title || item.opportunityId }}</strong>
                  <span>{{ item.opportunity?.companyName || 'Компания не указана' }}</span>
                </div>
                <span class="ad-status-pill" :class="`ad-status-pill--${statusMeta(item.status).color}`">
                  {{ statusMeta(item.status).label }}
                </span>
                <span class="ad-app-date">{{ item.updatedAt ? formatDate(item.updatedAt) : '—' }}</span>
              </div>
            </div>
          </section>

          <!-- Saved opportunities -->
          <section class="ad-card">
            <div class="ad-card-header">
              <div>
                <p class="ad-section-eyebrow">Избранное</p>
                <h2>Сохранённые вакансии</h2>
              </div>
              <span v-if="favoriteOpportunities.length" class="ad-count-badge">{{ favoriteOpportunities.length }}</span>
            </div>
            <div v-if="!favoriteOpportunities.length" class="ad-empty">
              <span class="ad-empty-icon">⭐</span>
              <strong>Список избранного пуст</strong>
              <p>Сохраняйте интересные вакансии, чтобы вернуться к ним позже.</p>
            </div>
            <div v-else class="ad-saved-list">
              <OpportunityCard
                v-for="opportunity in favoriteOpportunities"
                :key="opportunity.id"
                :opportunity="opportunity"
                compact
              />
            </div>
          </section>
        </div>

        <!-- Sidebar -->
        <aside class="ad-sidebar">

          <!-- Profile facts -->
          <div class="ad-card">
            <div class="ad-card-header">
              <div>
                <p class="ad-section-eyebrow">Сводка</p>
                <h3>Профиль сейчас</h3>
              </div>
            </div>
            <div class="ad-facts-grid">
              <div v-for="fact in profileFacts" :key="fact.label" class="ad-fact">
                <span class="ad-fact-label">{{ fact.label }}</span>
                <strong class="ad-fact-value">{{ fact.value }}</strong>
              </div>
            </div>
          </div>

          <!-- Portfolio -->
          <div class="ad-card">
            <div class="ad-card-header">
              <div>
                <p class="ad-section-eyebrow">Работы</p>
                <h3>Портфолио</h3>
              </div>
              <button class="ad-btn ad-btn-ghost ad-btn-sm" type="button" @click="openPortfolioForm">
                + Добавить
              </button>
            </div>

            <!-- Empty -->
            <div v-if="!portfolioProjects.length" class="ad-empty ad-empty-sm">
              <strong>Проектов пока нет</strong>
              <p>Добавьте первый проект в портфолио.</p>
            </div>

            <!-- Project list -->
            <div v-if="portfolioProjects.length" class="ad-pf-list">
              <div v-for="project in portfolioProjects" :key="project.id" class="ad-pf-card">
                <div class="ad-pf-top">
                  <strong class="ad-pf-title">{{ project.title || 'Без названия' }}</strong>
                  <span v-if="!project.finished_at" class="ad-pf-badge-now">Текущий</span>
                </div>
                <span v-if="project.started_at" class="ad-pf-dates">
                  {{ formatMonthYear(project.started_at) }} —
                  {{ project.finished_at ? formatMonthYear(project.finished_at) : 'по н.в.' }}
                </span>
                <p v-if="project.description" class="ad-pf-desc">{{ project.description }}</p>
                <div v-if="project.project_url || project.repository_url" class="ad-pf-links">
                  <a v-if="project.project_url" :href="project.project_url" target="_blank" rel="noopener noreferrer" class="ad-pf-link">🔗 Проект</a>
                  <a v-if="project.repository_url" :href="project.repository_url" target="_blank" rel="noopener noreferrer" class="ad-pf-link">📦 Репо</a>
                </div>
              </div>
            </div>
          </div>

          <!-- Contacts -->
          <div class="ad-card">
            <div class="ad-card-header">
              <div>
                <p class="ad-section-eyebrow">Нетворкинг</p>
                <h3>Сеть контактов</h3>
              </div>
              <RouterLink to="/contacts" class="ad-btn ad-btn-ghost ad-btn-sm">Все</RouterLink>
            </div>
            <div v-if="!contacts.length" class="ad-empty ad-empty-sm">
              <strong>Пока пусто</strong>
              <p>Контакты появятся после нетворкинга.</p>
            </div>
            <div v-else class="ad-contacts-list">
              <RouterLink
                v-for="contact in contacts.slice(0, 5)"
                :key="contact.id"
                :to="`/profiles/students/${contact.id}`"
                class="ad-contact-row"
              >
                <div class="ad-contact-avatar">
                  <img v-if="contact.avatar_url" :src="contact.avatar_url" :alt="contact.display_name || ''" class="ad-contact-avatar-img" />
                  <span v-else>{{ (contact.display_name || '?')[0].toUpperCase() }}</span>
                </div>
                <strong class="ad-contact-name">{{ contact.display_name || 'Контакт' }}</strong>
              </RouterLink>
            </div>
          </div>

        </aside>
      </div>
    </div>

    <!-- Portfolio modal -->
    <div v-if="portfolioFormOpen" class="ad-pf-overlay" @click.self="portfolioFormOpen = false">
      <div class="ad-pf-modal">
        <div class="ad-pf-modal-head">
          <div>
            <p class="ad-section-eyebrow">Портфолио</p>
            <h2>Новый проект</h2>
          </div>
          <button type="button" class="ad-pf-close" @click="portfolioFormOpen = false">✕</button>
        </div>

        <form class="ad-pf-modal-body" @submit.prevent="handleCreateProject">
          <label class="ad-pf-field">
            <span>Название *</span>
            <input v-model="portfolioForm.title" type="text" placeholder="Мой pet-project" autofocus />
          </label>
          <label class="ad-pf-field">
            <span>Описание</span>
            <textarea v-model="portfolioForm.description" rows="3" placeholder="Что сделано, какой стек" />
          </label>
          <div class="ad-pf-row">
            <label class="ad-pf-field">
              <span>Ссылка на проект</span>
              <input v-model="portfolioForm.project_url" type="url" placeholder="https://..." />
            </label>
            <label class="ad-pf-field">
              <span>Репозиторий</span>
              <input v-model="portfolioForm.repository_url" type="url" placeholder="https://github.com/..." />
            </label>
          </div>
          <div class="ad-pf-row">
            <label class="ad-pf-field">
              <span>Начало</span>
              <input v-model="portfolioForm.started_at" type="date" />
            </label>
            <label class="ad-pf-field">
              <span>Окончание</span>
              <input v-model="portfolioForm.finished_at" type="date" />
            </label>
          </div>
          <p v-if="portfolioSaveError" class="ad-pf-error">{{ portfolioSaveError }}</p>
          <div class="ad-pf-modal-foot">
            <button class="primary-button" type="submit" :disabled="isSavingProject || !portfolioForm.title.trim()">
              {{ isSavingProject ? 'Сохраняем…' : 'Добавить проект' }}
            </button>
            <button class="ghost-button" type="button" @click="portfolioFormOpen = false">Отмена</button>
          </div>
        </form>
      </div>
    </div>
  </main>
</template>

<style scoped>
/* ── Root ── */
.ad-root {
  display: grid;
  gap: 20px;
  max-width: 1240px;
  margin: 0 auto;
}

/* ── Hero ── */
.ad-hero {
  border-radius: 20px;
  border: 1px solid var(--border);
  background: var(--surface);
  box-shadow: 0 4px 24px rgba(15,23,42,0.06);
}

.ad-cover {
  height: 140px;
  border-radius: 19px 19px 0 0;
  background: linear-gradient(135deg, #0f2c7a 0%, #1d4ed8 45%, #3b82f6 75%, #60a5fa 100%);
}

.ad-hero-body {
  display: flex;
  gap: 22px;
  align-items: flex-start;
  padding: 0 32px 28px;
}

.ad-avatar {
  width: 96px;
  height: 96px;
  border-radius: 16px;
  border: 4px solid #fff;
  overflow: hidden;
  flex-shrink: 0;
  box-shadow: 0 4px 18px rgba(15,23,42,0.14);
  background: var(--surface);
  margin-top: -40px;
}

.ad-avatar-img { width: 100%; height: 100%; object-fit: cover; }

.ad-avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
  color: #fff;
  font-size: 1.6rem;
  font-weight: 800;
  font-family: var(--font-heading);
}

.ad-identity {
  display: grid;
  gap: 6px;
  flex: 1;
  min-width: 0;
  padding-top: 14px;
}

.ad-eyebrow {
  margin: 0;
  font: 700 0.68rem/1 var(--font-mono, monospace);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #3b82f6;
}

.ad-name {
  margin: 0;
  font-family: var(--font-heading);
  font-size: clamp(1.6rem, 3vw, 2.2rem);
  color: var(--text);
  line-height: 1.1;
}

.ad-headline {
  margin: 0;
  font-size: 0.9rem;
  color: var(--muted);
  font-weight: 500;
}

.ad-about {
  margin: 0;
  font-size: 0.86rem;
  color: var(--muted);
  line-height: 1.6;
  max-width: 540px;
}

.ad-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
}

/* ── Status ── */
.ad-status {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 18px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--surface);
  font-size: 0.9rem;
  color: var(--muted);
}

.ad-status-error {
  border-color: var(--border-red);
  background: var(--surface-red);
  color: #991b1b;
}

.ad-spinner {
  width: 16px; height: 16px;
  border: 2px solid #e2e8f0;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  flex-shrink: 0;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Metrics ── */
.ad-metrics {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.ad-metric {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 20px 16px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--surface);
  text-align: center;
  box-shadow: 0 2px 8px rgba(15,23,42,0.04);
  transition: transform 0.15s, box-shadow 0.15s;
}

.ad-metric:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(15,23,42,0.08); }

.ad-metric-icon { font-size: 1.4rem; line-height: 1; }
.ad-metric-value { font-size: 1.8rem; font-weight: 800; line-height: 1; font-family: var(--font-heading); }
.ad-metric-label { font-size: 0.75rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }

.ad-metric--blue  .ad-metric-value { color: #2563eb; }
.ad-metric--yellow .ad-metric-value { color: #d97706; }
.ad-metric--green  .ad-metric-value { color: #16a34a; }
.ad-metric--purple .ad-metric-value { color: #7c3aed; }

.ad-metric--blue  { border-color: var(--border-blue); background: var(--surface-blue); }
.ad-metric--yellow { border-color: var(--border-yellow); background: var(--surface-yellow); }
.ad-metric--green  { border-color: var(--border-green); background: var(--surface-green); }
.ad-metric--purple { border-color: var(--border-ai); background: var(--surface-ai); }

/* ── Layout ── */
.ad-layout {
  display: grid;
  grid-template-columns: minmax(0,1fr) 300px;
  gap: 20px;
  align-items: start;
}

.ad-main { display: grid; gap: 16px; }
.ad-sidebar { display: grid; gap: 12px; }

/* ── Cards ── */
.ad-card {
  padding: 20px 22px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--surface);
  box-shadow: 0 2px 10px rgba(15,23,42,0.04);
}

.ad-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 16px;
}

.ad-card-header > div { display: grid; gap: 2px; }

.ad-card-header h2,
.ad-card-header h3 {
  margin: 0;
  font-family: var(--font-heading);
  font-size: 1rem;
  color: var(--text);
}

.ad-section-eyebrow {
  margin: 0;
  font: 700 0.65rem/1 var(--font-mono, monospace);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #3b82f6;
}

.ad-count-badge {
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
  flex-shrink: 0;
}

/* ── Highlights grid ── */
.ad-highlights-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.ad-highlight-item {
  display: grid;
  gap: 3px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--surface-strong);
  border: 1px solid #f1f5f9;
}

.ad-hl-label {
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--border-strong);
}

.ad-hl-value {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text);
  line-height: 1.3;
}

/* ── Applications ── */
.ad-app-list { display: grid; }

.ad-app-row {
  display: grid;
  grid-template-columns: minmax(0,1fr) auto 130px;
  gap: 12px;
  align-items: center;
  padding: 12px 0;
  border-top: 1px solid #f1f5f9;
}

.ad-app-row:first-child { border-top: none; padding-top: 0; }

.ad-app-info { display: grid; gap: 2px; min-width: 0; }

.ad-app-info strong {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ad-app-info span {
  font-size: 0.78rem;
  color: var(--muted);
}

.ad-app-date {
  font-size: 0.76rem;
  color: var(--border-strong);
  text-align: right;
}

.ad-status-pill {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
  white-space: nowrap;
}

.ad-status-pill--blue   { background: var(--chip-blue); color: var(--chip-blue-text); }
.ad-status-pill--green  { background: var(--chip-green); color: var(--success); }
.ad-status-pill--red    { background: var(--surface-red); color: #991b1b; }
.ad-status-pill--purple { background: var(--chip-purple); color: var(--chip-purple-text); }
.ad-status-pill--grey   { background: var(--surface-muted); color: var(--muted); }

/* ── Resumes ── */
.ad-resume-list { display: grid; gap: 8px; }

.ad-resume-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 14px;
  border: 1px solid #f1f5f9;
  border-radius: 12px;
  background: var(--surface-strong);
  text-decoration: none;
  transition: border-color 0.15s, background 0.15s, transform 0.1s;
}
.ad-resume-row:hover { border-color: #bfdbfe; background: var(--surface); transform: translateX(2px); }
.ad-resume-row { gap: 12px; }

.ad-resume-icon {
  font-size: 1.2rem;
  line-height: 1;
  flex-shrink: 0;
  margin-top: 2px;
}

.ad-resume-info {
  display: grid;
  gap: 3px;
  min-width: 0;
  flex: 1;
}

.ad-resume-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.ad-resume-title-row strong {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text);
}

.ad-resume-badge {
  height: 18px;
  padding: 0 8px;
  border-radius: 5px;
  background: #fef3c7;
  color: #92400e;
  font-size: 0.66rem;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
}

.ad-resume-summary {
  font-size: 0.79rem;
  color: var(--muted);
  line-height: 1.45;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ad-resume-date {
  font-size: 0.72rem;
  color: var(--border-strong);
}

.ad-resume-arrow {
  width: 15px;
  height: 15px;
  color: var(--border-strong);
  flex-shrink: 0;
  margin-left: auto;
}

/* ── Saved ── */
.ad-saved-list { display: grid; gap: 10px; }

/* ── Empty states ── */
.ad-empty {
  display: grid;
  gap: 6px;
  justify-items: center;
  text-align: center;
  padding: 32px 20px;
  border: 1.5px dashed #e2e8f0;
  border-radius: 12px;
}

.ad-empty-sm { padding: 16px; }

.ad-empty-icon { font-size: 1.8rem; line-height: 1; }

.ad-empty strong { font-size: 0.9rem; color: var(--text); }

.ad-empty p { margin: 0; font-size: 0.82rem; color: var(--border-strong); }

/* ── Sidebar: facts ── */
.ad-facts-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.ad-fact {
  display: grid;
  gap: 3px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--surface-strong);
  border: 1px solid #f1f5f9;
}

.ad-fact-label {
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--border-strong);
}

.ad-fact-value {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text);
  line-height: 1.3;
}

/* ── Sidebar: materials ── */
.ad-materials-list { display: grid; gap: 8px; }

.ad-material-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--surface-strong);
  border: 1px solid #f1f5f9;
}

.ad-material-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  flex-shrink: 0;
}

.ad-material-icon--blue   { background: var(--chip-blue); }
.ad-material-icon--purple { background: var(--chip-purple); }
.ad-material-icon--orange { background: var(--chip-orange); }

.ad-material-row > div:not(.ad-material-icon) {
  display: grid;
  gap: 1px;
  flex: 1;
  min-width: 0;
}

.ad-material-row strong { font-size: 0.82rem; font-weight: 600; color: var(--text); }
.ad-material-row span   { font-size: 0.76rem; color: var(--muted); }

/* ── Sidebar: contacts ── */
.ad-contacts-list { display: grid; gap: 6px; }

.ad-contact-row {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 8px 10px;
  border-radius: 10px;
  background: var(--surface-strong);
  border: 1px solid #f1f5f9;
  text-decoration: none;
  transition: background 0.15s, border-color 0.15s;
}
.ad-contact-row:hover {
  background: #eff6ff;
  border-color: #bfdbfe;
}

.ad-contact-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.72rem;
  font-weight: 700;
  flex-shrink: 0;
  overflow: hidden;
}
.ad-contact-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.ad-contact-name {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}

/* ── Buttons ── */
.ad-btn {
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

.ad-btn:active { transform: scale(0.97); }

.ad-btn-primary {
  background: #2563eb;
  border-color: #2563eb;
  color: #fff;
}
.ad-btn-primary:hover { background: #1d4ed8; border-color: var(--chip-blue-text); }

.ad-btn-ghost {
  background: transparent;
  border-color: var(--border);
  color: var(--muted);
}
.ad-btn-ghost:hover { background: var(--surface-strong); border-color: var(--border-strong); }

.ad-btn-sm { min-height: 28px; padding: 0 10px; font-size: 0.78rem; border-radius: 7px; }


/* ── Responsive ── */
@media (max-width: 1100px) {
  .ad-layout { grid-template-columns: 1fr; }
  .ad-sidebar { grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
  .ad-metrics { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 720px) {
  .ad-hero-body { flex-direction: column; padding: 0 20px 22px; gap: 14px; }
  .ad-avatar { width: 80px; height: 80px; margin-top: -36px; border-radius: 14px; }
  .ad-identity { padding-top: 0; }
  .ad-highlights-grid { grid-template-columns: repeat(2, 1fr); }
  .ad-app-row { grid-template-columns: 1fr auto; }
  .ad-app-date { display: none; }
  .ad-sidebar { grid-template-columns: 1fr; }
  .ad-metrics { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 480px) {
  .ad-highlights-grid { grid-template-columns: 1fr; }
  .ad-facts-grid { grid-template-columns: 1fr; }
}

/* ── Dark theme overrides (global so they beat scoped specificity) ── */
:global(.dark) .ad-avatar { border-color: var(--surface); }
:global(.dark) .ad-metric--blue   { background: #0a1829; border-color: #1e3a5f; }
:global(.dark) .ad-metric--yellow { background: #1c1506; border-color: #78350f; }
:global(.dark) .ad-metric--green  { background: #091a0d; border-color: #14532d; }
:global(.dark) .ad-metric--purple { background: #130e22; border-color: #4c1d95; }
:global(.dark) .ad-metric--blue   .ad-metric-value { color: #60a5fa; }
:global(.dark) .ad-metric--yellow .ad-metric-value { color: #fbbf24; }
:global(.dark) .ad-metric--green  .ad-metric-value { color: #4ade80; }
:global(.dark) .ad-metric--purple .ad-metric-value { color: #a78bfa; }
:global(.dark) .ad-highlight-item { background: var(--surface-strong); border-color: var(--border); }
:global(.dark) .ad-app-row        { border-color: var(--border); }
:global(.dark) .ad-resume-row     { background: var(--surface-strong); border-color: var(--border); }
:global(.dark) .ad-contact-row    { background: var(--surface-strong); border-color: var(--border); }
:global(.dark) .ad-contact-row:hover { background: #0f1e38; border-color: var(--accent-soft); }
:global(.dark) .ad-status-pill--blue   { background: #0f1e38; color: #60a5fa; }
:global(.dark) .ad-status-pill--green  { background: #091a0d; color: #4ade80; }
:global(.dark) .ad-status-pill--red    { background: #1f0808; color: #fca5a5; }
:global(.dark) .ad-status-pill--purple { background: #130e22; color: #a78bfa; }
:global(.dark) .ad-material-icon--blue   { background: #0f1e38; }
:global(.dark) .ad-material-icon--purple { background: #130e22; }
:global(.dark) .ad-material-icon--orange { background: #1c1000; }
:global(.dark) .ad-count-badge { background: var(--surface-strong); color: var(--muted); }

/* ── Portfolio ── */
.ad-pf-list { display: grid; gap: 8px; }

.ad-pf-card {
  display: grid;
  gap: 4px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface-strong);
  transition: border-color 0.15s;
}
.ad-pf-card:hover { border-color: var(--accent-soft); }

.ad-pf-top { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.ad-pf-title { font-size: 0.86rem; font-weight: 600; color: var(--text); }

.ad-pf-badge-now {
  display: inline-flex; align-items: center;
  height: 16px; padding: 0 7px; border-radius: 4px;
  background: var(--chip-green); color: var(--chip-green-text);
  font-size: 0.65rem; font-weight: 700;
}

.ad-pf-dates { font-size: 0.74rem; color: var(--muted); }

.ad-pf-desc {
  margin: 0; font-size: 0.78rem; color: var(--muted); line-height: 1.45;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}

.ad-pf-links { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 2px; }

.ad-pf-link {
  display: inline-flex; align-items: center;
  height: 20px; padding: 0 8px; border-radius: 5px;
  background: var(--surface-blue); color: var(--accent);
  border: 1px solid var(--border-blue);
  font-size: 0.7rem; font-weight: 600;
  text-decoration: none; transition: background 0.15s;
}
.ad-pf-link:hover { background: var(--chip-blue); }

.ad-pf-link--stub {
  opacity: 0.45;
  cursor: default;
  pointer-events: none;
  background: var(--surface-muted);
  border-color: var(--border);
  color: var(--muted);
}

/* ── Portfolio modal ── */
.ad-pf-overlay {
  position: fixed; inset: 0; z-index: 80;
  display: grid; place-items: center; padding: 20px;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(6px);
}

.ad-pf-modal {
  width: min(560px, 100%);
  border: 1px solid var(--border);
  border-radius: 20px;
  background: var(--surface);
  box-shadow: var(--shadow);
  display: flex; flex-direction: column; gap: 0;
  overflow: hidden;
}

.ad-pf-modal-head {
  display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;
  padding: 20px 22px 16px;
  border-bottom: 1px solid var(--border);
}
.ad-pf-modal-head h2 { margin: 0; font-size: 1.05rem; color: var(--text); }

.ad-pf-close {
  width: 30px; height: 30px;
  border: 1px solid var(--border); border-radius: 8px;
  background: transparent; color: var(--muted);
  font-size: 0.8rem; cursor: pointer; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.15s;
}
.ad-pf-close:hover { background: var(--surface-muted); }

.ad-pf-modal-body {
  display: flex; flex-direction: column; gap: 14px;
  padding: 18px 22px 20px;
  overflow-y: auto;
}

.ad-pf-field { display: grid; gap: 6px; }
.ad-pf-field span { font-size: 0.8rem; font-weight: 600; color: var(--muted); }
.ad-pf-field input,
.ad-pf-field textarea {
  min-height: 40px; padding: 9px 12px;
  border: 1px solid var(--border); border-radius: 10px;
  background: var(--surface-strong); color: var(--text);
  font: inherit; font-size: 0.875rem; outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.ad-pf-field input:focus,
.ad-pf-field textarea:focus {
  border-color: var(--accent); background: var(--surface);
  box-shadow: 0 0 0 3px rgba(59,130,246,0.1);
}
.ad-pf-field textarea { min-height: 80px; resize: vertical; }

.ad-pf-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

.ad-pf-error { margin: 0; font-size: 0.82rem; color: var(--danger); }

.ad-pf-modal-foot {
  display: flex; gap: 10px;
  padding: 14px 22px 16px;
  border-top: 1px solid var(--border);
}

@media (max-width: 640px) {
  .ad-pf-overlay { padding: 12px; }
  .ad-pf-row { grid-template-columns: 1fr; }
}
</style>
