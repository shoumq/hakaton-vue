<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import {
  fetchCompanyRegistryByInn,
  fetchCuratorCompanyById,
  fetchCuratorCompanyVerifications,
  getApiErrorMessage,
  reviewCuratorCompanyVerification,
} from '@/shared/api'
import type { CompanyRegistryDto, EmployerCompanyDto, VerificationDto } from '@/shared/api'

const route = useRoute()

const verification = ref<VerificationDto | null>(null)
const companyProfile = ref<EmployerCompanyDto | null>(null)
const companyRegistry = ref<CompanyRegistryDto | null>(null)
const isLoading = ref(true)
const isSubmitting = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const registryError = ref('')

const companyTitle = computed(
  () =>
    companyProfile.value?.brand_name ||
    companyProfile.value?.legal_name ||
    verification.value?.company_name ||
    `Компания ${String(route.params.id)}`,
)
const verificationStatus = computed(() => verification.value?.status || 'pending')
const canVerify = computed(() => verificationStatus.value !== 'approved')
const comparisonRows = computed(() => [
  {
    label: 'ИНН',
    company: companyProfile.value?.inn || verification.value?.inn_submitted || 'Не указан',
    registry: companyRegistry.value?.inn || 'Не найден',
  },
  {
    label: 'Юридическое название',
    company: companyProfile.value?.legal_name || 'Не указано',
    registry: companyRegistry.value?.full_name || companyRegistry.value?.short_name || 'Не найдено',
  },
  {
    label: 'Бренд',
    company: companyProfile.value?.brand_name || 'Не указан',
    registry: companyRegistry.value?.short_name || companyRegistry.value?.full_name || 'Не найдено',
  },
  {
    label: 'ОГРН',
    company: 'Не хранится',
    registry: companyRegistry.value?.ogrn || 'Не найден',
  },
  {
    label: 'Отрасль / ОКВЭД',
    company: companyProfile.value?.industry || 'Не указана',
    registry: companyRegistry.value?.okved || 'Не найден',
  },
])

function formatStatus(value: string | undefined) {
  switch (value) {
    case 'approved':
      return 'Подтверждено'
    case 'needs_revision':
      return 'Нужна доработка'
    case 'pending':
      return 'На проверке'
    default:
      return value || 'Не указано'
  }
}

function formatDate(value: string | undefined) {
  if (!value) {
    return 'Не указано'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

async function loadPage() {
  isLoading.value = true
  errorMessage.value = ''
  registryError.value = ''

  try {
    const id = String(route.params.id)
    const items = await fetchCuratorCompanyVerifications()
    verification.value =
      items.find((item) => item.id === id || item.company_id === id) ?? null

    if (!verification.value) {
      errorMessage.value = 'Заявка на верификацию компании не найдена.'
      companyProfile.value = null
      companyRegistry.value = null
      return
    }

    const companyId = verification.value.company_id || id
    const inn = verification.value.inn_submitted

    const [companyResult, registryResult] = await Promise.allSettled([
      fetchCuratorCompanyById(companyId),
      inn ? fetchCompanyRegistryByInn(inn) : Promise.resolve(null),
    ])

    companyProfile.value = companyResult.status === 'fulfilled' ? companyResult.value : null
    companyRegistry.value = registryResult.status === 'fulfilled' ? registryResult.value : null

    if (registryResult.status === 'rejected') {
      registryError.value = getApiErrorMessage(
        registryResult.reason,
        'Не удалось загрузить данные организации из внешнего сервиса.',
      )
    }
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, 'Не удалось загрузить страницу компании.')
  } finally {
    isLoading.value = false
  }
}

async function handleVerifyAccount() {
  if (!verification.value) {
    return
  }

  isSubmitting.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    verification.value = await reviewCuratorCompanyVerification(verification.value.id, {
      status: 'approved',
      comment: 'Проверка пройдена',
    })
    successMessage.value = 'Аккаунт компании верифицирован.'
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, 'Не удалось верифицировать аккаунт компании.')
  } finally {
    isSubmitting.value = false
  }
}

onMounted(loadPage)
</script>

