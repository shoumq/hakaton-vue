<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import type { Opportunity, OpportunityType, WorkFormat } from '@/entities/opportunity/model/types'
import { useSession } from '@/features/session/model/session'
import MapLibreOpportunityMap from '@/shared/ui/MapLibreOpportunityMap.vue'
import {
  createRecommendation,
  createMyChat,
  createEmployerOpportunity,
  fetchEmployerCompany,
  fetchEmployerOpportunityApplications,
  fetchEmployerOpportunities,
  fetchOpportunityAnalytics,
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
  OpportunityAnalyticsDto,
  OpportunityCreateInput,
  VerificationInput,
} from '@/shared/api'
import { formatDate, formatOpportunityType, formatWorkFormat } from '@/shared/lib/formatters'
import { sanitizeHtml } from '@/shared/lib/sanitize'
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
const analysisOpportunityId = ref('')
const isLoadingAnalysis = ref(false)
const opportunityAnalysis = ref<OpportunityAnalyticsDto | null>(null)

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
  status: 'published',
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
  opportunityForm.status = 'published'
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

function getOpportunityStatusLabel(status?: string) {
  const map: Record<string, string> = { active: 'Активна', closed: 'Закрыта', planned: 'Скоро', draft: 'Черновик' }
  return map[status ?? ''] ?? status ?? ''
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

async function handleRequestAnalysis(opportunityId: string) {
  analysisOpportunityId.value = opportunityId
  isLoadingAnalysis.value = true
  opportunityAnalysis.value = null

  try {
    opportunityAnalysis.value = await fetchOpportunityAnalytics(opportunityId)
  } catch (error: unknown) {
    const status = (error as { response?: { status?: number } })?.response?.status
    if (status === 503) {
      showErrorToast('ИИ-аналитика пока не настроена')
    } else if (status === 502) {
      showErrorToast('Не удалось получить ответ от ИИ')
    } else if (status === 401) {
      showErrorToast('Необходима авторизация')
    } else {
      showErrorToast(getApiErrorMessage(error, 'Не удалось выполнить ИИ-анализ.'))
    }
  } finally {
    isLoadingAnalysis.value = false
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
    <div class="ed-root">

      <!-- Hero -->
      <header class="ed-hero">
        <div class="ed-cover"></div>
        <div class="ed-hero-body">
          <div class="ed-co-avatar">
            <img v-if="company?.avatar_url" :src="company.avatar_url" alt="Логотип" />
            <span v-else>{{ avatarFallback }}</span>
          </div>
          <div class="ed-identity">
            <p class="ed-eyebrow">Кабинет работодателя</p>
            <h1 class="ed-company-name">{{ company?.brand_name || company?.legal_name || 'Компания' }}</h1>
            <p v-if="company?.description" class="ed-company-desc">{{ company.description }}</p>
            <div class="ed-hero-chips">
              <span class="ed-chip" :class="company?.status === 'verified' ? 'ed-chip--green' : company?.status === 'pending_verification' ? 'ed-chip--yellow' : 'ed-chip--grey'">
                {{ companyStatusLabel }}
              </span>
              <span class="ed-chip" :class="canCreateOpportunities ? 'ed-chip--blue' : 'ed-chip--grey'">
                {{ canCreateOpportunities ? 'Публикация разрешена' : 'Публикация после проверки' }}
              </span>
            </div>
            <div class="ed-hero-actions">
              <RouterLink to="/profile" class="ed-btn ed-btn-white">Редактировать профиль</RouterLink>
            </div>
          </div>
        </div>
      </header>

      <!-- Status banners -->
      <div v-if="errorMessage" class="ed-banner ed-banner--error">{{ errorMessage }}</div>
      <div v-else-if="infoMessage" class="ed-banner ed-banner--info">{{ infoMessage }}</div>
      <div v-else-if="isLoading" class="ed-banner">
        <span class="ed-spinner"></span> Загружаем кабинет…
      </div>

      <!-- Company + verification -->
      <div class="ed-top-grid">
        <!-- Company highlights -->
        <div class="ed-card">
          <div class="ed-card-header">
            <p class="ed-kicker">Компания</p>
            <h2>Профиль компании</h2>
          </div>
          <div class="ed-highlights-grid">
            <div v-for="item in companyHighlights" :key="item.label" class="ed-highlight">
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
            </div>
          </div>
          <RouterLink to="/profile" class="ed-btn ed-btn-primary" style="margin-top:4px;align-self:start;">
            Открыть настройки
          </RouterLink>
        </div>

        <!-- Verification form -->
        <div v-if="canShowVerificationSection" class="ed-card ed-card--verify">
          <div class="ed-card-header">
            <p class="ed-kicker">Верификация</p>
            <h2>Подтверждение компании</h2>
            <p class="ed-card-desc">Подтверждение выполняется по ИНН. После одобрения куратором откроется создание вакансий.</p>
          </div>
          <form class="ed-verify-form" @submit.prevent="handleSubmitVerification">
            <label class="ed-field">
              <span>ИНН компании</span>
              <input v-model="verificationForm.inn" type="text" placeholder="7705043493" required />
            </label>
            <label class="ed-field">
              <span>Комментарий <em>(необязательно)</em></span>
              <textarea v-model="verificationForm.comment" rows="3" placeholder="Дополнительный комментарий для куратора" />
            </label>
            <button class="ed-btn ed-btn-primary" type="submit" :disabled="isSubmittingVerification">
              {{ isSubmittingVerification ? 'Отправляем…' : 'Отправить на проверку' }}
            </button>
          </form>
        </div>
      </div>

      <!-- Opportunities: create form -->
      <div v-if="canCreateOpportunities" class="ed-card">
        <div class="ed-card-header">
          <p class="ed-kicker">Новая позиция</p>
          <h2>Создать возможность</h2>
          <p class="ed-card-desc">Вакансия, стажировка, менторство или карьерное мероприятие.</p>
        </div>

        <div class="ed-opp-layout">
          <form class="ed-opp-form" @submit.prevent="handleCreateOpportunity">

            <div class="ed-form-section">
              <p class="ed-form-section-title">Основная информация</p>
              <div class="ed-fields">
                <label class="ed-field">
                  <span>Название *</span>
                  <input v-model="opportunityForm.title" type="text" required placeholder="Senior Golang Developer" />
                </label>
                <label class="ed-field">
                  <span>Компания</span>
                  <input v-model="opportunityForm.companyName" type="text" readonly />
                </label>
                <label class="ed-field">
                  <span>Тип</span>
                  <select v-model="opportunityForm.opportunityType">
                    <option v-for="o in typeOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
                  </select>
                </label>
                <label class="ed-field">
                  <span>Формат</span>
                  <select v-model="opportunityForm.workFormat">
                    <option v-for="o in formatOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
                  </select>
                </label>
                <label class="ed-field ed-field--full">
                  <span>Краткое описание *</span>
                  <textarea v-model="opportunityForm.shortDescription" rows="2" required placeholder="Коротко о задаче и ценности предложения" />
                </label>
                <label class="ed-field ed-field--full">
                  <span>Полное описание *</span>
                  <textarea v-model="opportunityForm.fullDescription" rows="5" required placeholder="Требования, задачи, условия работы" />
                </label>
              </div>
            </div>

            <div class="ed-form-section">
              <p class="ed-form-section-title">Локация</p>
              <div class="ed-fields">
                <label class="ed-field">
                  <span>Способ</span>
                  <select v-model="opportunityForm.locationMode">
                    <option v-for="o in locationModeOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
                  </select>
                </label>
                <label v-if="opportunityForm.locationMode === 'catalog'" class="ed-field">
                  <span>Из каталога</span>
                  <select v-model="opportunityForm.locationId">
                    <option v-for="loc in locations" :key="loc.id" :value="loc.id">{{ loc.display_text || loc.address_line }}</option>
                  </select>
                  <small v-if="!locations.length" class="ed-hint-text">Каталог пуст — выберите «Своя точка»</small>
                </label>
                <label v-else class="ed-field">
                  <span>Адрес *</span>
                  <input v-model="opportunityForm.locationAddress" type="text" placeholder="Город, улица, дом" required />
                </label>
                <template v-if="opportunityForm.locationMode === 'custom'">
                  <label class="ed-field ed-field--full">
                    <span>Подпись точки</span>
                    <input v-model="opportunityForm.locationDisplayText" type="text" placeholder="Москва, офис компании" />
                  </label>
                  <label class="ed-field">
                    <span>Широта</span>
                    <input v-model="opportunityForm.locationLatitude" type="number" min="-90" max="90" step="0.000001" required />
                  </label>
                  <label class="ed-field">
                    <span>Долгота</span>
                    <input v-model="opportunityForm.locationLongitude" type="number" min="-180" max="180" step="0.000001" required />
                  </label>
                </template>
                <div class="ed-field ed-field--full">
                  <span>Точка на карте</span>
                  <div class="ed-map-wrap">
                    <MapLibreOpportunityMap
                      :latitude="previewLocationLatitude"
                      :longitude="previewLocationLongitude"
                      :label="previewLocationLabel || 'Точка локации'"
                      :selectable="opportunityForm.locationMode === 'custom'"
                      @select="handleLocationSelect"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div class="ed-form-section">
              <p class="ed-form-section-title">Сроки и контакты</p>
              <div class="ed-fields">
                <label class="ed-field">
                  <span>Дедлайн подачи</span>
                  <input v-model="opportunityForm.applicationDeadline" type="datetime-local" />
                </label>
                <label class="ed-field">
                  <span>Срок публикации</span>
                  <input v-model="opportunityForm.expiresAt" type="datetime-local" />
                </label>
                <label class="ed-field ed-field--full">
                  <span>Контакты</span>
                  <textarea v-model="opportunityForm.contactsInfo" rows="3" placeholder="Email, Telegram, телефон" />
                </label>
                <label class="ed-field ed-field--full">
                  <span>Внешняя ссылка</span>
                  <input v-model="opportunityForm.externalUrl" type="url" placeholder="https://company.ru/vacancy" />
                </label>
              </div>
            </div>

            <div v-if="currentOpportunityTypeConfig.showVacancyFields || currentOpportunityTypeConfig.showSalaryFields || currentOpportunityTypeConfig.showEventFields" class="ed-form-section">
              <p class="ed-form-section-title">
                Параметры для «{{ typeOptions.find((o) => o.value === opportunityForm.opportunityType)?.label }}»
              </p>
              <div class="ed-fields">
                <template v-if="currentOpportunityTypeConfig.showVacancyFields">
                  <label class="ed-field">
                    <span>Уровень</span>
                    <select v-model="opportunityForm.vacancyLevel">
                      <option value="intern">Intern</option>
                      <option value="junior">Junior</option>
                      <option value="middle">Middle</option>
                      <option value="senior">Senior</option>
                    </select>
                  </label>
                  <label class="ed-field">
                    <span>Занятость</span>
                    <select v-model="opportunityForm.employmentType">
                      <option v-for="o in employmentOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
                    </select>
                  </label>
                </template>
                <template v-if="currentOpportunityTypeConfig.showSalaryFields">
                  <label class="ed-field">
                    <span>Зарплата от</span>
                    <input v-model="opportunityForm.salaryMin" type="number" min="0" placeholder="100 000" />
                  </label>
                  <label class="ed-field">
                    <span>Зарплата до</span>
                    <input v-model="opportunityForm.salaryMax" type="number" min="0" placeholder="200 000" />
                  </label>
                  <label class="ed-field">
                    <span>Валюта</span>
                    <select v-model="opportunityForm.salaryCurrency">
                      <option value="RUB">RUB</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </label>
                  <label class="ed-field ed-checkbox-label">
                    <input v-model="opportunityForm.isSalaryVisible" type="checkbox" />
                    <span>Показывать зарплату</span>
                  </label>
                </template>
                <template v-if="currentOpportunityTypeConfig.showEventFields">
                  <label class="ed-field">
                    <span>Начало мероприятия</span>
                    <input v-model="opportunityForm.eventStartAt" type="datetime-local" />
                  </label>
                  <label class="ed-field">
                    <span>Завершение</span>
                    <input v-model="opportunityForm.eventEndAt" type="datetime-local" />
                  </label>
                </template>
              </div>
            </div>

            <div v-if="technologyTags.length" class="ed-form-section">
              <p class="ed-form-section-title">Технологии</p>
              <div class="ed-tags-grid">
                <label v-for="tag in technologyTags" :key="tag.id" class="ed-tag-check">
                  <input v-model="opportunityForm.selectedTechnologyTagIds" type="checkbox" :value="tag.id" />
                  <span>{{ tag.name }}</span>
                </label>
              </div>
            </div>

            <div class="ed-form-actions">
              <button class="ed-btn ed-btn-primary" type="submit" :disabled="isSubmittingOpportunity">
                {{ isSubmittingOpportunity ? 'Создаём…' : 'Создать возможность' }}
              </button>
            </div>
          </form>

          <!-- Preview -->
          <aside class="ed-preview">
            <p class="ed-kicker">Предпросмотр</p>
            <h3 class="ed-preview-title">{{ opportunityForm.title || 'Название позиции' }}</h3>
            <p class="ed-preview-company">{{ opportunityForm.companyName }}</p>
            <div class="ed-preview-chips">
              <span class="ed-chip ed-chip--blue">{{ typeOptions.find((o) => o.value === opportunityForm.opportunityType)?.label }}</span>
              <span class="ed-chip ed-chip--grey">{{ formatOptions.find((o) => o.value === opportunityForm.workFormat)?.label }}</span>
            </div>
            <div class="ed-preview-fields">
              <div class="ed-preview-field">
                <span>Описание</span>
                <p>{{ opportunityForm.shortDescription || 'Не заполнено' }}</p>
              </div>
              <div class="ed-preview-field">
                <span>Место</span>
                <p>{{ previewLocationLabel || previewLocationAddress || 'Не указано' }}</p>
              </div>
              <div v-if="previewTagGroups.length" class="ed-preview-field">
                <span>Теги</span>
                <p>{{ previewTagGroups.join(', ') }}</p>
              </div>
              <div v-if="currentOpportunityTypeConfig.showSalaryFields && (opportunityForm.salaryMin || opportunityForm.salaryMax)" class="ed-preview-field">
                <span>Зарплата</span>
                <p>{{ [opportunityForm.salaryMin && `от ${opportunityForm.salaryMin}`, opportunityForm.salaryMax && `до ${opportunityForm.salaryMax}`, opportunityForm.salaryCurrency].filter(Boolean).join(' ') }}</p>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <!-- Locked create -->
      <div v-else class="ed-card ed-card--locked">
        <div class="ed-card-header">
          <p class="ed-kicker">Публикация заблокирована</p>
          <h2>Новая возможность</h2>
        </div>
        <p class="ed-muted">Создание вакансий и стажировок станет доступно после того, как куратор подтвердит компанию. Сначала заполните профиль и отправьте верификацию.</p>
      </div>

      <!-- My opportunities -->
      <div class="ed-card">
        <div class="ed-card-header">
          <div>
            <p class="ed-kicker">Мои публикации</p>
            <h2>Активные возможности</h2>
          </div>
          <span v-if="employerOpportunities.length" class="ed-count-badge">{{ employerOpportunities.length }}</span>
        </div>

        <div v-if="!employerOpportunities.length" class="ed-empty">
          <span>📋</span>
          <p>Опубликованных карточек пока нет.</p>
        </div>

        <div v-else class="ed-opp-list">
          <div
            v-for="opportunity in employerOpportunities"
            :key="opportunity.id"
            class="ed-opp-row"
            :class="{ 'ed-opp-row--active': selectedOpportunityId === opportunity.id }"
          >
            <div class="ed-opp-info">
              <div class="ed-opp-title-row">
                <strong class="ed-opp-title">{{ opportunity.title }}</strong>
                <span class="ed-chip ed-chip--sm" :class="opportunity.status === 'active' ? 'ed-chip--green' : 'ed-chip--grey'">
                  {{ getOpportunityStatusLabel(opportunity.status) }}
                </span>
                <span class="ed-chip ed-chip--sm ed-chip--grey">{{ formatOpportunityType(opportunity.type) }}</span>
              </div>
              <span class="ed-opp-meta">{{ opportunity.companyName }} · {{ formatWorkFormat(opportunity.workFormat) }}</span>
            </div>
            <div class="ed-opp-actions">
              <button
                class="ed-btn ed-btn-ghost ed-btn-sm"
                type="button"
                @click="openApplications(opportunity)"
              >
                {{ selectedOpportunityId === opportunity.id ? 'Обновить' : 'Отклики' }}
                <span v-if="selectedOpportunityId === opportunity.id && opportunityApplications.length" class="ed-count-badge ed-count-badge--sm">{{ opportunityApplications.length }}</span>
              </button>
              <button
                v-if="opportunity.type === 'vacancy'"
                class="ed-btn ed-btn-ghost ed-btn-sm"
                type="button"
                :disabled="isLoadingAnalysis && analysisOpportunityId === opportunity.id"
                @click="handleRequestAnalysis(opportunity.id)"
              >
                <span v-if="isLoadingAnalysis && analysisOpportunityId === opportunity.id" class="ed-spinner ed-spinner--xs"></span>
                {{ isLoadingAnalysis && analysisOpportunityId === opportunity.id ? 'Анализируем…' : 'ИИ-анализ' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- AI analysis panel -->
      <div v-if="opportunityAnalysis" class="ed-card ed-card--ai">
        <div class="ed-card-header">
          <div>
            <p class="ed-kicker">ИИ-анализ</p>
            <h2>Анализ вакансии</h2>
            <p class="ed-muted" style="margin-top:4px;">Сгенерировано {{ formatDate(opportunityAnalysis.generated_at) }}</p>
          </div>
          <button class="ed-btn ed-btn-ghost ed-btn-sm" type="button" @click="opportunityAnalysis = null">Скрыть</button>
        </div>
        <div class="ed-ai-body" v-html="sanitizeHtml(opportunityAnalysis.analysis)" />
      </div>

      <!-- Applications panel -->
      <div v-if="selectedOpportunityId" class="ed-card">
        <div class="ed-card-header">
          <div>
            <p class="ed-kicker">Отклики</p>
            <h2>{{ selectedOpportunityTitle }}</h2>
          </div>
          <button class="ed-btn ed-btn-ghost ed-btn-sm" type="button" @click="closeApplications">Закрыть</button>
        </div>

        <!-- Filter chips -->
        <div class="ed-filters">
          <button
            v-for="chip in applicationFilterChips"
            :key="chip.value"
            type="button"
            class="ed-filter-chip"
            :class="{ active: activeApplicationFilter === chip.value }"
            @click="activeApplicationFilter = chip.value"
          >
            {{ chip.label }} <span class="ed-filter-count">{{ chip.count }}</span>
          </button>
        </div>

        <div v-if="applicationsError" class="ed-banner ed-banner--error">{{ applicationsError }}</div>
        <div v-else-if="isApplicationsLoading" class="ed-banner"><span class="ed-spinner"></span> Загружаем отклики…</div>
        <div v-else-if="!filteredApplications.length" class="ed-empty"><p>Откликов по этому фильтру нет.</p></div>

        <div v-else class="ed-app-list">
          <div v-for="application in filteredApplications" :key="application.id" class="ed-app-card">

            <!-- Applicant row -->
            <div class="ed-app-head">
              <div class="ed-app-person">
                <div class="ed-app-avatar">
                  <img v-if="getApplicationAvatar(application)" :src="getApplicationAvatar(application)" alt="" />
                  <span v-else>{{ getApplicationInitials(application) }}</span>
                </div>
                <div class="ed-app-name">
                  <strong>{{ application.student_display_name || 'Соискатель' }}</strong>
                  <span>{{ application.resume_id ? 'Резюме приложено' : 'Без резюме' }}</span>
                </div>
              </div>
              <span class="ed-app-status" :class="`ed-status--${application.status || 'submitted'}`">
                {{ getApplicationStatusLabel(application.status) }}
              </span>
            </div>

            <!-- Cover letter + date -->
            <div class="ed-app-body">
              <div class="ed-app-detail">
                <span>Сопроводительное письмо</span>
                <p>{{ application.cover_letter || 'Письмо не добавлено.' }}</p>
              </div>
              <div class="ed-app-detail">
                <span>Дата отклика</span>
                <p>{{ application.created_at ? formatDate(application.created_at) : '—' }}</p>
              </div>
            </div>

            <!-- Actions -->
            <div class="ed-app-actions">
              <button
                class="ed-btn ed-btn-primary ed-btn-sm"
                type="button"
                :disabled="openingChatApplicationId === application.id || !application.student_user_id"
                @click="handleOpenApplicantChat(application)"
              >
                {{ openingChatApplicationId === application.id ? '…' : 'Написать' }}
              </button>
              <RouterLink
                v-if="application.student_user_id"
                :to="`/profiles/students/${application.student_user_id}`"
                class="ed-btn ed-btn-ghost ed-btn-sm"
                @click="saveApplicantPreview(application)"
              >
                Профиль
              </RouterLink>
              <button class="ed-btn ed-btn-ghost ed-btn-sm" type="button" :disabled="updatingApplicationId === application.id" @click="handleApplicationStatusChange(application, 'in_review')">В работу</button>
              <button class="ed-btn ed-btn-ghost ed-btn-sm" type="button" :disabled="updatingApplicationId === application.id" @click="handleApplicationStatusChange(application, 'accepted')">Принять</button>
              <button class="ed-btn ed-btn-ghost ed-btn-sm" type="button" :disabled="updatingApplicationId === application.id" @click="handleApplicationStatusChange(application, 'rejected')">Отклонить</button>
              <button class="ed-btn ed-btn-ghost ed-btn-sm" type="button" :disabled="updatingApplicationId === application.id" @click="handleApplicationStatusChange(application, 'reserve')">В резерв</button>
              <button class="ed-btn ed-btn-outline-blue ed-btn-sm" type="button" @click="openInviteForm(application)">Пригласить</button>
            </div>

            <!-- Invite form -->
            <form v-if="inviteTargetApplicationId === application.id" class="ed-invite-form" @submit.prevent="handleSendInvitation">
              <p class="ed-invite-to">Приглашение для: <strong>{{ application.student_display_name || 'Соискателя' }}</strong></p>
              <label class="ed-field ed-field--full">
                <span>Сообщение</span>
                <textarea v-model="inviteForm.message" rows="3" placeholder="Приглашаем вас рассмотреть нашу вакансию…" />
              </label>
              <p v-if="invitationError" class="ed-inline-error">{{ invitationError }}</p>
              <div class="ed-invite-actions">
                <button class="ed-btn ed-btn-primary ed-btn-sm" type="submit" :disabled="isSendingInvitation">
                  {{ isSendingInvitation ? 'Отправляем…' : 'Отправить приглашение' }}
                </button>
                <button class="ed-btn ed-btn-ghost ed-btn-sm" type="button" @click="closeInviteForm">Отмена</button>
              </div>
            </form>

          </div>
        </div>
      </div>

    </div>
  </main>
</template>

<style scoped>
/* ─── new styles ─────────────────────────────────────────────────── */
.ed-root { display: grid; gap: 20px; max-width: 1180px; margin: 0 auto; }

/* Hero */
.ed-hero { border-radius: 20px; border: 1px solid rgba(18,38,63,.08); background: var(--surface); box-shadow: 0 4px 24px rgba(15,23,42,.06); overflow: hidden; }
.ed-cover { height: 130px; background: linear-gradient(135deg, #0f2c7a 0%, #1d4ed8 50%, #60a5fa 100%); }
.ed-hero-body { display: flex; gap: 20px; align-items: flex-start; padding: 0 28px 24px; }
.ed-co-avatar { width: 80px; height: 80px; border-radius: 16px; border: 4px solid #fff; overflow: hidden; flex-shrink: 0; margin-top: -32px; background: var(--surface-muted); box-shadow: 0 4px 16px rgba(15,23,42,.12); display: flex; align-items: center; justify-content: center; font-size: 1.4rem; font-weight: 800; color: #fff; background: linear-gradient(135deg, #1e40af, #3b82f6); }
.ed-co-avatar img { width: 100%; height: 100%; object-fit: cover; }
.ed-identity { display: grid; gap: 6px; flex: 1; min-width: 0; padding-top: 10px; }
.ed-eyebrow { margin: 0; font: 700 0.65rem/1 var(--font-mono,monospace); text-transform: uppercase; letter-spacing: .1em; color: #3b82f6; }
.ed-company-name { margin: 0; font-family: var(--font-heading); font-size: clamp(1.4rem,2.5vw,1.9rem); color: var(--text); line-height: 1.1; }
.ed-company-desc { margin: 0; font-size: 0.86rem; color: var(--muted); line-height: 1.5; max-width: 500px; }
.ed-hero-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.ed-hero-actions { display: flex; gap: 8px; margin-top: 2px; }

/* Chips */
.ed-chip { height: 22px; padding: 0 10px; border-radius: 6px; font-size: 0.72rem; font-weight: 700; display: inline-flex; align-items: center; }
.ed-chip--green { background: var(--chip-green); color: var(--success); }
.ed-chip--yellow { background: #fef9c3; color: #854d0e; }
.ed-chip--blue { background: var(--chip-blue); color: var(--chip-blue-text); }
.ed-chip--grey { background: var(--surface-muted); color: var(--muted); }
.ed-chip--sm { height: 18px; padding: 0 7px; font-size: 0.66rem; }

/* Banner */
.ed-banner { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); font-size: 0.87rem; color: var(--muted); }
.ed-banner--error { border-color: var(--border-red); background: var(--surface-red); color: #991b1b; }
.ed-banner--info { border-color: var(--border-green); background: var(--surface-green); color: var(--success); }

/* Spinner */
.ed-spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid #e2e8f0; border-top-color: #3b82f6; border-radius: 50%; animation: spin .7s linear infinite; flex-shrink: 0; }
.ed-spinner--xs { width: 11px; height: 11px; }
@keyframes spin { to { transform: rotate(360deg); } }

/* Cards */
.ed-card { padding: 20px 24px; border: 1px solid var(--border); border-radius: 18px; background: var(--surface); box-shadow: 0 2px 10px rgba(15,23,42,.04); display: grid; gap: 16px; }
.ed-card--verify { border-color: var(--border-blue); background: var(--surface-blue); }
.ed-card--locked { border-color: var(--border); background: var(--surface-strong); }
.ed-card--ai { border-color: var(--border-ai); background: var(--surface-ai); }

.ed-card-header { display: grid; gap: 3px; }
.ed-card-header h2 { margin: 0; font-family: var(--font-heading); font-size: 1.1rem; color: var(--text); }
.ed-kicker { margin: 0; font: 700 0.65rem/1 var(--font-mono,monospace); text-transform: uppercase; letter-spacing: .1em; color: #3b82f6; }
.ed-card-desc { margin: 0; font-size: 0.82rem; color: var(--muted); line-height: 1.5; max-width: 52ch; }
.ed-muted { margin: 0; font-size: 0.86rem; color: var(--muted); line-height: 1.6; }

/* Top grid (company + verification) */
.ed-top-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; align-items: start; }

/* Company highlights */
.ed-highlights-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 8px; }
.ed-highlight { display: grid; gap: 3px; padding: 10px 12px; border-radius: 10px; background: var(--surface-strong); border: 1px solid #f1f5f9; }
.ed-highlight span { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--border-strong); }
.ed-highlight strong { font-size: 0.82rem; font-weight: 600; color: var(--text); line-height: 1.3; }

/* Verification form */
.ed-verify-form { display: grid; gap: 10px; }

/* Fields */
.ed-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 11px; }
.ed-field { display: grid; gap: 5px; }
.ed-field--full { grid-column: 1 / -1; }
.ed-field > span { font-size: 0.78rem; font-weight: 600; color: var(--muted); }
.ed-field em { font-weight: 400; color: var(--border-strong); font-style: normal; }
.ed-hint-text { font-size: 0.75rem; color: var(--border-strong); }
.ed-field input, .ed-field select, .ed-field textarea {
  min-height: 40px; padding: 0 12px;
  border: 1px solid var(--border); border-radius: 10px; background: var(--surface-strong);
  font: inherit; font-size: 0.875rem; color: var(--text); outline: none;
  transition: border-color .15s, box-shadow .15s;
}
.ed-field input:focus, .ed-field select:focus, .ed-field textarea:focus {
  border-color: #3b82f6; background: var(--surface); box-shadow: 0 0 0 3px rgba(59,130,246,.1);
}
.ed-field textarea { min-height: 88px; padding: 10px 12px; resize: vertical; }
.ed-checkbox-label { display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 0.84rem; color: var(--text); align-self: end; padding-bottom: 10px; }
.ed-checkbox-label input { width: 15px; height: 15px; accent-color: #2563eb; margin: 0; cursor: pointer; }

/* Opportunity create layout */
.ed-opp-layout { display: grid; grid-template-columns: minmax(0,1fr) 280px; gap: 20px; align-items: start; }
.ed-opp-form { display: grid; gap: 14px; }
.ed-form-section { display: grid; gap: 12px; padding: 16px 18px; border: 1px solid #f1f5f9; border-radius: 14px; background: var(--surface-strong); }
.ed-form-section-title { margin: 0; font-size: 0.78rem; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: #3b82f6; }
.ed-form-actions { display: flex; gap: 8px; padding-top: 4px; }
.ed-map-wrap { border-radius: 12px; overflow: hidden; height: 220px; margin-top: 4px; }

/* Tags */
.ed-tags-grid { display: flex; flex-wrap: wrap; gap: 8px; }
.ed-tag-check { display: inline-flex; align-items: center; gap: 7px; padding: 7px 12px; border: 1px solid var(--border); border-radius: 999px; background: var(--surface); font-size: 0.82rem; cursor: pointer; transition: border-color .15s; }
.ed-tag-check:hover { border-color: #bfdbfe; }
.ed-tag-check input { width: 14px; height: 14px; accent-color: #2563eb; margin: 0; }

/* Preview card */
.ed-preview { position: sticky; top: 20px; padding: 18px 20px; border: 1px solid var(--border); border-radius: 16px; background: var(--surface-strong); display: grid; gap: 12px; }
.ed-preview-title { margin: 0; font-family: var(--font-heading); font-size: 1rem; color: var(--text); }
.ed-preview-company { margin: 0; font-size: 0.82rem; color: #2563eb; font-weight: 500; }
.ed-preview-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.ed-preview-fields { display: grid; gap: 8px; }
.ed-preview-field { padding: 10px 12px; border-radius: 10px; background: var(--surface); border: 1px solid #f1f5f9; }
.ed-preview-field span { display: block; font-size: 0.67rem; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--border-strong); margin-bottom: 3px; }
.ed-preview-field p { margin: 0; font-size: 0.82rem; color: var(--text); line-height: 1.45; }

/* Count badge */
.ed-count-badge { display: inline-flex; align-items: center; justify-content: center; min-width: 22px; height: 22px; padding: 0 6px; border-radius: 999px; background: var(--surface-muted); color: var(--muted); font-size: 0.72rem; font-weight: 700; }
.ed-count-badge--sm { height: 17px; min-width: 17px; font-size: 0.66rem; }

/* Empty */
.ed-empty { display: flex; align-items: center; gap: 10px; padding: 20px; border: 1.5px dashed #e2e8f0; border-radius: 12px; font-size: 0.84rem; color: var(--border-strong); }
.ed-empty p { margin: 0; }

/* Opportunities list */
.ed-opp-list { display: grid; gap: 8px; }
.ed-opp-row { display: flex; align-items: center; gap: 14px; padding: 12px 16px; border: 1px solid #f1f5f9; border-radius: 12px; background: var(--surface-strong); transition: border-color .15s; }
.ed-opp-row:hover, .ed-opp-row--active { border-color: #bfdbfe; background: var(--surface); }
.ed-opp-info { display: grid; gap: 4px; flex: 1; min-width: 0; }
.ed-opp-title-row { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
.ed-opp-title { font-size: 0.9rem; font-weight: 600; color: var(--text); }
.ed-opp-meta { font-size: 0.76rem; color: var(--muted); }
.ed-opp-actions { display: flex; gap: 6px; flex-shrink: 0; }

/* Applications list */
.ed-filters { display: flex; flex-wrap: wrap; gap: 6px; }
.ed-filter-chip { height: 30px; padding: 0 12px; border: 1px solid var(--border); border-radius: 999px; background: var(--surface); color: var(--muted); font: inherit; font-size: 0.79rem; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; transition: all .15s; }
.ed-filter-chip.active { border-color: #2563eb; background: #eff6ff; color: var(--chip-blue-text); font-weight: 600; }
.ed-filter-count { font-size: 0.72rem; color: inherit; opacity: .7; }

.ed-app-list { display: grid; gap: 10px; }
.ed-app-card { display: grid; gap: 12px; padding: 14px 16px; border: 1px solid var(--border); border-radius: 14px; background: var(--surface); }
.ed-app-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.ed-app-person { display: flex; align-items: center; gap: 11px; }
.ed-app-avatar { width: 40px; height: 40px; border-radius: 50%; overflow: hidden; background: linear-gradient(135deg,#1e40af,#3b82f6); display: flex; align-items: center; justify-content: center; font-size: 0.82rem; font-weight: 700; color: #fff; flex-shrink: 0; border: 1px solid var(--border); }
.ed-app-avatar img { width: 100%; height: 100%; object-fit: cover; }
.ed-app-name { display: grid; gap: 2px; }
.ed-app-name strong { font-size: 0.9rem; font-weight: 600; color: var(--text); }
.ed-app-name span { font-size: 0.76rem; color: var(--muted); }

.ed-app-status { height: 22px; padding: 0 10px; border-radius: 999px; font-size: 0.72rem; font-weight: 700; display: inline-flex; align-items: center; white-space: nowrap; }
.ed-status--submitted { background: var(--chip-blue); color: var(--chip-blue-text); }
.ed-status--in_review { background: var(--chip-purple); color: var(--chip-purple-text); }
.ed-status--accepted { background: var(--chip-green); color: var(--success); }
.ed-status--rejected { background: var(--surface-red); color: #991b1b; }
.ed-status--reserve { background: #fef3c7; color: #92400e; }
.ed-status--withdrawn { background: var(--surface-muted); color: var(--muted); }

.ed-app-body { display: grid; grid-template-columns: minmax(0,1fr) 160px; gap: 8px; }
.ed-app-detail { display: grid; gap: 4px; padding: 10px 12px; border-radius: 10px; background: var(--surface-strong); border: 1px solid #f1f5f9; }
.ed-app-detail span { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--border-strong); }
.ed-app-detail p { margin: 0; font-size: 0.84rem; color: var(--text); line-height: 1.5; }

.ed-app-actions { display: flex; flex-wrap: wrap; gap: 6px; }

/* Invite form */
.ed-invite-form { display: grid; gap: 10px; padding: 14px; border: 1px solid #dbeafe; border-radius: 12px; background: var(--surface-blue); }
.ed-invite-to { margin: 0; font-size: 0.84rem; color: var(--muted); }
.ed-invite-to strong { color: var(--text); }
.ed-invite-actions { display: flex; gap: 8px; }
.ed-inline-error { margin: 0; font-size: 0.82rem; color: #dc2626; }

/* AI body */
.ed-ai-body { font-size: 0.9rem; line-height: 1.7; color: var(--text); }
.ed-ai-body :deep(h3) { margin: 14px 0 5px; font-size: 0.95rem; font-weight: 600; color: var(--text); }
.ed-ai-body :deep(p) { margin: 0 0 8px; }
.ed-ai-body :deep(ul) { margin: 0 0 8px; padding-left: 18px; }
.ed-ai-body :deep(li) { margin-bottom: 5px; }
.ed-ai-body :deep(strong) { font-weight: 600; color: var(--text); }

/* Buttons */
.ed-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 36px; padding: 0 16px; border-radius: 10px; border: 1px solid transparent; font: inherit; font-size: 0.875rem; font-weight: 500; cursor: pointer; text-decoration: none; transition: background .15s, border-color .15s; white-space: nowrap; }
.ed-btn:disabled { opacity: .55; pointer-events: none; }
.ed-btn-primary { background: #2563eb; border-color: #2563eb; color: #fff; }
.ed-btn-primary:hover { background: #1d4ed8; border-color: var(--chip-blue-text); }
.ed-btn-ghost { background: transparent; border-color: var(--border); color: var(--muted); }
.ed-btn-ghost:hover { background: var(--surface-strong); border-color: var(--border-strong); }
.ed-btn-outline-blue { background: transparent; border-color: #bfdbfe; color: #2563eb; }
.ed-btn-outline-blue:hover { background: #eff6ff; }
.ed-btn-white { background: rgba(255,255,255,.15); border-color: rgba(255,255,255,.35); color: #fff; }
.ed-btn-white:hover { background: rgba(255,255,255,.25); }
.ed-btn-sm { min-height: 30px; padding: 0 12px; font-size: 0.8rem; border-radius: 8px; }

/* Responsive */
@media (max-width: 1000px) {
  .ed-opp-layout { grid-template-columns: 1fr; }
  .ed-preview { position: static; }
}
@media (max-width: 800px) {
  .ed-top-grid { grid-template-columns: 1fr; }
  .ed-highlights-grid { grid-template-columns: 1fr 1fr; }
  .ed-app-body { grid-template-columns: 1fr; }
}
@media (max-width: 600px) {
  .ed-hero-body { flex-direction: column; padding: 0 18px 20px; }
  .ed-co-avatar { margin-top: -28px; width: 68px; height: 68px; }
  .ed-fields { grid-template-columns: 1fr; }
  .ed-highlights-grid { grid-template-columns: 1fr; }
}

/* ─── legacy stubs (keep so Vue doesn't warn) ───────────────────── */
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
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--surface);
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

.ai-analysis-panel {
  border-color: rgba(53, 96, 223, 0.2);
  background: rgba(245, 248, 255, 0.95);
}

.ai-analysis-body {
  line-height: 1.65;
  font-size: 0.93rem;
  color: var(--text);
}

.ai-analysis-body :deep(h3) {
  margin: 16px 0 6px;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text);
}

.ai-analysis-body :deep(p) {
  margin: 0 0 10px;
}

.ai-analysis-body :deep(ul) {
  margin: 0 0 10px;
  padding-left: 20px;
}

.ai-analysis-body :deep(li) {
  margin-bottom: 6px;
}

.ai-analysis-body :deep(strong) {
  font-weight: 600;
  color: var(--text);
}

.ai-analysis-body :deep(section) {
  margin-bottom: 14px;
}

.filter-row {
  justify-content: flex-start;
}

.filter-chip {
  min-height: 34px;
  padding: 0 12px;
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 999px;
  background: var(--surface);
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
  background: var(--surface-muted);
}

.application-copy {
  display: grid;
  gap: 4px;
}

.application-copy strong {
  color: var(--text);
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
  background: var(--surface-muted);
  color: var(--muted);
  font-size: 0.8rem;
  font-weight: 600;
}

.application-status.status-submitted {
  background: var(--surface-muted);
  color: var(--muted);
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
  color: var(--muted);
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
  color: var(--text);
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
  border: 1px solid var(--border);
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
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--surface);
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
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--surface);
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
  border: 1px solid var(--border);
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
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
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
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--surface);
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
  background: var(--surface);
}

.summary-card span {
  color: #627087;
  font-size: 0.8rem;
}

.summary-card strong {
  color: var(--text);
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
  border: 1px solid var(--border);
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
  color: var(--text);
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
  background: var(--surface);
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
  background: var(--surface);
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
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--surface);
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
  background: var(--surface);
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

<style scoped>
:global(.dark) .ed-co-avatar { border-color: var(--surface); }
:global(.dark) .ed-chip--green  { background: #091a0d; color: #4ade80; }
:global(.dark) .ed-chip--blue   { background: #0f1e38; color: #60a5fa; }
:global(.dark) .ed-banner--error { border-color: #7f1d1d; background: #1f0808; color: #fca5a5; }
:global(.dark) .ed-banner--info  { border-color: #14532d; background: #091a0d; color: #4ade80; }
:global(.dark) .ed-card--verify  { background: #0a1020; border-color: var(--accent-soft); }
:global(.dark) .ed-card--ai      { background: #130e22; border-color: #4c1d95; }
:global(.dark) .ed-status--submitted { background: #0f1e38; color: #60a5fa; }
:global(.dark) .ed-status--in_review { background: #130e22; color: #a78bfa; }
:global(.dark) .ed-status--accepted  { background: #091a0d; color: #4ade80; }
:global(.dark) .ed-status--rejected  { background: #1f0808; color: #fca5a5; }
:global(.dark) .ed-status--reserve   { background: #1c1205; color: #fbbf24; }
:global(.dark) .ed-status--withdrawn { background: var(--surface-muted); color: var(--muted); }
:global(.dark) .ed-invite-form { background: #0a1020; border-color: var(--accent-soft); }
:global(.dark) .ed-tag-check { background: var(--surface); border-color: var(--border); color: var(--muted); }
:global(.dark) .ed-tag-check:hover { border-color: var(--accent); }
:global(.dark) .ed-preview { background: var(--surface-strong); border-color: var(--border); }
</style>
