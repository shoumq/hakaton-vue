<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import type { Opportunity, OpportunityType, WorkFormat } from '@/entities/opportunity/model/types'
import OpportunityCard from '@/entities/opportunity/ui/OpportunityCard.vue'
import { useSession } from '@/features/session/model/session'
import MapLibreOpportunityMap from '@/shared/ui/MapLibreOpportunityMap.vue'
import {
  createRecommendation,
  createMyChat,
  createEmployerOpportunity,
  fetchEmployerCompany,
  fetchEmployerOpportunityApplications,
  fetchEmployerOpportunities,
  fetchPublicCatalog,
  getApiErrorMessage,
  submitEmployerVerification,
  updateEmployerApplicationStatus,
} from '@/shared/api'
import type {
  BackendTag,
  BackendLocation,
  EmployerApplicationDto,
  EmployerApplicationStatus,
  EmployerCompanyDto,
  OpportunityCreateInput,
  VerificationInput,
} from '@/shared/api'
import { formatDate } from '@/shared/lib/formatters'
import { saveStudentProfilePreview } from '@/shared/lib/profile-preview'
import { showErrorToast, showSuccessToast } from '@/shared/lib/toast'

interface OpportunityFormState {
  title: string
  shortDescription: string
  fullDescription: string
  companyName: string
  opportunityType: OpportunityType
  workFormat: WorkFormat
  locationMode: 'catalog' | 'custom'
  locationId: string
  locationAddress: string
  locationDisplayText: string
  locationLatitude: string
  locationLongitude: string
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
const router = useRouter()
const employerOpportunities = ref<Opportunity[]>([])
const company = ref<EmployerCompanyDto | null>(null)
const employerProfile = ref<Record<string, unknown> | null>(null)
const locations = ref<BackendLocation[]>([])
const tags = ref<BackendTag[]>([])
const isLoading = ref(true)
const isSubmittingVerification = ref(false)
const isSubmittingOpportunity = ref(false)
const isApplicationsLoading = ref(false)
const selectedOpportunityId = ref('')
const selectedOpportunityTitle = ref('')
const opportunityApplications = ref<EmployerApplicationDto[]>([])
const activeApplicationFilter = ref<'all' | EmployerApplicationStatus>('all')
const updatingApplicationId = ref('')
const inviteTargetApplicationId = ref('')
const openingChatApplicationId = ref('')
const isSendingInvitation = ref(false)
const applicationsError = ref('')
const invitationError = ref('')
const errorMessage = ref('')
const infoMessage = ref('')

const verificationForm = reactive({
  inn: '',
  comment: '',
})

const inviteForm = reactive({
  toUserId: '',
  opportunityId: '',
  message: '',
})

const opportunityForm = reactive<OpportunityFormState>({
  title: '',
  shortDescription: '',
  fullDescription: '',
  companyName: '',
  opportunityType: 'internship',
  workFormat: 'remote',
  locationMode: 'catalog',
  locationId: '',
  locationAddress: '',
  locationDisplayText: '',
  locationLatitude: '55.751244',
  locationLongitude: '37.618423',
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

const locationModeOptions = [
  { value: 'catalog', label: 'Из каталога' },
  { value: 'custom', label: 'Своя точка' },
] as const

const employmentOptions = [
  { value: 'full_time', label: 'Полная занятость' },
  { value: 'part_time', label: 'Частичная занятость' },
  { value: 'project', label: 'Проектная работа' },
]

const statusOptions = [
  { value: 'draft', label: 'Черновик' },
  { value: 'published', label: 'Опубликовать' },
]

const applicationStatusOptions: Array<{ value: EmployerApplicationStatus; label: string }> = [
  { value: 'submitted', label: 'Новые' },
  { value: 'in_review', label: 'В работе' },
  { value: 'accepted', label: 'Приняты' },
  { value: 'rejected', label: 'Отклонены' },
  { value: 'reserve', label: 'Резерв' },
  { value: 'withdrawn', label: 'Отозваны' },
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
const selectedCatalogLocation = computed(
  () => locations.value.find((location) => location.id === opportunityForm.locationId) || null,
)
const parsedLocationLatitude = computed(() => Number(opportunityForm.locationLatitude))
const parsedLocationLongitude = computed(() => Number(opportunityForm.locationLongitude))
const previewLocationLabel = computed(() => {
  if (opportunityForm.locationMode === 'custom') {
    return opportunityForm.locationDisplayText.trim() || opportunityForm.locationAddress.trim()
  }

  return selectedCatalogLocation.value?.display_text || ''
})
const previewLocationAddress = computed(() => {
  if (opportunityForm.locationMode === 'custom') {
    return opportunityForm.locationAddress.trim()
  }

  return selectedCatalogLocation.value?.address_line || ''
})
const previewLocationLatitude = computed(() => {
  if (opportunityForm.locationMode === 'custom') {
    return Number.isFinite(parsedLocationLatitude.value) ? parsedLocationLatitude.value : 55.751244
  }

  return selectedCatalogLocation.value?.latitude ?? 55.751244
})
const previewLocationLongitude = computed(() => {
  if (opportunityForm.locationMode === 'custom') {
    return Number.isFinite(parsedLocationLongitude.value) ? parsedLocationLongitude.value : 37.618423
  }

  return selectedCatalogLocation.value?.longitude ?? 37.618423
})
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
const filteredApplications = computed(() => {
  if (activeApplicationFilter.value === 'all') {
    return opportunityApplications.value
  }

  return opportunityApplications.value.filter((item) => item.status === activeApplicationFilter.value)
})
const applicationFilterChips = computed(() => [
  { value: 'all' as const, label: 'Все', count: opportunityApplications.value.length },
  ...applicationStatusOptions.map((option) => ({
    value: option.value,
    label: option.label,
    count: opportunityApplications.value.filter((item) => item.status === option.value).length,
  })),
])

const companyHighlights = computed(() => [
  { label: 'Юридическое название', value: company.value?.legal_name || 'Не заполнено' },
  { label: 'Бренд', value: company.value?.brand_name || 'Не заполнено' },
  { label: 'Сайт', value: company.value?.website_url || 'Не заполнено' },
  { label: 'Индустрия', value: company.value?.industry || 'Не заполнено' },
  { label: 'Год основания', value: company.value?.founded_year ? String(company.value.founded_year) : 'Не заполнено' },
  { label: 'ИНН', value: company.value?.inn || 'Не заполнено' },
])

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
  opportunityForm.locationMode = locations.value.length ? 'catalog' : 'custom'
  opportunityForm.locationId = locations.value[0]?.id ?? ''
  opportunityForm.locationAddress = ''
  opportunityForm.locationDisplayText = ''
  opportunityForm.locationLatitude = locations.value[0]?.latitude ? String(locations.value[0].latitude) : '55.751244'
  opportunityForm.locationLongitude = locations.value[0]?.longitude ? String(locations.value[0].longitude) : '37.618423'
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

function syncLocationFromCatalog(location: BackendLocation | null) {
  if (!location || opportunityForm.locationMode !== 'catalog') {
    return
  }

  opportunityForm.locationLatitude =
    typeof location.latitude === 'number' ? String(location.latitude) : '55.751244'
  opportunityForm.locationLongitude =
    typeof location.longitude === 'number' ? String(location.longitude) : '37.618423'
}

function handleLocationSelect(payload: { latitude: number; longitude: number }) {
  opportunityForm.locationLatitude = payload.latitude.toFixed(6)
  opportunityForm.locationLongitude = payload.longitude.toFixed(6)
}

function validateCustomLocation() {
  const address = opportunityForm.locationAddress.trim()
  const latitude = Number(opportunityForm.locationLatitude)
  const longitude = Number(opportunityForm.locationLongitude)

  if (!address) {
    throw new Error('Для своей точки укажите адрес.')
  }

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new Error('Широта должна быть числом от -90 до 90.')
  }

  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error('Долгота должна быть числом от -180 до 180.')
  }

  return {
    address_line: address,
    latitude,
    longitude,
    display_text: opportunityForm.locationDisplayText.trim() || address,
  }
}

function getApplicationStatusLabel(status?: EmployerApplicationStatus) {
  return applicationStatusOptions.find((item) => item.value === status)?.label || status || 'Новые'
}

function getApplicationAvatar(application: EmployerApplicationDto) {
  return application.student_avatar_url || application.avatar_url || ''
}

function getApplicationInitials(application: EmployerApplicationDto) {
  const source = application.student_display_name || application.student_user_id || 'U'

  return source
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

async function loadApplications(opportunityId: string) {
  isApplicationsLoading.value = true
  applicationsError.value = ''

  try {
    opportunityApplications.value = await fetchEmployerOpportunityApplications(opportunityId)
  } catch (error) {
    applicationsError.value = getApiErrorMessage(error, 'Не удалось загрузить отклики.')
    opportunityApplications.value = []
  } finally {
    isApplicationsLoading.value = false
  }
}

async function openApplications(opportunity: Opportunity) {
  selectedOpportunityId.value = opportunity.id
  selectedOpportunityTitle.value = opportunity.title
  activeApplicationFilter.value = 'all'
  inviteTargetApplicationId.value = ''
  invitationError.value = ''
  inviteForm.toUserId = ''
  inviteForm.opportunityId = opportunity.id
  inviteForm.message = ''
  await loadApplications(opportunity.id)
}

function closeApplications() {
  selectedOpportunityId.value = ''
  selectedOpportunityTitle.value = ''
  opportunityApplications.value = []
  activeApplicationFilter.value = 'all'
  closeInviteForm()
}

function openInviteForm(application: EmployerApplicationDto) {
  inviteTargetApplicationId.value = application.id
  inviteForm.toUserId = application.student_user_id || ''
  inviteForm.opportunityId = selectedOpportunityId.value
  inviteForm.message = `Приглашаем вас рассмотреть нашу возможность «${selectedOpportunityTitle.value}».`
  invitationError.value = ''
}

function closeInviteForm() {
  inviteTargetApplicationId.value = ''
  invitationError.value = ''
  inviteForm.toUserId = ''
  inviteForm.message = ''
}

function saveApplicantPreview(application: EmployerApplicationDto) {
  if (!application.student_user_id) {
    return
  }

  saveStudentProfilePreview({
    id: application.student_user_id,
    displayName: application.student_display_name || application.student_user_id,
    avatarUrl: getApplicationAvatar(application),
    headline: application.resume_id ? `Резюме: ${application.resume_id}` : 'Соискатель',
    resumeId: application.resume_id,
    coverLetter: application.cover_letter,
    updatedAt: application.updated_at || application.created_at,
    sourceOpportunityTitle: selectedOpportunityTitle.value,
  })
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
  const customLocation = opportunityForm.locationMode === 'custom' ? validateCustomLocation() : undefined

  if (opportunityForm.locationMode === 'catalog' && !opportunityForm.locationId) {
    throw new Error('Выберите локацию из каталога или переключитесь на свою точку.')
  }

  const sharedPayload = {
    title: opportunityForm.title.trim(),
    short_description: opportunityForm.shortDescription.trim(),
    full_description: opportunityForm.fullDescription.trim(),
    opportunity_type: opportunityForm.opportunityType,
    work_format: opportunityForm.workFormat,
    location_id: opportunityForm.locationMode === 'catalog' ? opportunityForm.locationId : undefined,
    location_input: customLocation,
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

  verificationForm.inn = companyData.inn ?? ''

  resetOpportunityForm()
}

async function handleSubmitVerification() {
  isSubmittingVerification.value = true
  errorMessage.value = ''
  infoMessage.value = ''

  try {
    await submitEmployerVerification(buildVerificationPayload())
    infoMessage.value = 'Заявка на верификацию отправлена.'
    showSuccessToast(infoMessage.value)
    await loadDashboard()
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, 'Не удалось отправить верификацию.')
    showErrorToast(errorMessage.value)
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
    showSuccessToast(infoMessage.value)
    resetOpportunityForm()
    employerOpportunities.value = await fetchEmployerOpportunities()
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, 'Не удалось создать возможность.')
    showErrorToast(errorMessage.value)
  } finally {
    isSubmittingOpportunity.value = false
  }
}

async function handleApplicationStatusChange(
  application: EmployerApplicationDto,
  status: EmployerApplicationStatus,
) {
  updatingApplicationId.value = application.id
  applicationsError.value = ''
  infoMessage.value = ''
  const previousStatus = application.status
  application.status = status

  try {
    const updated = await updateEmployerApplicationStatus(application.id, { status })
    const target = opportunityApplications.value.find((item) => item.id === application.id)

    if (target) {
      Object.assign(target, updated)
    }

    infoMessage.value = `Статус отклика изменен на «${getApplicationStatusLabel(status)}».`
  } catch (error) {
    application.status = previousStatus
    applicationsError.value = getApiErrorMessage(error, 'Не удалось изменить статус отклика.')
  } finally {
    updatingApplicationId.value = ''
  }
}

async function handleSendInvitation() {
  invitationError.value = ''

  if (!inviteForm.toUserId.trim()) {
    invitationError.value = 'Для приглашения нужен идентификатор пользователя.'
    return
  }

  if (!inviteForm.opportunityId.trim()) {
    invitationError.value = 'Не выбрана возможность для приглашения.'
    return
  }

  isSendingInvitation.value = true

  try {
    await createRecommendation({
      to_user_id: inviteForm.toUserId.trim(),
      opportunity_id: inviteForm.opportunityId.trim(),
      message: inviteForm.message.trim() || undefined,
    })
    infoMessage.value = 'Приглашение отправлено.'
    closeInviteForm()
  } catch (error) {
    invitationError.value = getApiErrorMessage(error, 'Не удалось отправить приглашение.')
  } finally {
    isSendingInvitation.value = false
  }
}

async function handleOpenApplicantChat(application: EmployerApplicationDto) {
  if (!application.student_user_id) {
    applicationsError.value = 'Невозможно открыть чат: у отклика нет student_user_id.'
    return
  }

  openingChatApplicationId.value = application.id
  applicationsError.value = ''

  try {
    const chat = await createMyChat({
      participant_user_id: application.student_user_id,
      opportunity_id: selectedOpportunityId.value || undefined,
    })

    await router.push(`/chats/${chat.id}`)
  } catch (error) {
    applicationsError.value = getApiErrorMessage(error, 'Не удалось открыть чат с соискателем.')
  } finally {
    openingChatApplicationId.value = ''
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

watch(
  () => selectedCatalogLocation.value,
  (location) => {
    syncLocationFromCatalog(location)
  },
  { immediate: true },
)

watch(
  () => opportunityForm.locationMode,
  (mode) => {
    if (mode === 'catalog') {
      syncLocationFromCatalog(selectedCatalogLocation.value)
    }
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
              v-if="company?.avatar_url"
              :src="company.avatar_url"
              alt="Аватар компании"
              class="avatar-image"
            />
            <span v-else class="avatar-fallback">{{ avatarFallback }}</span>
          </div>
          <strong>Статус: {{ companyStatusLabel }}</strong>
          <div class="hero-side-actions">
            <RouterLink to="/profile" class="ghost-button">Редактировать профиль</RouterLink>
            <RouterLink to="/notifications" class="ghost-button">Уведомления</RouterLink>
          </div>
        </div>
      </div>

      <p v-if="errorMessage" class="status-banner error">{{ errorMessage }}</p>
      <p v-else-if="infoMessage" class="status-banner">{{ infoMessage }}</p>
      <p v-else-if="isLoading" class="status-banner">Загружаем кабинет работодателя...</p>

      <section class="dashboard-grid" :class="{ 'single-column': !canShowVerificationSection }">
        <article class="section-card">
          <div class="section-title">
            <h2>Профиль компании</h2>
            <p>Редактирование компании вынесено на отдельную страницу, чтобы кабинет оставался короче и чище.</p>
          </div>
          <div class="editor-grid profile-summary-grid">
            <div v-for="item in companyHighlights" :key="item.label" class="summary-card">
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
            </div>
          </div>
          <div class="summary-actions">
            <RouterLink to="/profile" class="primary-button">Открыть страницу профиля</RouterLink>
          </div>
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
        </div>

        <div class="opportunity-layout">
          <form class="opportunity-editor" @submit.prevent="handleCreateOpportunity">
            <section class="opportunity-form-card">
              <div class="form-card-header">
                <div>
                  <p class="form-card-eyebrow">Основа</p>
                  <h3>Главная информация</h3>
                </div>
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
                  <span>Способ указания локации</span>
                  <select v-model="opportunityForm.locationMode">
                    <option v-for="option in locationModeOptions" :key="option.value" :value="option.value">
                      {{ option.label }}
                    </option>
                  </select>
                </label>
                <label v-if="opportunityForm.locationMode === 'catalog'" class="field">
                  <span>Локация из каталога</span>
                  <select v-model="opportunityForm.locationId">
                    <option v-for="location in locations" :key="location.id" :value="location.id">
                      {{ location.display_text || location.id }}
                    </option>
                  </select>
                  <small v-if="!locations.length" class="field-hint">
                    Каталог локаций пуст. Переключитесь на режим "Своя точка".
                  </small>
                </label>
                <label v-else class="field">
                  <span>Адрес</span>
                  <input
                    v-model="opportunityForm.locationAddress"
                    type="text"
                    placeholder="Город, улица, дом или ориентир"
                    required
                  />
                </label>
                <label v-if="opportunityForm.locationMode === 'custom'" class="field field-wide">
                  <span>Подпись точки</span>
                  <input
                    v-model="opportunityForm.locationDisplayText"
                    type="text"
                    placeholder="Например: Москва, офис компании"
                  />
                </label>
                <label v-if="opportunityForm.locationMode === 'custom'" class="field">
                  <span>Широта</span>
                  <input v-model="opportunityForm.locationLatitude" type="number" min="-90" max="90" step="0.000001" required />
                </label>
                <label v-if="opportunityForm.locationMode === 'custom'" class="field">
                  <span>Долгота</span>
                  <input
                    v-model="opportunityForm.locationLongitude"
                    type="number"
                    min="-180"
                    max="180"
                    step="0.000001"
                    required
                  />
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
                <div class="field field-wide map-picker-field">
                  <span>Точка на карте</span>
                  <MapLibreOpportunityMap
                    :latitude="previewLocationLatitude"
                    :longitude="previewLocationLongitude"
                    :label="previewLocationLabel || 'Точка локации'"
                    :selectable="opportunityForm.locationMode === 'custom'"
                    @select="handleLocationSelect"
                  />
                </div>
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
                <p>
                  {{
                    [previewLocationLabel, previewLocationAddress, `Координаты: ${previewLocationLatitude}, ${previewLocationLongitude}`]
                      .filter(Boolean)
                      .join(' • ') || 'Локация не указана.'
                  }}
                </p>
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
        <div class="section-heading">
          <div class="section-heading-copy">
            <h2>Активные, закрытые и запланированные возможности</h2>
            <p class="hero-copy">Открывайте отклики по каждой карточке, меняйте статусы и отправляйте приглашения кандидатам.</p>
          </div>
        </div>
        <p v-if="!employerOpportunities.length" class="hero-copy">
          У компании пока нет опубликованных карточек или API вернул пустой список.
        </p>
        <div class="managed-opportunity-list">
          <article
            v-for="opportunity in employerOpportunities"
            :key="opportunity.id"
            class="managed-opportunity-card"
          >
            <OpportunityCard :opportunity="opportunity" compact />
            <div class="managed-opportunity-actions">
              <button class="ghost-button" type="button" @click="openApplications(opportunity)">
                {{ selectedOpportunityId === opportunity.id ? 'Обновить отклики' : 'Отклики' }}
              </button>
              <span class="managed-opportunity-meta">{{ opportunity.type }} • {{ opportunity.status }}</span>
            </div>
          </article>
        </div>

        <article v-if="selectedOpportunityId" class="applications-panel">
          <div class="applications-panel-head">
            <div>
              <p class="eyebrow">Applications</p>
              <h3>{{ selectedOpportunityTitle }}</h3>
              <p class="hero-copy">Просмотр откликов и приглашений по выбранной возможности.</p>
            </div>
            <button class="ghost-button" type="button" @click="closeApplications">Скрыть</button>
          </div>

          <div class="filter-row">
            <button
              v-for="chip in applicationFilterChips"
              :key="chip.value"
              type="button"
              class="filter-chip"
              :class="{ active: activeApplicationFilter === chip.value }"
              @click="activeApplicationFilter = chip.value"
            >
              {{ chip.label }} · {{ chip.count }}
            </button>
          </div>

          <p v-if="applicationsError" class="status-banner error">{{ applicationsError }}</p>
          <p v-else-if="isApplicationsLoading" class="status-banner">Загружаем отклики...</p>
          <p v-else-if="!filteredApplications.length" class="status-banner">Для этого фильтра откликов нет.</p>

          <div v-else class="applications-list">
            <article
              v-for="application in filteredApplications"
              :key="application.id"
              class="application-card"
            >
              <div class="application-head">
                <div class="application-user">
                  <div class="application-avatar">
                    <img
                      v-if="getApplicationAvatar(application)"
                      :src="getApplicationAvatar(application)"
                      alt="Аватар студента"
                      class="avatar-image"
                    />
                    <span v-else class="avatar-fallback">{{ getApplicationInitials(application) }}</span>
                  </div>
                  <div class="application-copy">
                    <strong>{{ application.student_user_id || 'student_user_id не указан' }}</strong>
                    <span>{{ application.resume_id ? `Резюме: ${application.resume_id}` : 'Резюме не приложено' }}</span>
                  </div>
                </div>
                <span class="application-status" :class="`status-${application.status || 'submitted'}`">
                  {{ getApplicationStatusLabel(application.status) }}
                </span>
              </div>

              <div class="application-grid">
                <div class="application-detail">
                  <span>Сопроводительное письмо</span>
                  <p>{{ application.cover_letter || 'Кандидат не добавил сопроводительное письмо.' }}</p>
                </div>
                <div class="application-detail">
                  <span>Создан</span>
                  <p>{{ application.created_at ? formatDate(application.created_at) : 'Дата не указана' }}</p>
                </div>
              </div>

              <div class="application-actions">
                <button
                  class="primary-button"
                  type="button"
                  :disabled="openingChatApplicationId === application.id || !application.student_user_id"
                  @click="handleOpenApplicantChat(application)"
                >
                  {{ openingChatApplicationId === application.id ? 'Открываем чат...' : 'Открыть чат' }}
                </button>
                <RouterLink
                  v-if="application.student_user_id"
                  :to="`/profiles/students/${application.student_user_id}`"
                  class="ghost-button"
                  @click="saveApplicantPreview(application)"
                >
                  Профиль кандидата
                </RouterLink>
                <button
                  class="ghost-button"
                  type="button"
                  :disabled="updatingApplicationId === application.id"
                  @click="handleApplicationStatusChange(application, 'in_review')"
                >
                  Взять в работу
                </button>
                <button
                  class="ghost-button"
                  type="button"
                  :disabled="updatingApplicationId === application.id"
                  @click="handleApplicationStatusChange(application, 'accepted')"
                >
                  Принять
                </button>
                <button
                  class="ghost-button"
                  type="button"
                  :disabled="updatingApplicationId === application.id"
                  @click="handleApplicationStatusChange(application, 'rejected')"
                >
                  Отклонить
                </button>
                <button
                  class="ghost-button"
                  type="button"
                  :disabled="updatingApplicationId === application.id"
                  @click="handleApplicationStatusChange(application, 'reserve')"
                >
                  В резерв
                </button>
                <button class="primary-button" type="button" @click="openInviteForm(application)">
                  Пригласить
                </button>
              </div>

              <form
                v-if="inviteTargetApplicationId === application.id"
                class="invite-form"
                @submit.prevent="handleSendInvitation"
              >
                <label class="field">
                  <span>ID пользователя</span>
                  <input v-model="inviteForm.toUserId" type="text" required />
                </label>
                <label class="field">
                  <span>ID возможности</span>
                  <input v-model="inviteForm.opportunityId" type="text" required />
                </label>
                <label class="field field-wide">
                  <span>Сообщение</span>
                  <textarea
                    v-model="inviteForm.message"
                    rows="3"
                    placeholder="Приглашаем вас рассмотреть нашу вакансию"
                  />
                </label>
                <p v-if="invitationError" class="inline-error">{{ invitationError }}</p>
                <div class="invite-actions">
                  <button class="primary-button" type="submit" :disabled="isSendingInvitation">
                    {{ isSendingInvitation ? 'Отправляем...' : 'Отправить приглашение' }}
                  </button>
                  <button class="ghost-button" type="button" @click="closeInviteForm">Отмена</button>
                </div>
              </form>
            </article>
          </div>
        </article>
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

.managed-opportunity-list,
.applications-list {
  display: grid;
  gap: 14px;
}

.managed-opportunity-card,
.applications-panel,
.application-card {
  display: grid;
  gap: 14px;
  padding: 16px;
  border: 1px solid rgba(18, 38, 63, 0.08);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.88);
}

.managed-opportunity-actions,
.applications-panel-head,
.application-head,
.application-actions,
.invite-actions,
.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
}

.managed-opportunity-meta {
  color: #627087;
  font-size: 0.84rem;
  text-transform: capitalize;
}

.filter-row {
  justify-content: flex-start;
}

.filter-chip {
  min-height: 34px;
  padding: 0 12px;
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 999px;
  background: #fff;
  color: #4c5b70;
  font: inherit;
  cursor: pointer;
}

.filter-chip.active {
  border-color: rgba(41, 82, 204, 0.3);
  background: rgba(41, 82, 204, 0.08);
  color: #17338f;
}

.application-user {
  display: flex;
  gap: 12px;
  align-items: center;
}

.application-avatar {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 50%;
  background: #eef3f8;
}

.application-copy {
  display: grid;
  gap: 4px;
}

.application-copy strong {
  color: #162033;
}

.application-copy span,
.application-detail span {
  color: #627087;
  font-size: 0.82rem;
}

.application-status {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  background: #eef3f8;
  color: #24456b;
  font-size: 0.8rem;
  font-weight: 600;
}

.application-status.status-submitted {
  background: #eef3f8;
  color: #24456b;
}

.application-status.status-in_review {
  background: #eef1ff;
  color: #1e3fa0;
}

.application-status.status-accepted {
  background: rgba(25, 135, 84, 0.12);
  color: #198754;
}

.application-status.status-rejected {
  background: rgba(196, 69, 54, 0.12);
  color: #c44536;
}

.application-status.status-reserve {
  background: rgba(197, 138, 28, 0.12);
  color: #c58a1c;
}

.application-status.status-withdrawn {
  background: rgba(95, 107, 122, 0.16);
  color: #5f6b7a;
}

.application-grid,
.invite-form {
  display: grid;
  gap: 12px;
}

.application-grid {
  grid-template-columns: minmax(0, 1.3fr) minmax(180px, 0.7fr);
}

.application-detail {
  display: grid;
  gap: 6px;
  padding: 12px 13px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 10px;
  background: rgba(248, 250, 253, 0.92);
}

.application-detail p {
  color: #162033;
}

.invite-form {
  padding-top: 4px;
  border-top: 1px solid rgba(148, 163, 184, 0.16);
}

.inline-error {
  margin: 0;
  color: var(--danger);
  font-size: 0.88rem;
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
  border-radius: 18px;
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

.hero-side-actions {
  display: grid;
  gap: 10px;
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
  border-radius: 14px;
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
  border-radius: 14px;
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
  border-radius: 14px;
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
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.92);
  font-size: 0.9rem;
}

.status-banner.error {
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
  border-radius: 16px;
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

.editor-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.profile-summary-grid {
  margin-top: 2px;
}

.summary-card {
  display: grid;
  gap: 6px;
  padding: 12px 14px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.92);
}

.summary-card span {
  color: #627087;
  font-size: 0.8rem;
}

.summary-card strong {
  color: #162033;
  font-size: 0.94rem;
  line-height: 1.35;
}

.summary-actions {
  display: flex;
  padding-top: 14px;
}

.hero-side-actions {
  display: grid;
  gap: 10px;
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
  border-radius: 16px;
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
  border-radius: 10px;
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

.map-picker-field {
  align-content: start;
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

.align-start {
  justify-self: start;
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
  .application-grid,
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
