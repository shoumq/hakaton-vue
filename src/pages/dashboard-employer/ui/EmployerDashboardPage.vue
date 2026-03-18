<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'

import type { Opportunity, OpportunityType, WorkFormat } from '@/entities/opportunity/model/types'
import OpportunityCard from '@/entities/opportunity/ui/OpportunityCard.vue'
import { useSession } from '@/features/session/model/session'
import {
  createEmployerOpportunity,
  fetchEmployerCompany,
  fetchEmployerOpportunities,
  fetchPublicCatalog,
  getApiErrorMessage,
  submitEmployerVerification,
  uploadMyAvatar,
  updateEmployerCompany,
} from '@/shared/api'
import type { BackendTag, EmployerCompanyDto, OpportunityCreateInput, VerificationInput } from '@/shared/api'

interface OpportunityFormState {
  title: string
  shortDescription: string
  fullDescription: string
  companyName: string
  opportunityType: OpportunityType
  workFormat: WorkFormat
  locationId: string
  vacancyLevel: string
  employmentType: string
  salaryMin: string
  salaryMax: string
  salaryCurrency: string
  isSalaryVisible: boolean
  applicationDeadline: string
  contactsInfo: string
  externalUrl: string
  expiresAt: string
  eventStartAt: string
  eventEndAt: string
  status: string
  selectedTechnologyTagIds: string[]
}

const session = useSession()
const employerOpportunities = ref<Opportunity[]>([])
const company = ref<EmployerCompanyDto | null>(null)
const employerProfile = ref<Record<string, unknown> | null>(null)
const locations = ref<Array<{ id: string; display_text?: string }>>([])
const tags = ref<BackendTag[]>([])
const isLoading = ref(true)
const isSavingCompany = ref(false)
const isSubmittingVerification = ref(false)
const isSubmittingOpportunity = ref(false)
const errorMessage = ref('')
const infoMessage = ref('')
const avatarError = ref('')

const companyForm = reactive({
  legalName: '',
  brandName: '',
  website: '',
  industry: '',
  foundedYear: '',
  inn: '',
})

const verificationForm = reactive({
  inn: '',
  comment: '',
})

const opportunityForm = reactive<OpportunityFormState>({
  title: '',
  shortDescription: '',
  fullDescription: '',
  companyName: '',
  opportunityType: 'internship',
  workFormat: 'remote',
  locationId: '',
  vacancyLevel: 'junior',
  employmentType: 'part_time',
  salaryMin: '',
  salaryMax: '',
  salaryCurrency: 'RUB',
  isSalaryVisible: true,
  applicationDeadline: '',
  contactsInfo: '',
  externalUrl: '',
  expiresAt: '',
  eventStartAt: '',
  eventEndAt: '',
  status: 'draft',
  selectedTechnologyTagIds: [] as string[],
})

const typeOptions = [
  { value: 'internship', label: 'Стажировка' },
  { value: 'vacancy', label: 'Вакансия' },
  { value: 'mentorship', label: 'Менторская программа' },
  { value: 'event', label: 'Карьерное мероприятие' },
]

const opportunityTypeConfig = {
  internship: {
    showVacancyFields: true,
    showSalaryFields: true,
    showEventFields: false,
    note: 'Стажировка с параметрами уровня, занятости и компенсации.',
  },
  vacancy: {
    showVacancyFields: true,
    showSalaryFields: true,
    showEventFields: false,
    note: 'Вакансия с уровнем позиции, занятостью и зарплатной вилкой.',
  },
  mentorship: {
    showVacancyFields: false,
    showSalaryFields: false,
    showEventFields: false,
    note: 'Менторская программа без зарплатного и vacancy-блока.',
  },
  event: {
    showVacancyFields: false,
    showSalaryFields: false,
    showEventFields: true,
    note: 'Карьерное мероприятие с датой начала и завершения события.',
  },
} as const

const formatOptions = [
  { value: 'office', label: 'Офис' },
  { value: 'hybrid', label: 'Гибрид' },
  { value: 'remote', label: 'Удалённо' },
]

const employmentOptions = [
  { value: 'full_time', label: 'Полная занятость' },
  { value: 'part_time', label: 'Частичная занятость' },
  { value: 'project', label: 'Проектная работа' },
]

const statusOptions = [
  { value: 'draft', label: 'Черновик' },
  { value: 'published', label: 'Опубликовать' },
]

const companyStatusLabel = computed(() => {
  const status = company.value?.status ?? 'unknown'

  if (status === 'verified') {
    return 'Компания подтверждена'
  }

  if (status === 'pending_verification') {
    return 'Ожидает верификации'
  }

  return status
})

const canShowVerificationSection = computed(() => {
  const status = company.value?.status

  return status !== 'pending_verification' && status !== 'verified'
})

