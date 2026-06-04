<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import LucideArrowRight from '~icons/lucide/arrow-right'
import { useSession } from '@/features/session/model/session'
import { RecommendationComposer } from '@/features/recommendations'
import MapLibreOpportunityMap from '@/shared/ui/MapLibreOpportunityMap.vue'
import {
  applyToOpportunity,
  fetchOpportunityAnalyticsPublic,
  fetchOpportunityById,
  fetchResumes,
  getApiErrorMessage,
} from '@/shared/api'
import type { OpportunityAnalyticsDto, OpportunityDetails, ResumeDto } from '@/shared/api'
import {
  formatDate,
  formatEmployment,
  formatMoneyRange,
  formatOpportunityType,
  formatWorkFormat,
} from '@/shared/lib/formatters'
import { reverseGeocode } from '@/shared/lib/geocoding'
import { sanitizeHtml } from '@/shared/lib/sanitize'
import { saveCompanyProfilePreview } from '@/shared/lib/profile-preview'
import { showErrorToast, showInfoToast, showSuccessToast } from '@/shared/lib/toast'

const route = useRoute()
const router = useRouter()
const session = useSession()

const opportunity = ref<OpportunityDetails | null>(null)
const resumes = ref<ResumeDto[]>([])
const isLoading = ref(true)
const isSubmitting = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const locationAddress = ref('')

const applyForm = reactive({
  resumeId: '',
  coverLetter: '',
})

const isStudent = computed(() => session.role.value === 'student')
const canApply = computed(() => session.isAuthenticated.value && isStudent.value)
const recommendationOpen = ref(false)

const isLoadingAnalysis = ref(false)
const opportunityAnalysis = ref<OpportunityAnalyticsDto | null>(null)

const typeColorMap: Record<string, string> = {
  vacancy: 'blue',
  internship: 'green',
  mentorship: 'purple',
  event: 'orange',
}

const typeColor = computed(() => typeColorMap[opportunity.value?.type ?? ''] ?? 'blue')

const salaryText = computed(() => {
  if (!opportunity.value) return null
  const s = formatMoneyRange(opportunity.value.salaryFrom, opportunity.value.salaryTo)
  return s === '—' || !s ? null : s
})

async function loadPage() {
  isLoading.value = true
  errorMessage.value = ''
  try {
    const id = String(route.params.id)
    opportunity.value = await fetchOpportunityById(id)

    const { latitude, longitude } = opportunity.value.location
    reverseGeocode(latitude, longitude).then((addr) => {
      if (addr) locationAddress.value = addr
    })

    if (canApply.value) {
      resumes.value = await fetchResumes()
      applyForm.resumeId = resumes.value.find((r) => r.is_primary)?.id ?? resumes.value[0]?.id ?? ''
    }
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, 'Не удалось загрузить страницу.')
    showErrorToast(errorMessage.value)
  } finally {
    isLoading.value = false
  }
}

async function handleApply() {
  if (!opportunity.value) return
  if (!session.isAuthenticated.value) {
    showInfoToast('Сначала войдите в аккаунт.')
    await router.push('/login')
    return
  }
  if (!isStudent.value) {
    showErrorToast('Отклик доступен только для соискателя.')
    return
  }
  isSubmitting.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await applyToOpportunity(opportunity.value.id, {
      resume_id: applyForm.resumeId || undefined,
      cover_letter: applyForm.coverLetter.trim() || undefined,
    })
    successMessage.value = 'Отклик отправлен.'
    showSuccessToast(successMessage.value)
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, 'Не удалось отправить отклик.')
    showErrorToast(errorMessage.value)
  } finally {
    isSubmitting.value = false
  }
}

async function handleRequestAnalysis() {
  if (!opportunity.value) return
  if (!session.isAuthenticated.value) {
    showInfoToast('Сначала войдите в аккаунт.')
    await router.push('/login')
    return
  }
  isLoadingAnalysis.value = true
  opportunityAnalysis.value = null
  try {
    opportunityAnalysis.value = await fetchOpportunityAnalyticsPublic(opportunity.value.id)
  } catch (error: unknown) {
    const status = (error as { response?: { status?: number } })?.response?.status
    if (status === 503) showErrorToast('ИИ-аналитика пока не настроена')
    else if (status === 502) showErrorToast('Не удалось получить ответ от ИИ')
    else if (status === 401) showErrorToast('Необходима авторизация')
    else showErrorToast(getApiErrorMessage(error, 'Не удалось выполнить ИИ-анализ.'))
  } finally {
    isLoadingAnalysis.value = false
  }
}

