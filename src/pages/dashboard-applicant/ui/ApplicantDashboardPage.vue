<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

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
  fetchPublicCatalog,
  fetchResumes,
  fetchStudentProfile,
  getApiErrorMessage,
  uploadMyAvatar,
} from '@/shared/api'
import type {
  ApplicationDto,
  ContactDto,
  NotificationDto,
  PortfolioProjectDto,
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
const isUploadingAvatar = ref(false)
const avatarError = ref('')

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

  if (visibility === 'public') {
    return 'Публичный'
  }

  if (visibility === 'private') {
    return 'Приватный'
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

const activityMetrics = computed(() => [
  { label: 'Отклики', value: String(applications.value.length) },
  { label: 'Избранное', value: String(favoriteOpportunities.value.length) },
  { label: 'Контакты', value: String(contacts.value.length) },
  { label: 'Запросы', value: String(contactRequests.value.length) },
])

async function handleAvatarChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  if (!file) {
    return
  }

  isUploadingAvatar.value = true
  avatarError.value = ''

  try {
    const user = await uploadMyAvatar(file)
    session.patchCurrentUser({
      displayName: user.display_name || session.currentUser.value?.displayName || user.email,
      avatarUrl: user.avatar_url,
    })
  } catch (error) {
    avatarError.value = getApiErrorMessage(error, 'Не удалось загрузить фото профиля.')
  } finally {
    isUploadingAvatar.value = false
    input.value = ''
  }
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
    <section class="dashboard">
      <header class="profile-hero">
        <div class="hero-main">
          <div class="hero-topline">
            <div class="avatar-shell">
              <img
                v-if="session.currentUser.value?.avatarUrl"
                :src="session.currentUser.value.avatarUrl"
                alt="Фото профиля"
                class="avatar-image"
              />
              <span v-else class="avatar-fallback">{{ avatarFallback }}</span>
            </div>

            <div class="identity-block">
              <p class="section-label">Профиль соискателя</p>
              <h1>{{ fullName }}</h1>
              <p class="headline">{{ profileSummary }}</p>
              <p class="subheadline">{{ aboutText }}</p>
            </div>
          </div>

          <div class="hero-actions">
            <label class="secondary-button upload-button">
              <input type="file" accept="image/*" @change="handleAvatarChange" />
              {{ isUploadingAvatar ? 'Загрузка...' : 'Обновить фото' }}
            </label>
            <RouterLink to="/" class="secondary-button">К поиску вакансий</RouterLink>
          </div>

          <p v-if="avatarError" class="inline-error">{{ avatarError }}</p>
        </div>

        <aside class="hero-side">
          <div class="hero-side-head">
            <p class="section-label">Сводка</p>
            <h2>Профиль сейчас</h2>
          </div>
          <div class="facts-list">
            <div v-for="fact in profileFacts" :key="fact.label" class="fact-card">
              <span>{{ fact.label }}</span>
              <strong>{{ fact.value }}</strong>
            </div>
          </div>
        </aside>
      </header>

      <p v-if="errorMessage" class="status-banner error">{{ errorMessage }}</p>
      <p v-else-if="isLoading" class="status-banner">Загружаем данные кабинета...</p>

      <section class="metrics-grid">
        <article v-for="metric in activityMetrics" :key="metric.label" class="metric-card">
          <span>{{ metric.label }}</span>
          <strong>{{ metric.value }}</strong>
        </article>
      </section>

      <section class="content-grid">
        <div class="main-column">
          <article class="section-card">
            <div class="section-head">
              <div>
                <p class="section-label">Профиль</p>
                <h2>Резюме и позиционирование</h2>
              </div>
            </div>
            <p class="section-copy">
              {{ aboutText }}
            </p>
            <div class="detail-grid">
              <div class="detail-card">
                <span>Университет</span>
                <strong>{{ studentProfile?.university_name || 'Не указано' }}</strong>
              </div>
              <div class="detail-card">
                <span>Специализация</span>
                <strong>{{ studentProfile?.specialization || 'Не указано' }}</strong>
              </div>
              <div class="detail-card">
                <span>Курс / год</span>
                <strong>{{ studentProfile?.study_year || studentProfile?.graduation_year || 'Не указано' }}</strong>
              </div>
              <div class="detail-card">
                <span>Видимость</span>
                <strong>{{ privacyLabel }}</strong>
              </div>
            </div>
          </article>

          <article class="section-card">
            <div class="section-head">
              <div>
                <p class="section-label">Активность</p>
                <h2>История откликов</h2>
              </div>
            </div>

            <div class="list-table">
              <div v-if="!applicationCards.length" class="table-row empty">
                <strong>Откликов пока нет</strong>
                <span>После отправки отклика история появится здесь.</span>
              </div>
              <div v-for="item in applicationCards" :key="item.id" class="table-row">
                <div>
                  <strong>{{ item.opportunity?.title || item.opportunityId }}</strong>
                  <span>{{ item.opportunity?.companyName || 'Компания не указана' }}</span>
                </div>
                <span class="status-pill">{{ item.status }}</span>
                <span>{{ item.updatedAt ? formatDate(item.updatedAt) : 'нет данных' }}</span>
              </div>
            </div>
          </article>

          <article class="section-card">
            <div class="section-head">
              <div>
                <p class="section-label">Избранное</p>
                <h2>Сохраненные вакансии</h2>
              </div>
            </div>
            <p v-if="!favoriteOpportunities.length" class="section-copy">
              Список избранного пока пуст.
            </p>
            <div class="saved-list">
              <OpportunityCard
                v-for="opportunity in favoriteOpportunities"
                :key="opportunity.id"
                :opportunity="opportunity"
                compact
              />
            </div>
          </article>
        </div>

        <aside class="side-column">
          <article class="section-card compact">
            <div class="section-head">
              <div>
                <p class="section-label">Контакты</p>
                <h2>Сеть</h2>
              </div>
            </div>
            <div class="stack-list">
              <div v-if="!contacts.length && !contactRequests.length" class="mini-card">
                <strong>Пока пусто</strong>
                <span>Контакты и запросы появятся после нетворкинга.</span>
              </div>
              <div
                v-for="contact in [...contacts, ...contactRequests]"
                :key="contact.id"
                class="mini-card"
              >
                <strong>{{ contact.display_name || 'Контакт без имени' }}</strong>
                <span>{{ contact.title || contact.message || 'Без описания' }}</span>
                <span>{{ contact.status || 'pending' }}</span>
              </div>
            </div>
          </article>

          <article class="section-card compact">
            <div class="section-head">
              <div>
                <p class="section-label">Материалы</p>
                <h2>Резюме и портфолио</h2>
              </div>
            </div>
            <div class="stack-list">
              <div class="mini-card">
                <strong>Резюме</strong>
                <span>{{ resumes.length ? `${resumes.length} шт.` : 'Не добавлено' }}</span>
              </div>
              <div class="mini-card">
                <strong>Проекты</strong>
                <span>{{ portfolioProjects.length ? `${portfolioProjects.length} шт.` : 'Нет проектов' }}</span>
              </div>
              <div class="mini-card">
                <strong>Уведомления</strong>
                <span>{{ notifications.length ? `${notifications.length} новых` : 'Новых нет' }}</span>
              </div>
            </div>
          </article>
        </aside>
      </section>
    </section>
  </main>
</template>

<style scoped>
.dashboard {
  max-width: 1240px;
  margin: 0 auto;
  display: grid;
  gap: 16px;
}

.profile-hero,
.section-card,
.metric-card,
.status-banner {
  border: 1px solid #d7dee7;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
}

.profile-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 0;
  align-items: start;
  overflow: hidden;
}

.hero-main {
  display: grid;
  gap: 12px;
  padding: 20px 24px;
  align-content: start;
}

.hero-side {
  display: grid;
  gap: 12px;
  padding: 20px 20px;
  border-left: 1px solid #e3e8ef;
  background:
    linear-gradient(180deg, #fbfcfd 0%, #f6f9fc 100%);
  align-content: start;
}

.hero-topline {
  display: grid;
  grid-template-columns: 104px minmax(0, 1fr);
  gap: 14px;
  align-items: start;
}

.avatar-shell {
  width: 96px;
  height: 96px;
  overflow: hidden;
  border: 3px solid #fff;
  border-radius: 16px;
  background: linear-gradient(180deg, #eff4f9, #dde7f2);
  box-shadow: 0 5px 14px rgba(15, 23, 42, 0.06);
}

.avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-fallback {
  display: grid;
  width: 100%;
  height: 100%;
  place-items: center;
  font: 700 1.35rem/1 var(--font-heading);
  color: #24456b;
}

.identity-block {
  display: grid;
  gap: 5px;
}

.hero-side-head {
  display: grid;
  gap: 3px;
}

.section-label {
  margin: 0;
  color: #526581;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

h1,
h2 {
  margin: 0;
  color: #1d2939;
  font-family: var(--font-heading);
}

h1 {
  font-size: 1.8rem;
  line-height: 1.08;
  letter-spacing: -0.03em;
}

h2 {
  font-size: 1rem;
  line-height: 1.22;
}

.headline,
.subheadline,
.section-copy,
.mini-card span,
.detail-card span,
.table-row span {
  margin: 0;
  color: #526581;
  line-height: 1.45;
}

.headline {
  font-size: 0.88rem;
}

.subheadline {
  max-width: 720px;
  font-size: 0.88rem;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.secondary-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 34px;
  padding: 0 12px;
  border: 1px solid #cfd8e3;
  border-radius: 8px;
  background: #fff;
  color: #1d4f91;
  text-decoration: none;
  cursor: pointer;
  font-size: 0.88rem;
}

.upload-button input {
  display: none;
}

.inline-error {
  margin: 0;
  color: var(--danger);
  font-size: 0.88rem;
}

.facts-list,
.stack-list,
.saved-list,
.main-column,
.side-column {
  display: grid;
  gap: 10px;
}

.facts-list {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.fact-card {
  display: grid;
  gap: 4px;
  min-height: 72px;
  padding: 12px 14px;
  border: 1px solid #dfe7f0;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
}

.fact-card span {
  font-size: 0.7rem;
  color: #667085;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.fact-card strong {
  font-size: 0.9rem;
  line-height: 1.2;
  color: #101828;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.metric-card {
  display: grid;
  gap: 4px;
  padding: 12px 14px;
}

.metric-card span {
  color: #667085;
  font-size: 0.84rem;
}

.metric-card strong {
  font-size: 1.1rem;
  font-weight: 700;
  color: #101828;
}

.content-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 14px;
  align-items: start;
}

.section-card {
  padding: 16px 18px;
}

.section-card.compact {
  padding: 14px;
}

.section-head {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.section-head > div {
  display: grid;
  gap: 7px;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 12px;
}

.detail-card,
.mini-card {
  display: grid;
  gap: 4px;
  padding: 11px 12px;
  border: 1px solid #e4eaf1;
  border-radius: 10px;
  background: #fafbfd;
}

.detail-card strong,
.mini-card strong {
  color: #1d2939;
}

.list-table {
  display: grid;
}

.table-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 120px 140px;
  gap: 16px;
  align-items: center;
  padding: 10px 0;
  border-top: 1px solid #edf1f5;
}

.table-row:first-child {
  border-top: 0;
  padding-top: 0;
}

.table-row.empty {
  grid-template-columns: 1fr;
}

.table-row strong {
  display: block;
  margin-bottom: 4px;
  color: #101828;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 24px;
  padding: 0 8px;
  border-radius: 999px;
  background: #edf4ff;
  color: #0a66c2;
  font-size: 0.74rem;
  font-weight: 700;
  text-transform: capitalize;
}

.status-banner {
  padding: 11px 13px;
  font-size: 0.9rem;
}

.status-banner.error {
  color: var(--danger);
}

@media (max-width: 1100px) {
  .profile-hero,
  .content-grid {
    grid-template-columns: 1fr;
  }

  .hero-side {
    border-left: 0;
    border-top: 1px solid #e3e8ef;
  }

  .metrics-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .facts-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .hero-main,
  .hero-side,
  .section-card {
    padding: 14px;
  }

  .hero-topline {
    grid-template-columns: 1fr;
  }

  .avatar-shell {
    width: 72px;
    height: 72px;
  }

  h1 {
    font-size: 1.55rem;
  }

  .detail-grid,
  .metrics-grid,
  .table-row {
    grid-template-columns: 1fr;
  }

  .facts-list {
    grid-template-columns: 1fr;
  }
}
</style>