const canCreateOpportunities = computed(() => company.value?.status === 'verified')

const technologyTags = computed(() => tags.value.filter((tag) => tag.tag_type === 'technology'))
const selectedLocationLabel = computed(
  () => locations.value.find((location) => location.id === opportunityForm.locationId)?.display_text || '',
)
const currentOpportunityTypeConfig = computed(
  () => opportunityTypeConfig[opportunityForm.opportunityType],
)
const selectedTechnologyLabels = computed(() =>
  technologyTags.value
    .filter((tag) => opportunityForm.selectedTechnologyTagIds.includes(tag.id))
    .map((tag) => tag.name),
)
const employmentLabel = computed(
  () => employmentOptions.find((option) => option.value === opportunityForm.employmentType)?.label || '',
)
const previewTagGroups = computed(() => [
  ...selectedTechnologyLabels.value,
  currentOpportunityTypeConfig.value.showVacancyFields ? opportunityForm.vacancyLevel : '',
  currentOpportunityTypeConfig.value.showVacancyFields ? employmentLabel.value : '',
].filter(Boolean))

const avatarFallback = computed(() => {
  const value =
    company.value?.brand_name ||
    session.currentUser.value?.displayName ||
    session.currentUser.value?.email ||
    'U'

  return value
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
})

function resetOpportunityForm() {
  opportunityForm.title = ''
  opportunityForm.shortDescription = ''
  opportunityForm.fullDescription = ''
  opportunityForm.companyName = company.value?.brand_name || company.value?.legal_name || ''
  opportunityForm.opportunityType = 'internship'
  opportunityForm.workFormat = 'remote'
  opportunityForm.locationId = locations.value[0]?.id ?? ''
  opportunityForm.vacancyLevel = 'junior'
  opportunityForm.employmentType = 'part_time'
  opportunityForm.salaryMin = ''
  opportunityForm.salaryMax = ''
  opportunityForm.salaryCurrency = 'RUB'
  opportunityForm.isSalaryVisible = true
  opportunityForm.applicationDeadline = ''
  opportunityForm.contactsInfo = ''
  opportunityForm.externalUrl = ''
  opportunityForm.expiresAt = ''
  opportunityForm.eventStartAt = ''
  opportunityForm.eventEndAt = ''
  opportunityForm.status = 'draft'
  opportunityForm.selectedTechnologyTagIds = []
}

function buildVerificationPayload(): VerificationInput {
  const inn = verificationForm.inn.trim()
  const comment = verificationForm.comment.trim()

  if (!inn) {
    throw new Error('Для верификации по ИНН нужно указать ИНН компании.')
  }

  return {
    inn_submitted: inn,
    verification_method: 'inn_check',
    documents_comment: comment || undefined,
  }
}

function clearIrrelevantOpportunityFields(type: OpportunityType) {
  const config = opportunityTypeConfig[type]

  if (!config.showVacancyFields) {
    opportunityForm.vacancyLevel = ''
    opportunityForm.employmentType = ''
  } else {
    opportunityForm.vacancyLevel ||= 'junior'
    opportunityForm.employmentType ||= 'part_time'
  }

  if (!config.showSalaryFields) {
    opportunityForm.salaryMin = ''
    opportunityForm.salaryMax = ''
    opportunityForm.salaryCurrency = 'RUB'
    opportunityForm.isSalaryVisible = false
  } else {
    opportunityForm.salaryCurrency ||= 'RUB'
  }

  if (!config.showEventFields) {
    opportunityForm.eventStartAt = ''
    opportunityForm.eventEndAt = ''
  }
}

function buildOpportunityPayload(): OpportunityCreateInput {
  const sharedPayload = {
    title: opportunityForm.title.trim(),
    short_description: opportunityForm.shortDescription.trim(),
    full_description: opportunityForm.fullDescription.trim(),
    opportunity_type: opportunityForm.opportunityType,
    work_format: opportunityForm.workFormat,
    location_id: opportunityForm.locationId,
    application_deadline: opportunityForm.applicationDeadline || undefined,
    contacts_info: opportunityForm.contactsInfo.trim() || undefined,
    external_url: opportunityForm.externalUrl.trim() || undefined,
    expires_at: opportunityForm.expiresAt || undefined,
    tag_ids: opportunityForm.selectedTechnologyTagIds.length
      ? opportunityForm.selectedTechnologyTagIds
      : undefined,
    status: opportunityForm.status,
  } as const

  if (opportunityForm.opportunityType === 'event') {
    if (
      opportunityForm.eventStartAt &&
      opportunityForm.eventEndAt &&
      new Date(opportunityForm.eventStartAt).getTime() > new Date(opportunityForm.eventEndAt).getTime()
    ) {
      throw new Error('Для мероприятия дата начала должна быть раньше или равна дате завершения.')
    }

    return {
      ...sharedPayload,
      opportunity_type: 'event',
      event_start_at: opportunityForm.eventStartAt || undefined,
      event_end_at: opportunityForm.eventEndAt || undefined,
    }
  }

  if (opportunityForm.opportunityType === 'mentorship') {
    return {
      ...sharedPayload,
      opportunity_type: 'mentorship',
    }
  }

  return {
    ...sharedPayload,
    opportunity_type: opportunityForm.opportunityType,
    vacancy_level: opportunityForm.vacancyLevel || undefined,
    employment_type: opportunityForm.employmentType || undefined,
    salary_min: opportunityForm.salaryMin ? Number(opportunityForm.salaryMin) : undefined,
    salary_max: opportunityForm.salaryMax ? Number(opportunityForm.salaryMax) : undefined,
    salary_currency:
      opportunityForm.salaryMin || opportunityForm.salaryMax || opportunityForm.isSalaryVisible
        ? opportunityForm.salaryCurrency
        : undefined,
    is_salary_visible: opportunityForm.isSalaryVisible,
  }
}