<template>
  <main class="page-shell">
    <section class="company-review-page">
      <p v-if="errorMessage" class="status-banner error">{{ errorMessage }}</p>
      <p v-else-if="successMessage" class="status-banner success">{{ successMessage }}</p>
      <p v-else-if="isLoading" class="status-banner">Загружаем заявку компании...</p>

      <template v-if="verification">
        <header class="review-hero">
          <div class="hero-main">
            <p class="eyebrow">Company Review</p>
            <h1>{{ companyTitle }}</h1>
            <p class="hero-copy">
              Куратор может проверить данные компании, сверить заявку и подтвердить аккаунт вручную.
            </p>
            <div class="hero-actions">
              <button
                class="primary-button"
                type="button"
                :disabled="isSubmitting || !canVerify"
                @click="handleVerifyAccount"
              >
                {{
                  verificationStatus === 'approved'
                    ? 'Аккаунт уже верифицирован'
                    : isSubmitting
                      ? 'Верифицируем...'
                      : 'Верифицировать аккаунт'
                }}
              </button>
              <RouterLink to="/dashboard/curator" class="ghost-link">Вернуться в кабинет</RouterLink>
            </div>
          </div>

          <aside class="hero-side">
            <div class="summary-card">
              <span>Статус</span>
              <strong>{{ formatStatus(verification.status) }}</strong>
            </div>
            <div class="summary-card">
              <span>Метод</span>
              <strong>{{ verification.verification_method || 'Не указан' }}</strong>
            </div>
            <div class="summary-card">
              <span>Подано</span>
              <strong>{{ formatDate(verification.submitted_at) }}</strong>
            </div>
            <div class="summary-card">
              <span>Проверено</span>
              <strong>{{ formatDate(verification.reviewed_at) }}</strong>
            </div>
          </aside>
        </header>

        <section class="content-grid">
          <article class="section-card">
            <p class="section-label">Данные компании</p>
            <h2>Информация из заявки</h2>
            <div class="details-grid">
              <div class="detail-item">
                <span>Компания</span>
                <strong>{{ verification.company_name || 'Не указана' }}</strong>
              </div>
              <div class="detail-item">
                <span>Корпоративная почта</span>
                <strong>{{ verification.corporate_email || 'Не указана' }}</strong>
              </div>
              <div class="detail-item">
                <span>ИНН</span>
                <strong>{{ verification.inn_submitted || 'Не указан' }}</strong>
              </div>
              <div class="detail-item">
                <span>ID заявки</span>
                <strong>{{ verification.id }}</strong>
              </div>
              <div class="detail-item">
                <span>Юридическое название</span>
                <strong>{{ companyProfile?.legal_name || 'Не указано' }}</strong>
              </div>
              <div class="detail-item">
                <span>Бренд</span>
                <strong>{{ companyProfile?.brand_name || 'Не указан' }}</strong>
              </div>
              <div class="detail-item">
                <span>Отрасль</span>
                <strong>{{ companyProfile?.industry || 'Не указана' }}</strong>
              </div>
              <div class="detail-item">
                <span>Сайт</span>
                <strong>{{ companyProfile?.website_url || 'Не указан' }}</strong>
              </div>
            </div>
          </article>

          <article class="section-card">
            <p class="section-label">Внешняя проверка</p>
            <h2>Сравнение с данными по ИНН</h2>
            <p v-if="registryError" class="section-copy error-copy">{{ registryError }}</p>
            <div class="comparison-grid">
              <div class="comparison-header">Поле</div>
              <div class="comparison-header">Данные компании</div>
              <div class="comparison-header">Данные внешнего сервиса</div>
              <template v-for="row in comparisonRows" :key="row.label">
                <div class="comparison-cell label">{{ row.label }}</div>
                <div class="comparison-cell">{{ row.company }}</div>
                <div class="comparison-cell">
                  {{ row.registry }}
                  <span
                    class="match-badge"
                    :class="{ mismatch: row.company !== row.registry }"
                  >
                    {{ row.company === row.registry ? 'Совпадает' : 'Проверьте' }}
                  </span>
                </div>
              </template>
            </div>
          </article>

          <article class="section-card">
            <p class="section-label">Реестр</p>
            <h2>Данные организации из внешнего сервиса</h2>
            <div class="details-grid">
              <div class="detail-item">
                <span>Полное название</span>
                <strong>{{ companyRegistry?.full_name || 'Не найдено' }}</strong>
              </div>
              <div class="detail-item">
                <span>Краткое название</span>
                <strong>{{ companyRegistry?.short_name || 'Не найдено' }}</strong>
              </div>
              <div class="detail-item">
                <span>Статус</span>
                <strong>{{ companyRegistry?.status || 'Не найден' }}</strong>
              </div>
              <div class="detail-item">
                <span>Адрес</span>
                <strong>{{ companyRegistry?.address || 'Не найден' }}</strong>
              </div>
              <div class="detail-item">
                <span>ОГРН / КПП</span>
                <strong>{{ [companyRegistry?.ogrn, companyRegistry?.kpp].filter(Boolean).join(' / ') || 'Не найдены' }}</strong>
              </div>
              <div class="detail-item">
                <span>Дата регистрации</span>
                <strong>{{ companyRegistry?.registration_date || 'Не найдена' }}</strong>
              </div>
              <div class="detail-item">
                <span>Руководитель</span>
                <strong>{{ [companyRegistry?.management_name, companyRegistry?.management_post].filter(Boolean).join(', ') || 'Не найден' }}</strong>
              </div>
              <div class="detail-item">
                <span>Контакты из DaData</span>
                <strong>{{ [companyRegistry?.email, companyRegistry?.phone].filter(Boolean).join(' / ') || 'Не найдены' }}</strong>
              </div>
              <div class="detail-item">
                <span>Численность</span>
                <strong>{{ companyRegistry?.employee_count ?? 'Не найдена' }}</strong>
              </div>
              <div class="detail-item">
                <span>Источник</span>
                <strong>{{ companyRegistry?.source || 'Не указан' }}</strong>
              </div>
            </div>
          </article>

          <article class="section-card">
            <p class="section-label">Комментарий</p>
            <h2>Материалы на проверку</h2>
            <p class="section-copy">
              {{ verification.documents_comment || 'Комментарий работодателя не добавлен.' }}
            </p>
          </article>
        </section>
      </template>
    </section>
  </main>