function saveCompanyPreview() {
  if (!opportunity.value?.companyId) return
  saveCompanyProfilePreview({
    id: opportunity.value.companyId,
    companyName: opportunity.value.companyName,
    avatarUrl: opportunity.value.companyAvatarUrl,
    description: opportunity.value.companyDescription,
    website: opportunity.value.companyWebsite,
    contacts: opportunity.value.contacts,
    sourceOpportunityTitle: opportunity.value.title,
  })
}

onMounted(async () => {
  await session.restoreSession()
  await loadPage()
})
</script>

<template>
  <main class="page-shell">
    <div class="od-root">

      <!-- Status -->
      <div v-if="isLoading" class="od-status">
        <span class="od-spinner"></span> Загружаем…
      </div>
      <div v-else-if="errorMessage && !opportunity" class="od-status od-status--error">
        {{ errorMessage }}
      </div>

      <template v-if="opportunity">

        <!-- Hero -->
        <header class="od-hero">
          <div class="od-hero-stripe" :class="`od-stripe--${typeColor}`"></div>
          <div class="od-hero-body">

            <div class="od-hero-main">
              <!-- Company row -->
              <div class="od-company-row">
                <div class="od-company-avatar">
                  <img v-if="opportunity.companyAvatarUrl" :src="opportunity.companyAvatarUrl" :alt="opportunity.companyName" />
                  <span v-else>{{ opportunity.companyName.slice(0,1) }}</span>
                </div>
                <div class="od-company-info">
                  <RouterLink
                    v-if="opportunity.companyId"
                    :to="`/profiles/companies/${opportunity.companyId}`"
                    class="od-company-name"
                    @click="saveCompanyPreview"
                  >{{ opportunity.companyName }}</RouterLink>
                  <span v-else class="od-company-name">{{ opportunity.companyName }}</span>
                  <span class="od-company-sub">{{ opportunity.location.city }}</span>
                </div>
              </div>

              <h1 class="od-title">{{ opportunity.title }}</h1>
              <p class="od-summary">{{ opportunity.summary }}</p>

              <!-- Tags -->
              <div class="od-tags">
                <span class="od-chip" :class="`od-chip--${typeColor}`">{{ formatOpportunityType(opportunity.type) }}</span>
                <span class="od-chip od-chip--grey">{{ formatWorkFormat(opportunity.workFormat) }}</span>
                <span class="od-chip od-chip--grey">{{ formatEmployment(opportunity.employment) }}</span>
                <span v-for="tag in opportunity.technologies" :key="tag" class="od-tag">{{ tag }}</span>
                <span v-for="level in opportunity.levels" :key="level" class="od-tag od-tag--level">{{ level }}</span>
              </div>
            </div>

            <!-- Meta aside -->
            <aside class="od-hero-aside">
              <div v-if="salaryText" class="od-salary">
                <span class="od-salary-label">Зарплата</span>
                <strong class="od-salary-value">{{ salaryText }}</strong>
              </div>
              <div class="od-meta-list">
                <div class="od-meta-item">
                  <span>Опубликовано</span>
                  <strong>{{ formatDate(opportunity.publishedAt) }}</strong>
                </div>
                <div class="od-meta-item">
                  <span>Дедлайн</span>
                  <strong>{{ formatDate(opportunity.expiresAt) }}</strong>
                </div>
                <div class="od-meta-item">
                  <span>Статус</span>
                  <strong :class="opportunity.status === 'active' ? 'od-active' : 'od-closed'">
                    {{ opportunity.status === 'active' ? 'Открыта' : opportunity.status === 'planned' ? 'Скоро' : 'Закрыта' }}
                  </strong>
                </div>
              </div>
            </aside>
          </div>
        </header>

        <!-- Body layout -->
        <div class="od-layout">

          <!-- Main column -->
          <div class="od-main">

            <!-- Description -->
            <section class="od-card">
              <div class="od-card-header">
                <p class="od-kicker">О позиции</p>
                <h2>Описание</h2>
              </div>
              <p class="od-body-text">{{ opportunity.fullDescription }}</p>
            </section>

            <!-- Contacts -->
            <section v-if="opportunity.contacts.length" class="od-card">
              <div class="od-card-header">
                <p class="od-kicker">Контакты</p>
                <h2>Как связаться</h2>
              </div>
              <div class="od-contacts-list">
                <div v-for="(c, i) in opportunity.contacts" :key="i" class="od-contact-item">
                  <span class="od-contact-icon">✉</span>
                  <span>{{ c }}</span>
                </div>
              </div>
            </section>

            <!-- Map -->
            <section class="od-card od-card--map">
              <div class="od-card-header">
                <p class="od-kicker">Место</p>
                <h2>Расположение</h2>
              </div>
              <div class="od-map-wrap">
                <MapLibreOpportunityMap
                  :latitude="opportunity.location.latitude"
                  :longitude="opportunity.location.longitude"
                  :label="opportunity.location.placementLabel"
                />
              </div>
              <div class="od-location-row">
                <span class="od-location-pin">📍</span>
                <div>
                  <strong>{{ opportunity.location.placementLabel }}</strong>
                  <span>{{ locationAddress || `${opportunity.location.latitude.toFixed(4)}, ${opportunity.location.longitude.toFixed(4)}` }}</span>
                </div>
              </div>
            </section>

            <!-- AI analysis -->
            <section v-if="opportunity.type === 'vacancy'" class="od-card od-card--ai">
              <div class="od-card-header od-card-header--ai">
                <div>
                  <h2>ИИ-анализ вакансии</h2>
                </div>
                <button
                  class="od-ai-btn"
                  type="button"
                  :disabled="isLoadingAnalysis"
                  @click="handleRequestAnalysis"
                >
                  <span v-if="isLoadingAnalysis" class="od-spinner od-spinner--sm"></span>
                  {{ isLoadingAnalysis ? 'Анализируем…' : opportunityAnalysis ? 'Обновить' : 'Запустить анализ' }}
                </button>
              </div>
              <div v-if="opportunityAnalysis" class="od-analysis" v-html="sanitizeHtml(opportunityAnalysis.analysis)" />
              <p v-else class="od-ai-hint">
                ИИ проанализирует вакансию: требования, стек, уровень и советы для соискателя.
              </p>
            </section>

          </div>

          <!-- Sidebar -->
          <aside class="od-sidebar">

            <!-- Recommend card -->
            <div v-if="session.isAuthenticated.value" class="od-card od-recommend-card">
              <div class="od-card-header">
                <p class="od-kicker">Поделиться</p>
                <h2>Рекомендовать вакансию</h2>
              </div>
              <p class="od-hint">Отправьте эту вакансию знакомому — он получит уведомление.</p>
              <button class="od-recommend-btn" type="button" @click="recommendationOpen = true">
                Порекомендовать
              </button>
            </div>

            <!-- Apply card -->
            <div class="od-card od-apply-card">
              <div class="od-card-header">
                <p class="od-kicker">Отклик</p>
                <h2>Подать заявку</h2>
              </div>

              <div v-if="successMessage" class="od-apply-success">
                ✓ {{ successMessage }}
              </div>

              <form class="od-apply-form" @submit.prevent="handleApply">
                <p v-if="!session.isAuthenticated.value" class="od-hint">
                  Войдите в аккаунт, чтобы откликнуться на эту позицию.
                </p>
                <p v-else-if="!isStudent" class="od-hint">
                  Отклик доступен только для роли соискателя.
                </p>

                <label v-if="canApply" class="od-field">
                  <span>Резюме</span>
                  <select v-model="applyForm.resumeId">
                    <option value="">Без резюме</option>
                    <option v-for="r in resumes" :key="r.id" :value="r.id">
                      {{ r.title || 'Резюме без названия' }}{{ r.is_primary ? ' ⭐' : '' }}
                    </option>
                  </select>
                </label>

                <label v-if="canApply" class="od-field">
                  <span>Сопроводительное письмо</span>
                  <textarea v-model="applyForm.coverLetter" rows="5" placeholder="Коротко расскажите, почему вы подходите…" />
                </label>

                <button class="od-apply-btn" type="submit" :disabled="isSubmitting">
                  {{
                    !session.isAuthenticated.value ? 'Войти и откликнуться'
                    : isSubmitting ? 'Отправляем…'
                    : 'Откликнуться'
                  }}
                </button>
              </form>
            </div>

            <!-- Company card -->
            <div class="od-card">
              <div class="od-card-header">
                <p class="od-kicker">Компания</p>
                <h2>{{ opportunity.companyName }}</h2>
              </div>

              <div class="od-company-detail">
                <div class="od-co-avatar-lg">
                  <img v-if="opportunity.companyAvatarUrl" :src="opportunity.companyAvatarUrl" :alt="opportunity.companyName" />
                  <span v-else>{{ opportunity.companyName.slice(0,2).toUpperCase() }}</span>
                </div>
                <div class="od-co-meta">
                  <div class="od-co-row">
                    <span>Тип</span>
                    <strong>{{ formatOpportunityType(opportunity.type) }}</strong>
                  </div>
                  <div class="od-co-row">
                    <span>Формат</span>
                    <strong>{{ formatWorkFormat(opportunity.workFormat) }}</strong>
                  </div>
                  <div v-if="opportunity.contacts[0]" class="od-co-row">
                    <span>Контакт</span>
                    <strong>{{ opportunity.contacts[0] }}</strong>
                  </div>
                </div>
              </div>

              <RouterLink
                v-if="opportunity.companyId"
                :to="`/profiles/companies/${opportunity.companyId}`"
                class="od-co-link"
                @click="saveCompanyPreview"
              >
                Открыть профиль компании <LucideArrowRight class="od-co-link-icon" />
              </RouterLink>
            </div>

          </aside>
        </div>

      </template>
    </div>

    <RecommendationComposer
      v-if="opportunity"
      :open="recommendationOpen"
      :opportunity-id="opportunity.id"
      :opportunity-title="opportunity.title"
      @close="recommendationOpen = false"
      @submitted="recommendationOpen = false"
    />
  </main>