async function handleAvatarChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  if (!file) {
    return
  }

  isSavingCompany.value = true
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
    isSavingCompany.value = false
    input.value = ''
  }
}

async function loadDashboard() {
  const [companyResult, opportunitiesResult, catalogResult] = await Promise.allSettled([
    fetchEmployerCompany(),
    fetchEmployerOpportunities(),
    fetchPublicCatalog(),
  ])

  if (companyResult.status !== 'fulfilled') {
    throw companyResult.reason
  }

  const companyData = companyResult.value

  company.value = companyData
  employerProfile.value = {
    is_company_owner: true,
    can_create_opportunities: companyData.status === 'verified',
  }

  if (opportunitiesResult.status === 'fulfilled') {
    employerOpportunities.value = opportunitiesResult.value
  } else {
    employerOpportunities.value = []
  }

  if (catalogResult.status === 'fulfilled') {
    locations.value = catalogResult.value.locations
    tags.value = catalogResult.value.tags
  } else {
    locations.value = []
    tags.value = []
  }

  companyForm.legalName = companyData.legal_name ?? ''
  companyForm.brandName = companyData.brand_name ?? ''
  companyForm.website = companyData.website_url ?? ''
  companyForm.industry = companyData.industry ?? ''
  companyForm.foundedYear = companyData.founded_year ? String(companyData.founded_year) : ''
  companyForm.inn = companyData.inn ?? ''

  verificationForm.inn = companyData.inn ?? ''

  resetOpportunityForm()
}

async function handleSaveCompany() {
  isSavingCompany.value = true
  errorMessage.value = ''
  infoMessage.value = ''

  try {
    company.value = await updateEmployerCompany({
      legal_name: companyForm.legalName.trim() || undefined,
      brand_name: companyForm.brandName.trim() || undefined,
      website_url: companyForm.website.trim() || undefined,
      industry: companyForm.industry.trim() || undefined,
      founded_year: companyForm.foundedYear ? Number(companyForm.foundedYear) : undefined,
      inn: companyForm.inn.trim() || undefined,
    })
    opportunityForm.companyName = company.value?.brand_name || company.value?.legal_name || ''
    infoMessage.value = 'Профиль компании сохранен.'
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, 'Не удалось сохранить профиль компании.')
  } finally {
    isSavingCompany.value = false
  }
}

async function handleSubmitVerification() {
  isSubmittingVerification.value = true
  errorMessage.value = ''
  infoMessage.value = ''

  try {
    await submitEmployerVerification(buildVerificationPayload())
    infoMessage.value = 'Заявка на верификацию отправлена.'
    await loadDashboard()
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, 'Не удалось отправить верификацию.')
  } finally {
    isSubmittingVerification.value = false
  }
}

async function handleCreateOpportunity() {
  isSubmittingOpportunity.value = true
  errorMessage.value = ''
  infoMessage.value = ''

  try {
    await createEmployerOpportunity(buildOpportunityPayload())
    infoMessage.value = 'Карточка возможности создана.'
    resetOpportunityForm()
    employerOpportunities.value = await fetchEmployerOpportunities()
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, 'Не удалось создать возможность.')
  } finally {
    isSubmittingOpportunity.value = false
  }
}

onMounted(async () => {
  isLoading.value = true
  errorMessage.value = ''

  try {
    await loadDashboard()
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, 'Не удалось загрузить кабинет работодателя.')
  } finally {
    isLoading.value = false
  }
})

watch(
  () => opportunityForm.opportunityType,
  (type) => {
    clearIrrelevantOpportunityFields(type)
  },
)
</script>