</template>

<style scoped>
.company-review-page,
.content-grid,
.details-grid,
.comparison-grid {
  display: grid;
  gap: 16px;
}

.company-review-page {
  max-width: 1180px;
  margin: 0 auto;
}

.review-hero,
.section-card,
.status-banner {
  border: 1px solid rgba(18, 38, 63, 0.08);
  border-radius: 22px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(246, 248, 251, 0.94));
  box-shadow: 0 20px 44px rgba(15, 23, 42, 0.06);
}

.review-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 18px;
  padding: 24px;
}

.hero-main,
.hero-side,
.section-card {
  display: grid;
  gap: 14px;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

.hero-side {
  align-content: start;
}

.summary-card,
.detail-item {
  display: grid;
  gap: 6px;
  padding: 14px 16px;
  border: 1px solid rgba(18, 38, 63, 0.08);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.88);
}

.summary-card span,
.detail-item span,
.section-label,
.eyebrow {
  color: #2952cc;
  font: 700 0.72rem/1 var(--font-mono);
  text-transform: uppercase;
}

h1,
h2 {
  margin: 0;
  font-family: var(--font-heading);
}

h1 {
  font-size: clamp(1.9rem, 4vw, 2.8rem);
  line-height: 1;
}

.hero-copy,
.section-copy {
  margin: 0;
  color: #5c6778;
  line-height: 1.65;
}

.details-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.comparison-grid {
  grid-template-columns: 180px minmax(0, 1fr) minmax(0, 1fr);
  gap: 0;
  border: 1px solid rgba(18, 38, 63, 0.08);
  border-radius: 18px;
  overflow: hidden;
}

.comparison-header,
.comparison-cell {
  padding: 14px 16px;
  border-bottom: 1px solid rgba(18, 38, 63, 0.08);
  background: rgba(255, 255, 255, 0.9);
}

.comparison-header {
  color: #2952cc;
  font: 700 0.72rem/1 var(--font-mono);
  text-transform: uppercase;
  background: rgba(232, 238, 252, 0.7);
}

.comparison-cell.label {
  font-weight: 600;
}

.match-badge {
  display: inline-flex;
  align-items: center;
  margin-left: 10px;
  min-height: 24px;
  padding: 0 8px;
  border-radius: 999px;
  background: rgba(25, 135, 84, 0.12);
  color: #198754;
  font-size: 0.75rem;
  font-weight: 600;
}

.match-badge.mismatch {
  background: rgba(196, 69, 54, 0.12);
  color: #c44536;
}

.error-copy {
  color: var(--danger);
}

.section-card {
  padding: 22px;
}

.status-banner {
  margin: 0;
  padding: 14px 16px;
}

.status-banner.error {
  color: var(--danger);
}

.status-banner.success {
  color: #0f7b49;
}

.ghost-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 42px;
  padding: 0 16px;
  border-radius: 999px;
  text-decoration: none;
  font-size: 0.92rem;
}

.ghost-link {
  border: 1px solid rgba(148, 163, 184, 0.26);
  color: #2952cc;
  background: rgba(255, 255, 255, 0.94);
}

@media (max-width: 900px) {
  .review-hero,
  .content-grid,
  .details-grid,
  .comparison-grid {
    grid-template-columns: 1fr;
  }

  .review-hero,
  .section-card {
    padding: 18px;
    border-radius: 18px;
  }

  h1 {
    font-size: 1.8rem;
  }
}
</style>