</template>

<style scoped>
/* ── Root ── */
.od-root {
  display: grid;
  gap: 20px;
  max-width: 1180px;
  margin: 0 auto;
}

/* ── Status ── */
.od-status {
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
.od-status--error { border-color: var(--border-red); background: var(--surface-red); color: #991b1b; }

.od-spinner {
  display: inline-block;
  width: 16px; height: 16px;
  border: 2px solid #e2e8f0;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin .7s linear infinite;
  flex-shrink: 0;
}
.od-spinner--sm { width: 13px; height: 13px; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Hero ── */
.od-hero {
  border-radius: 20px;
  border: 1px solid var(--border);
  background: var(--surface);
  box-shadow: 0 4px 20px rgba(15,23,42,.06);
  overflow: hidden;
}

.od-hero-stripe {
  height: 5px;
}
.od-stripe--blue   { background: linear-gradient(90deg, #1d4ed8, #60a5fa); }
.od-stripe--green  { background: linear-gradient(90deg, #16a34a, #4ade80); }
.od-stripe--purple { background: linear-gradient(90deg, #7c3aed, #a78bfa); }
.od-stripe--orange { background: linear-gradient(90deg, #ea580c, #fb923c); }

.od-hero-body {
  display: grid;
  grid-template-columns: minmax(0,1fr) 240px;
  gap: 0;
}

.od-hero-main {
  display: grid;
  gap: 14px;
  padding: 24px 28px;
  align-content: start;
}

/* Company row */
.od-company-row { display: flex; align-items: center; gap: 12px; }

.od-company-avatar {
  width: 44px; height: 44px;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid var(--border);
  background: var(--surface-muted);
  display: flex; align-items: center; justify-content: center;
  font-size: 1.1rem; font-weight: 700; color: var(--muted);
  flex-shrink: 0;
}
.od-company-avatar img { width: 100%; height: 100%; object-fit: cover; }

.od-company-info { display: grid; gap: 2px; }

.od-company-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: #2563eb;
  text-decoration: none;
  line-height: 1.2;
}
.od-company-name:not(a) { color: var(--muted); }
a.od-company-name:hover { text-decoration: underline; }

.od-company-sub { font-size: 0.75rem; color: var(--border-strong); }

/* Title */
.od-title {
  margin: 0;
  font-family: var(--font-heading);
  font-size: clamp(1.5rem, 3vw, 2rem);
  color: var(--text);
  line-height: 1.15;
}

.od-summary { margin: 0; font-size: 0.9rem; color: var(--muted); line-height: 1.6; }

/* Tags */
.od-tags { display: flex; flex-wrap: wrap; gap: 6px; }

.od-chip {
  height: 24px;
  padding: 0 10px;
  border-radius: 6px;
  font-size: 0.72rem;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
}
.od-chip--blue   { background: var(--chip-blue);   color: var(--chip-blue-text); }
.od-chip--green  { background: var(--chip-green);  color: var(--chip-green-text); }
.od-chip--purple { background: var(--chip-purple); color: var(--chip-purple-text); }
.od-chip--orange { background: var(--chip-orange); color: var(--chip-orange-text); }
.od-chip--grey   { background: var(--surface-muted); color: var(--muted); }

.od-tag {
  height: 24px;
  padding: 0 9px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--surface-strong);
  color: var(--text);
  font-size: 0.72rem;
  display: inline-flex;
  align-items: center;
}
.od-tag--level { color: var(--muted); font-style: italic; }

/* Hero aside */
.od-hero-aside {
  display: grid;
  gap: 0;
  padding: 24px 20px;
  border-left: 1px solid var(--border);
  background: var(--surface-strong);
  align-content: start;
}

.od-salary {
  display: grid;
  gap: 3px;
  padding: 14px 16px;
  margin-bottom: 14px;
  border-radius: 12px;
  background: var(--surface-green);
  border: 1px solid var(--border-green);
}
.od-salary-label { font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--success); }
.od-salary-value { font-size: 1.15rem; font-weight: 800; color: var(--success); font-family: var(--font-heading); }

.od-meta-list { display: grid; gap: 8px; }

.od-meta-item {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 9px;
  background: var(--surface);
  border: 1px solid var(--border);
}
.od-meta-item span { font-size: 0.72rem; color: var(--border-strong); font-weight: 500; }
.od-meta-item strong { font-size: 0.82rem; font-weight: 600; color: var(--text); }

.od-active { color: var(--success) !important; }
.od-closed { color: #dc2626 !important; }

/* ── Layout ── */
.od-layout {
  display: grid;
  grid-template-columns: minmax(0,1fr) 320px;
  gap: 20px;
  align-items: start;
}

.od-main { display: grid; gap: 16px; }
.od-sidebar { display: grid; gap: 14px; }

/* ── Cards ── */
.od-card {
  padding: 20px 22px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--surface);
  box-shadow: 0 2px 8px rgba(15,23,42,.04);
  display: grid;
  gap: 14px;
}

.od-card--map { gap: 12px; }
.od-card--ai { border-color: var(--border-ai); background: var(--surface-ai); }

.od-card-header { display: grid; gap: 3px; }
.od-card-header--ai {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.od-kicker {
  margin: 0;
  font: 700 0.65rem/1 var(--font-mono, monospace);
  text-transform: uppercase;
  letter-spacing: .1em;
  color: #3b82f6;
}

.od-card--ai .od-kicker { color: #7c3aed; }

.od-card-header h2 {
  margin: 0;
  font-family: var(--font-heading);
  font-size: 1.05rem;
  color: var(--text);
}

/* Description */
.od-body-text { margin: 0; font-size: 0.9rem; color: var(--text); line-height: 1.75; white-space: pre-wrap; }

/* Contacts */
.od-contacts-list { display: grid; gap: 6px; }
.od-contact-item { display: flex; align-items: center; gap: 9px; font-size: 0.87rem; color: var(--text); }
.od-contact-icon { font-size: 0.85rem; }

/* Map */
.od-map-wrap { border-radius: 12px; overflow: hidden; height: 260px; }

.od-location-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--surface-strong);
  border: 1px solid var(--border);
}
.od-location-pin { font-size: 1rem; flex-shrink: 0; line-height: 1.4; }
.od-location-row > div { display: grid; gap: 2px; }
.od-location-row strong { font-size: 0.87rem; color: var(--text); }
.od-location-row span { font-size: 0.78rem; color: var(--muted); }

/* AI */
.od-ai-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 34px;
  padding: 0 16px;
  border-radius: 9px;
  border: 1px solid var(--border-ai);
  background: var(--surface);
  color: #7c3aed;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: background .15s;
  flex-shrink: 0;
}
.od-ai-btn:hover { background: var(--surface-ai); }
.od-ai-btn:disabled { opacity: .6; pointer-events: none; }

.od-ai-hint { margin: 0; font-size: 0.84rem; color: #7c3aed; opacity: .7; }

.od-analysis { font-size: 0.9rem; line-height: 1.7; color: var(--text); }
.od-analysis :deep(h3) { margin: 14px 0 5px; font-size: 0.95rem; font-weight: 600; color: var(--text); }
.od-analysis :deep(p) { margin: 0 0 8px; }
.od-analysis :deep(ul) { margin: 0 0 8px; padding-left: 18px; }
.od-analysis :deep(li) { margin-bottom: 5px; }
.od-analysis :deep(strong) { font-weight: 600; color: var(--text); }

/* Apply card */
.od-apply-card { border-color: var(--border-blue); background: var(--surface-blue); }
.od-recommend-card { border-color: var(--border-purple); background: var(--surface-purple); }
.od-recommend-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  padding: 0 20px;
  border: none;
  border-radius: 10px;
  background: #7c3aed;
  color: #fff;
  font: inherit;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
  margin-top: 4px;
}
.od-recommend-btn:hover { background: #6d28d9; }

.od-apply-success {
  padding: 10px 14px;
  border-radius: 10px;
  background: var(--surface-green);
  border: 1px solid var(--border-green);
  color: var(--success);
  font-size: 0.87rem;
  font-weight: 500;
}

.od-apply-form { display: grid; gap: 10px; }

.od-hint { margin: 0; font-size: 0.83rem; color: var(--muted); line-height: 1.5; }

.od-field { display: grid; gap: 5px; }
.od-field span { font-size: 0.78rem; font-weight: 600; color: var(--muted); }

.od-field select,
.od-field textarea {
  min-height: 40px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  font: inherit;
  font-size: 0.875rem;
  color: var(--text);
  outline: none;
  transition: border-color .15s, box-shadow .15s;
}
.od-field select:focus, .od-field textarea:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59,130,246,.1);
}
.od-field textarea { min-height: 110px; padding: 10px 12px; resize: vertical; }

.od-apply-btn {
  width: 100%;
  min-height: 42px;
  border-radius: 11px;
  border: none;
  background: #2563eb;
  color: #fff;
  font: inherit;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: background .15s, transform .1s;
}
.od-apply-btn:hover { background: #1d4ed8; }
.od-apply-btn:active { transform: scale(.98); }
.od-apply-btn:disabled { opacity: .55; pointer-events: none; }

/* Company detail in sidebar */
.od-company-detail { display: grid; gap: 12px; }

.od-co-avatar-lg {
  width: 52px; height: 52px;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--border);
  background: var(--surface-muted);
  display: flex; align-items: center; justify-content: center;
  font-size: 1rem; font-weight: 700; color: var(--muted);
}
.od-co-avatar-lg img { width: 100%; height: 100%; object-fit: cover; }

.od-co-meta { display: grid; gap: 6px; }

.od-co-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
}
.od-co-row span { font-size: 0.75rem; color: var(--border-strong); }
.od-co-row strong { font-size: 0.82rem; font-weight: 600; color: var(--text); text-align: right; }

.od-co-link {
  display: block;
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface-strong);
  color: #2563eb;
  font-size: 0.84rem;
  font-weight: 500;
  text-decoration: none;
  text-align: center;
  transition: background .15s, border-color .15s;
}
.od-co-link:hover { background: var(--surface-blue); border-color: var(--border-blue); }
.od-co-link { display: flex; align-items: center; justify-content: center; gap: 6px; }
.od-co-link-icon { width: 15px; height: 15px; flex-shrink: 0; }

/* ── Responsive ── */
@media (max-width: 1024px) {
  .od-layout { grid-template-columns: 1fr; }
  .od-sidebar { grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); }
}

@media (max-width: 760px) {
  .od-hero-body { grid-template-columns: 1fr; }
  .od-hero-aside { border-left: none; border-top: 1px solid var(--border); }
  .od-hero-main { padding: 20px; }
  .od-hero-aside { padding: 16px 20px; }
  .od-sidebar { grid-template-columns: 1fr; }
}
</style>

<style scoped>
:global(.dark) .od-chip--blue   { background: var(--chip-blue);   color: var(--chip-blue-text); }
:global(.dark) .od-chip--green  { background: var(--chip-green);  color: var(--chip-green-text); }
:global(.dark) .od-chip--purple { background: var(--chip-purple); color: var(--chip-purple-text); }
:global(.dark) .od-chip--orange { background: var(--chip-orange); color: var(--chip-orange-text); }
:global(.dark) .od-salary       { background: #091a0d; border-color: #14532d; }
:global(.dark) .od-apply-card   { background: #0a1020; border-color: var(--accent-soft); }
:global(.dark) .od-apply-success { background: #091a0d; border-color: #14532d; color: #4ade80; }
:global(.dark) .od-card--ai     { background: #130e22; border-color: #4c1d95; }
:global(.dark) .od-recommend-card { background: #130a22; border-color: #4c1d95; }
:global(.dark) .od-status--error { border-color: #7f1d1d; background: #1f0808; color: #fca5a5; }
:global(.dark) .od-tag { background: #0f1e38; border-color: var(--border); color: #93c5fd; }
:global(.dark) .od-tag--level { background: #130e22; border-color: #4c1d95; color: #c4b5fd; }
</style>