<template>
  <main class="page-shell">
    <section class="dashboard">
      <div class="dashboard-hero">
        <div class="hero-copy-block">
          <p class="eyebrow">Employer Console</p>
          <h1>{{ company?.brand_name || company?.legal_name || 'Компания' }}</h1>
          <p class="hero-copy">
            {{ company?.description || 'Заполните профиль компании и отправьте верификацию перед публикацией.' }}
          </p>
          <div class="hero-metrics">
            <div class="metric-chip">
              <span>Статус</span>
              <strong>{{ companyStatusLabel }}</strong>
            </div>
            <div class="metric-chip">
              <span>Публикация</span>
              <strong>{{ employerProfile?.can_create_opportunities ? 'Разрешена' : 'После проверки' }}</strong>
            </div>
          </div>
        </div>
        <div class="verification-card">
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
            {{ isSavingCompany ? 'Загрузка...' : 'Загрузить фото' }}
          </label>
          <span v-if="avatarError" class="upload-error">{{ avatarError }}</span>
          <strong>Статус: {{ companyStatusLabel }}</strong>
          <p>Владелец компании: {{ employerProfile?.is_company_owner ? 'да' : 'нет' }}</p>
          <p>Публикация возможностей: {{ employerProfile?.can_create_opportunities ? 'разрешена' : 'заблокирована до проверки' }}</p>
        </div>
      </div>

      <p v-if="errorMessage" class="status-banner error">{{ errorMessage }}</p>
      <p v-else-if="infoMessage" class="status-banner">{{ infoMessage }}</p>
      <p v-else-if="isLoading" class="status-banner">Загружаем кабинет работодателя...</p>

      <section class="dashboard-grid" :class="{ 'single-column': !canShowVerificationSection }">
        <article class="section-card">
          <div class="section-title">
            <h2>Профиль компании</h2>
            <p>Основные данные бренда и реквизиты для публикации.</p>
          </div>
          <form class="editor-grid" @submit.prevent="handleSaveCompany">
            <label class="field">
              <span>Юридическое название</span>
              <input v-model="companyForm.legalName" type="text" />
            </label>
            <label class="field">
              <span>Бренд</span>
              <input v-model="companyForm.brandName" type="text" />
            </label>
            <label class="field">
              <span>Сайт</span>
              <input v-model="companyForm.website" type="url" />
            </label>
            <label class="field">
              <span>Индустрия</span>
              <input v-model="companyForm.industry" type="text" />
            </label>
            <label class="field">
              <span>Год основания</span>
              <input v-model="companyForm.foundedYear" type="number" min="1900" />
            </label>
            <label class="field">
              <span>ИНН</span>
              <input v-model="companyForm.inn" type="text" />
            </label>

            <button class="primary-button" type="submit" :disabled="isSavingCompany">
              {{ isSavingCompany ? 'Сохраняем...' : 'Сохранить профиль' }}
            </button>
          </form>
        </article>

        <article v-if="canShowVerificationSection" class="section-card">
          <div class="section-title">
            <h2>Верификация компании</h2>
            <p>Подтверждение работодателя выполняется только по ИНН компании.</p>
          </div>
          <form class="editor-grid" @submit.prevent="handleSubmitVerification">
            <label class="field">
              <span>ИНН</span>
              <input v-model="verificationForm.inn" type="text" required />
            </label>
            <label class="field field-wide">
              <span>Комментарий</span>
              <textarea
                v-model="verificationForm.comment"
                rows="4"
                placeholder="При необходимости добавьте комментарий для куратора"
              />
            </label>

            <button class="primary-button" type="submit" :disabled="isSubmittingVerification">
              {{ isSubmittingVerification ? 'Отправляем...' : 'Отправить на проверку' }}
            </button>
          </form>
        </article>
      </section>

      <section v-if="canCreateOpportunities" class="dashboard-section">
        <div class="section-heading opportunity-heading">
          <div class="section-heading-copy">
            <p class="eyebrow">Opportunity Studio</p>
            <h2>Новая возможность</h2>
            <p class="hero-copy">
              Форма покрывает публикацию вакансии, стажировки, менторской программы или карьерного мероприятия.
            </p>
          </div>
          <div class="opportunity-highlights">
            <div class="highlight-pill">
              <strong>Структурированная форма</strong>
              <span>Основное, даты, контакты и теги разбиты на логичные группы.</span>
            </div>
            <div class="highlight-pill">
              <strong>Стартовый каталог тегов</strong>
              <span>Популярные технологии и уровни уже доступны, дополнительные теги можно добавить вручную.</span>
            </div>
          </div>
        </div>

        <div class="opportunity-layout">
          <form class="opportunity-editor" @submit.prevent="handleCreateOpportunity">
            <section class="opportunity-form-card">
              <div class="form-card-header">
                <div>
                  <p class="form-card-eyebrow">Основа</p>
                  <h3>Главная информация</h3>
                </div>
                <span class="form-card-note">Что это за возможность и кому она подходит</span>
              </div>
              <div class="editor-grid">
                <label class="field">
                  <span>Название позиции или мероприятия</span>
                  <input v-model="opportunityForm.title" type="text" required />
                </label>
                <label class="field">
                  <span>Компания-работодатель или организатор</span>
                  <input v-model="opportunityForm.companyName" type="text" readonly />
                </label>
                <label class="field">
                  <span>Тип</span>
                  <select v-model="opportunityForm.opportunityType">
                    <option v-for="option in typeOptions" :key="option.value" :value="option.value">
                      {{ option.label }}
                    </option>
                  </select>
                </label>
                <label class="field">
                  <span>Формат работы</span>
                  <select v-model="opportunityForm.workFormat">
                    <option v-for="option in formatOptions" :key="option.value" :value="option.value">
                      {{ option.label }}
                    </option>
                  </select>
                </label>
                <label class="field">
                  <span>Локация из каталога</span>
                  <select v-model="opportunityForm.locationId">
                    <option v-for="location in locations" :key="location.id" :value="location.id">
                      {{ location.display_text || location.id }}
                    </option>
                  </select>
                </label>
                <label class="field">
                  <span>Статус публикации</span>
                  <select v-model="opportunityForm.status">
                    <option v-for="option in statusOptions" :key="option.value" :value="option.value">
                      {{ option.label }}
                    </option>
                  </select>
                </label>
                <label class="field field-wide">
                  <span>Краткое описание</span>
                  <textarea
                    v-model="opportunityForm.shortDescription"
                    rows="3"
                    required
                    placeholder="Кратко опишите задачу, направление и ценность предложения."
                  />
                </label>
                <label class="field field-wide">
                  <span>Полное описание</span>
                  <textarea
                    v-model="opportunityForm.fullDescription"
                    rows="6"
                    placeholder="Полное описание программы, роли или события."
                    required
                  />
                </label>
              </div>
            </section>

            <section class="opportunity-form-card">
              <div class="form-card-header">
                <div>
                  <p class="form-card-eyebrow">Условия</p>
                  <h3>Сроки и контакты</h3>
                </div>
                <span class="form-card-note">Общие поля, которые есть у всех типов возможностей</span>
              </div>
              <div class="editor-grid">
                <label class="field">
                  <span>Дедлайн подачи заявки</span>
                  <input v-model="opportunityForm.applicationDeadline" type="datetime-local" />
                </label>
                <label class="field">
                  <span>Срок действия публикации</span>
                  <input v-model="opportunityForm.expiresAt" type="datetime-local" />
                </label>
                <label class="field field-wide">
                  <span>Контакты работодателя</span>
                  <textarea
                    v-model="opportunityForm.contactsInfo"
                    rows="4"
                    placeholder="Email, Telegram, телефон или краткая инструкция по связи"
                  />
                </label>
                <label class="field field-wide">
                  <span>Внешняя ссылка</span>
                  <input
                    v-model="opportunityForm.externalUrl"
                    type="url"
                    placeholder="Ссылка на лендинг, форму отклика или страницу компании"
                  />
                </label>
              </div>
            </section>

            <section class="opportunity-form-card">
              <div class="form-card-header">
                <div>
                  <p class="form-card-eyebrow">По типу</p>
                  <h3>Поля для {{ typeOptions.find((item) => item.value === opportunityForm.opportunityType)?.label }}</h3>
                </div>
                <span class="form-card-note">{{ currentOpportunityTypeConfig.note }}</span>
              </div>
              <div class="editor-grid">
                <template v-if="currentOpportunityTypeConfig.showVacancyFields">
                  <label class="field">
                    <span>Уровень вакансии</span>
                    <select v-model="opportunityForm.vacancyLevel">
                      <option value="intern">Intern</option>
                      <option value="junior">Junior</option>
                      <option value="middle">Middle</option>
                      <option value="senior">Senior</option>
                    </select>
                  </label>
                  <label class="field">
                    <span>Тип занятости</span>
                    <select v-model="opportunityForm.employmentType">
                      <option v-for="option in employmentOptions" :key="option.value" :value="option.value">
                        {{ option.label }}
                      </option>
                    </select>
                  </label>
                </template>

                <template v-if="currentOpportunityTypeConfig.showSalaryFields">
                  <label class="field">
                    <span>Зарплата от</span>
                    <input v-model="opportunityForm.salaryMin" type="number" min="0" />
                  </label>
                  <label class="field">
                    <span>Зарплата до</span>
                    <input v-model="opportunityForm.salaryMax" type="number" min="0" />
                  </label>
                  <label class="field">
                    <span>Валюта</span>
                    <select v-model="opportunityForm.salaryCurrency">
                      <option value="RUB">RUB</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </label>
                  <label class="field checkbox-field">
                    <span>Показывать зарплату</span>
                    <input v-model="opportunityForm.isSalaryVisible" type="checkbox" />
                  </label>
                </template>

                <template v-if="currentOpportunityTypeConfig.showEventFields">
                  <label class="field">
                    <span>Начало мероприятия</span>
                    <input v-model="opportunityForm.eventStartAt" type="datetime-local" />
                  </label>
                  <label class="field">
                    <span>Завершение мероприятия</span>
                    <input v-model="opportunityForm.eventEndAt" type="datetime-local" />
                  </label>
                </template>
              </div>
            </section>

            <section class="opportunity-form-card">
              <div class="form-card-header">
                <div>
                  <p class="form-card-eyebrow">Теги</p>
                  <h3>Категории и стек</h3>
                </div>
                <span class="form-card-note">Помогают фильтрации и поиску кандидатов</span>
              </div>
              <div class="editor-grid">
                <div class="field field-wide">
                  <span>Технологии</span>
                  <div class="checkbox-grid">
                    <label v-for="tag in technologyTags" :key="tag.id" class="checkbox-item">
                      <input v-model="opportunityForm.selectedTechnologyTagIds" type="checkbox" :value="tag.id" />
                      <span>{{ tag.name }}</span>
                    </label>
                  </div>
                </div>
              </div>
            </section>

            <div class="opportunity-actions">
              <button class="primary-button" type="submit" :disabled="isSubmittingOpportunity">
                {{ isSubmittingOpportunity ? 'Создаем...' : 'Создать возможность' }}
              </button>
            </div>
          </form>

          <aside class="preview-card">
            <div class="preview-header">
              <div>
                <p class="eyebrow">Предпросмотр</p>
                <h3>{{ opportunityForm.title || 'Название будущей карточки' }}</h3>
                <p class="hero-copy">
                  {{ opportunityForm.companyName || 'Компания появится после заполнения профиля' }}
                </p>
              </div>
              <div class="preview-badges">
                <span class="tag-pill">{{ typeOptions.find((item) => item.value === opportunityForm.opportunityType)?.label }}</span>
                <span class="tag-pill soft">{{ formatOptions.find((item) => item.value === opportunityForm.workFormat)?.label }}</span>
              </div>
            </div>

            <div class="preview-grid">
              <div>
                <strong>Описание</strong>
                <p>{{ opportunityForm.shortDescription || 'Краткое описание пока не заполнено.' }}</p>
              </div>
              <div>
                <strong>Полное описание</strong>
                <p>{{ opportunityForm.fullDescription || 'Полное описание пока не заполнено.' }}</p>
              </div>
              <div>
                <strong>Место</strong>
                <p>{{ selectedLocationLabel || 'Локация не указана.' }}</p>
              </div>
              <div>
                <strong>Даты</strong>
                <p>{{ [opportunityForm.applicationDeadline && `Подача до: ${opportunityForm.applicationDeadline}`, opportunityForm.expiresAt && `Публикация до: ${opportunityForm.expiresAt}`, currentOpportunityTypeConfig.showEventFields && opportunityForm.eventStartAt && `Старт: ${opportunityForm.eventStartAt}`, currentOpportunityTypeConfig.showEventFields && opportunityForm.eventEndAt && `Финиш: ${opportunityForm.eventEndAt}`].filter(Boolean).join(' • ') || 'Даты пока не заполнены.' }}</p>
              </div>
              <div>
                <strong>Контакты и ссылка</strong>
                <p>{{ [opportunityForm.contactsInfo, opportunityForm.externalUrl].filter(Boolean).join(' • ') || 'Контакты и ссылка пока не указаны.' }}</p>
              </div>
              <div v-if="currentOpportunityTypeConfig.showSalaryFields">
                <strong>Зарплата</strong>
                <p>{{ [opportunityForm.salaryMin && `от ${opportunityForm.salaryMin}`, opportunityForm.salaryMax && `до ${opportunityForm.salaryMax}`, opportunityForm.salaryCurrency, opportunityForm.isSalaryVisible ? 'видна' : 'скрыта'].filter(Boolean).join(' • ') || 'Зарплата пока не указана.' }}</p>
              </div>
              <div>
                <strong>Теги</strong>
                <p>{{ previewTagGroups.join(', ') || 'Выберите технологии и параметры возможности.' }}</p>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section v-else class="dashboard-section">
        <div class="section-heading-copy">
          <p class="eyebrow">Opportunity Studio</p>
          <h2>Новая возможность</h2>
          <p class="hero-copy">
            Создание возможностей станет доступно после подтверждения компании куратором.
          </p>
        </div>
        <div class="locked-state">
          <strong>Публикация пока заблокирована</strong>
          <p>
            Сначала заполните профиль компании и отправьте заявку на верификацию. После статуса
            `verified` откроется форма создания вакансий, стажировок, менторских программ и событий.
          </p>
        </div>
      </section>

      <section class="dashboard-section">
        <h2>Активные, закрытые и запланированные возможности</h2>
        <p v-if="!employerOpportunities.length" class="hero-copy">
          У компании пока нет опубликованных карточек или API вернул пустой список.
        </p>
        <div class="card-list">
          <OpportunityCard
            v-for="opportunity in employerOpportunities"
            :key="opportunity.id"
            :opportunity="opportunity"
            compact
          />
        </div>
      </section>
    </section>
  </main>
</template>

<style scoped>
.dashboard,
.dashboard-grid,
.dashboard-section,
.card-list,
.candidate-list {
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
  padding: 24px;
  border: 1px solid rgba(18, 38, 63, 0.08);
  border-radius: 24px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(246, 248, 251, 0.94));
  box-shadow: 0 22px 52px rgba(15, 23, 42, 0.06);
}

.dashboard-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 20px;
  background:
    radial-gradient(circle at top left, rgba(27, 84, 255, 0.08), transparent 32%),
    linear-gradient(180deg, #ffffff, #f5f8fc);
}

.dashboard-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.dashboard-grid.single-column {
  grid-template-columns: 1fr;
}

.hero-copy-block {
  display: grid;
  gap: 14px;
  align-content: start;
}

.hero-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.metric-chip {
  min-width: 180px;
  padding: 14px 16px;
  border: 1px solid rgba(18, 38, 63, 0.08);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.84);
  backdrop-filter: blur(10px);
}

.metric-chip span {
  display: block;
  margin-bottom: 4px;
  color: var(--muted);
  font-size: 0.75rem;
  text-transform: uppercase;
}

.metric-chip strong {
  font-size: 0.98rem;
}

.section-heading {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 16px;
}

.section-heading-copy {
  display: grid;
  gap: 8px;
  max-width: 52ch;
}

.opportunity-heading {
  align-items: end;
  padding-bottom: 4px;
}

.opportunity-highlights {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  max-width: 520px;
}

.highlight-pill {
  flex: 1 1 220px;
  display: grid;
  gap: 6px;
  padding: 16px 18px;
  border: 1px solid rgba(18, 38, 63, 0.08);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.72);
}

.highlight-pill strong {
  font-size: 0.92rem;
}

.highlight-pill span {
  color: #627087;
  font-size: 0.86rem;
  line-height: 1.5;
}

.hint-card {
  max-width: 360px;
  padding: 16px 18px;
  border: 1px solid rgba(18, 38, 63, 0.08);
  border-radius: 18px;
  background: rgba(250, 251, 253, 0.92);
}

.hint-card p {
  margin: 8px 0 0;
  color: var(--muted);
  font-size: 0.88rem;
  line-height: 1.5;
}

.eyebrow {
  margin: 0;
  color: #2952cc;
  font: 700 0.72rem/1 var(--font-mono);
  text-transform: uppercase;
}

h1,
h2,
h3 {
  margin: 0;
  font-family: var(--font-heading);
}

h1 {
  font-size: clamp(1.9rem, 4vw, 3rem);
  line-height: 1;
}

.hero-copy,
.section-card p,
.verification-card p,
.preview-card p {
  margin: 0;
  color: #5c6778;
  line-height: 1.6;
  font-size: 0.95rem;
}

.section-title {
  display: grid;
  gap: 6px;
  margin-bottom: 16px;
}

.section-title p {
  max-width: 42ch;
}

.status-banner {
  margin: 0;
  padding: 14px 16px;
  border: 1px solid rgba(18, 38, 63, 0.08);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.92);
  font-size: 0.9rem;
}

.status-banner.error,
.upload-error {
  color: var(--danger);
}

.verification-card,
.editor-grid,
.preview-card,
.locked-state {
  display: grid;
  gap: 12px;
  padding: 18px;
  border: 1px solid rgba(18, 38, 63, 0.08);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(10px);
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
  width: 104px;
  height: 104px;
  box-shadow: inset 0 0 0 1px rgba(18, 38, 63, 0.05);
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
  color: #2952cc;
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
}

.avatar-upload input {
  display: none;
}

.editor-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.opportunity-editor {
  display: grid;
  gap: 18px;
}

.opportunity-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(300px, 0.72fr);
  gap: 20px;
  align-items: start;
}

.opportunity-form-card {
  display: grid;
  gap: 16px;
  padding: 20px;
  border: 1px solid rgba(18, 38, 63, 0.08);
  border-radius: 22px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(247, 249, 252, 0.92));
  box-shadow: 0 16px 36px rgba(15, 23, 42, 0.05);
}

.form-card-header {
  display: flex;
  flex-wrap: wrap;
  align-items: start;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 14px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.16);
}

.form-card-header h3 {
  font-size: 1.05rem;
}

.form-card-eyebrow {
  margin: 0 0 6px;
  color: #2952cc;
  font: 700 0.72rem/1 var(--font-mono);
  text-transform: uppercase;
}

.form-card-note {
  max-width: 28ch;
  color: #627087;
  font-size: 0.84rem;
  line-height: 1.5;
}

.opportunity-actions {
  display: flex;
  justify-content: flex-start;
  padding-top: 6px;
}

.field {
  display: grid;
  gap: 8px;
}

.field > span {
  color: #334155;
  font-size: 0.82rem;
  font-weight: 600;
}

.checkbox-field {
  align-content: end;
}

.checkbox-field input {
  width: 18px;
  height: 18px;
  margin: 0;
  min-height: auto;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.field-hint {
  color: #627087;
  font-size: 0.8rem;
  line-height: 1.45;
}

.field input,
.field select,
.field textarea,
.list-editor-row input,
.custom-tag-editor input,
.custom-tag-editor select {
  min-height: 44px;
  padding: 11px 13px;
  border: 1px solid rgba(148, 163, 184, 0.3);
  border-radius: 14px;
  font: inherit;
  font-size: 0.9rem;
  background: rgba(255, 255, 255, 0.96);
  transition:
    border-color 140ms ease,
    box-shadow 140ms ease,
    transform 140ms ease;
}

.field input:focus,
.field select:focus,
.field textarea:focus,
.list-editor-row input:focus,
.custom-tag-editor input:focus,
.custom-tag-editor select:focus {
  outline: none;
  border-color: rgba(41, 82, 204, 0.45);
  box-shadow: 0 0 0 4px rgba(41, 82, 204, 0.08);
}

.field-wide {
  grid-column: 1 / -1;
}

.checkbox-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.checkbox-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  border: 1px solid rgba(148, 163, 184, 0.28);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.88);
  font-size: 0.85rem;
}

.list-editor {
  display: grid;
  gap: 10px;
}

.list-editor-row,
.custom-tag-editor {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
}

.custom-tag-editor {
  grid-template-columns: 180px minmax(0, 1fr) auto;
}

.primary-button,
.ghost-button {
  min-height: 42px;
  padding: 0 16px;
  border-radius: 999px;
  font-size: 0.9rem;
  transition:
    transform 140ms ease,
    box-shadow 140ms ease,
    border-color 140ms ease,
    background 140ms ease;
}

.primary-button {
  border: 1px solid #2447b9;
  color: #fff;
  background: linear-gradient(135deg, #2952cc, #17338f);
  box-shadow: 0 14px 28px rgba(41, 82, 204, 0.22);
}

.ghost-button {
  border: 1px solid rgba(148, 163, 184, 0.26);
  color: #2952cc;
  background: rgba(255, 255, 255, 0.94);
}

.primary-button:hover,
.ghost-button:hover {
  transform: translateY(-1px);
}

.ghost-button:hover {
  border-color: rgba(41, 82, 204, 0.28);
}

.align-start {
  justify-self: start;
}

.primary-button:disabled {
  opacity: 0.65;
  cursor: progress;
}

.preview-card {
  position: sticky;
  top: 20px;
  background:
    radial-gradient(circle at top right, rgba(41, 82, 204, 0.08), transparent 28%),
    rgba(255, 255, 255, 0.82);
}

.locked-state p {
  margin: 0;
  color: #627087;
  line-height: 1.6;
}

.preview-header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 12px;
}

.preview-badges,
.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.preview-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.preview-grid div {
  padding: 14px 15px;
  border: 1px solid rgba(18, 38, 63, 0.08);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.92);
}

.preview-grid strong {
  display: block;
  margin-bottom: 6px;
}

.tag-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;
  padding: 0 12px;
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
  font-size: 0.82rem;
}

.tag-pill.soft {
  color: #667085;
}

.tag-pill button {
  border: 0;
  padding: 0;
  color: inherit;
  background: transparent;
  cursor: pointer;
}

@media (max-width: 900px) {
  .dashboard-hero,
  .dashboard-grid,
  .opportunity-layout,
  .editor-grid,
  .preview-grid,
  .list-editor-row,
  .custom-tag-editor {
    grid-template-columns: 1fr;
  }

  .dashboard-hero,
  .section-card,
  .dashboard-section {
    padding: 18px;
    border-radius: 20px;
  }

  .opportunity-form-card {
    padding: 18px;
    border-radius: 18px;
  }

  .preview-card {
    position: static;
    top: auto;
  }

  h1 {
    font-size: 1.8rem;
  }
}
</style>
