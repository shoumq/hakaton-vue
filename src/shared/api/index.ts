import axios, { type AxiosRequestConfig } from 'axios'

import type { Opportunity, OpportunityLocation, OpportunityType, WorkFormat } from '@/entities/opportunity/model/types'
import type { PlatformUser, UserRole } from '@/entities/user/model/types'
import { employmentTags, levelTags } from '@/shared/config/tags'

import { api } from './base'

export { api, getApiErrorMessage, setApiAuthToken } from './base'

type AuthRole = Exclude<UserRole, 'guest'>

interface ApiEnvelope<T> {
  status: string
  data: T
  error?: string
}

interface BackendUser {
  id: string
  email: string
  display_name?: string
  avatar_url?: string
  avatar_object?: string
}

interface AuthResponse {
  access_token: string
  expires_at: string
  role: string
  token_type: string
  user: BackendUser
}

interface AvatarUploadResponse {
  id: string
  email: string
  display_name?: string
  avatar_url?: string
  avatar_object?: string
  email_verified?: boolean
  status?: string
  last_login_at?: string
  created_at?: string
  updated_at?: string
}

interface BackendLocation {
  id: string
  address_line?: string
  latitude?: number
  longitude?: number
  display_text?: string
}

interface BackendOpportunity {
  id: string
  company_id?: string
  title: string
  short_description?: string
  full_description?: string
  opportunity_type?: string
  work_format?: string
  employment_type?: string
  location_id?: string
  published_at?: string
  expires_at?: string
  salary_min?: number
  salary_max?: number
  contacts_info?: string
  status?: string
  company_name?: string
  tags?: string[]
  location?: string
  applications_count?: number
  favorites_count?: number
  views_count?: number
}

export interface BackendTag {
  id: string
  name: string
  tag_type: string
}

export interface SessionPayload {
  token: string
  expiresAt: string
  user: PlatformUser
}

export interface CurrentUserData {
  user: BackendUser
  roles?: string[]
  student_profile?: Record<string, unknown> | null
  employer_profile?: Record<string, unknown> | null
}

export interface PublicCatalog {
  opportunities: Opportunity[]
  tags: BackendTag[]
  locations: BackendLocation[]
}

export interface OpportunityDetails extends Opportunity {
  fullDescription: string
  applicationsCount: number
  favoritesCount: number
  viewsCount: number
}

export interface StudentProfileDto {
  user_id?: string
  display_name?: string
  first_name?: string
  last_name?: string
  middle_name?: string
  university_name?: string
  faculty?: string
  specialization?: string
  study_year?: number
  graduation_year?: number
  about?: string
  telegram?: string
  github_url?: string
  linkedin_url?: string
  website_url?: string
  profile_visibility?: string
  show_resume?: boolean
  show_applications?: boolean
  show_career_interests?: boolean
  created_at?: string
  updated_at?: string
}

export interface ApplicationDto {
  id?: string
  opportunity_id?: string
  status?: string
  updated_at?: string
  created_at?: string
}

export interface ResumeDto {
  id: string
  title?: string
  summary?: string
  is_primary?: boolean
  created_at?: string
}

export interface PortfolioProjectDto {
  id: string
  title?: string
  description?: string
  project_url?: string
}

export interface ContactDto {
  id: string
  display_name?: string
  title?: string
  message?: string
  status?: string
}

export interface NotificationDto {
  id: string
  title?: string
  message?: string
  created_at?: string
}

export interface EmployerCompanyDto {
  id: string
  legal_name?: string
  brand_name?: string
  description?: string
  industry?: string
  website_url?: string
  company_size?: string
  founded_year?: number
  status?: string
  inn?: string
  email_domain?: string
}

export interface VerificationDto {
  id: string
  company_id?: string
  company_name?: string
  status?: string
  verification_method?: VerificationMethod
  corporate_email?: string
  inn_submitted?: string
  documents_comment?: string
  submitted_at?: string
  reviewed_at?: string
}

export interface CompanyRegistryDto {
  inn?: string
  full_name?: string
  short_name?: string
  status?: string
  address?: string
  ogrn?: string
  kpp?: string
  registration_date?: string
  okved?: string
  management_name?: string
  management_post?: string
  email?: string
  phone?: string
  employee_count?: number
  source?: string
}

export interface ModerationQueueItemDto {
  id?: string
  entity_type?: string
  entity_id?: string
  title?: string
  status?: string
  created_at?: string
  updated_at?: string
  [key: string]: unknown
}

export interface AuditLogDto {
  id?: string
  action?: string
  entity_type?: string
  entity_id?: string
  created_at?: string
  [key: string]: unknown
}

export interface RegisterInput {
  email: string
  password: string
  display_name: string
  role: 'student' | 'employer'
  company_name?: string
}

export interface EmployerCompanyInput {
  legal_name?: string
  brand_name?: string
  description?: string
  industry?: string
  website_url?: string
  company_size?: string
  founded_year?: number
  inn?: string
  email_domain?: string
}

export type VerificationMethod =
  | 'corporate_email'
  | 'inn_check'
  | 'manual_documents'
  | 'social_links_review'
  | 'combined'

export interface VerificationInput {
  corporate_email?: string
  inn_submitted?: string
  verification_method: VerificationMethod
  documents_comment?: string
}

export interface VerificationReviewInput {
  status: 'approved' | 'needs_revision'
  comment?: string
}

interface OpportunityCreateBaseInput {
  title: string
  short_description: string
  full_description: string
  opportunity_type: OpportunityType
  work_format: WorkFormat
  location_id: string
  application_deadline?: string
  contacts_info?: string
  external_url?: string
  expires_at?: string
  tag_ids?: string[]
  status?: string
}

export interface InternshipOpportunityCreateInput extends OpportunityCreateBaseInput {
  opportunity_type: 'internship'
  vacancy_level?: string
  employment_type?: string
  salary_min?: number
  salary_max?: number
  salary_currency?: string
  is_salary_visible?: boolean
}

export interface VacancyOpportunityCreateInput extends OpportunityCreateBaseInput {
  opportunity_type: 'vacancy'
  vacancy_level?: string
  employment_type?: string
  salary_min?: number
  salary_max?: number
  salary_currency?: string
  is_salary_visible?: boolean
}

export interface MentorshipOpportunityCreateInput extends OpportunityCreateBaseInput {
  opportunity_type: 'mentorship'
}

export interface EventOpportunityCreateInput extends OpportunityCreateBaseInput {
  opportunity_type: 'event'
  event_start_at?: string
  event_end_at?: string
}

export type OpportunityCreateInput =
  | InternshipOpportunityCreateInput
  | VacancyOpportunityCreateInput
  | MentorshipOpportunityCreateInput
  | EventOpportunityCreateInput

function unwrap<T>(payload: ApiEnvelope<T> | T): T {
  if (payload && typeof payload === 'object' && 'status' in payload && 'data' in payload) {
    return (payload as ApiEnvelope<T>).data
  }

  return payload as T
}

async function request<T>(config: AxiosRequestConfig) {
  const response = await api.request<ApiEnvelope<T> | T>(config)

  return unwrap(response.data)
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

function normalizeRole(role: string | undefined): AuthRole {
  if (role === 'student' || role === 'employer' || role === 'curator') {
    return role
  }

  return 'student'
}

function normalizeUser(user: BackendUser, role: string | undefined): PlatformUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name || user.email,
    avatarUrl: user.avatar_url,
    role: normalizeRole(role),
  }
}

function normalizeAuth(data: AuthResponse): SessionPayload {
  return {
    token: data.access_token,
    expiresAt: data.expires_at,
    user: normalizeUser(data.user, data.role),
  }
}

function createLocationMap(locations: BackendLocation[]) {
  return Object.fromEntries(locations.map((location) => [location.id, location]))
}

function normalizeEmploymentType(value: string | undefined) {
  const normalized = (value ?? 'full_time').replaceAll('_', '-')

  if (employmentTags.includes(normalized as never)) {
    return normalized as Opportunity['employment']
  }

  return 'full-time'
}

function normalizeLocation(
  opportunity: BackendOpportunity,
  locationsById: Record<string, BackendLocation>,
): OpportunityLocation {
  const location = opportunity.location_id ? locationsById[opportunity.location_id] : undefined

  return {
    city: location?.display_text?.split(',')[0] ?? 'Онлайн',
    address: location?.address_line,
    latitude: location?.latitude ?? 55.751244,
    longitude: location?.longitude ?? 37.618423,
    placementLabel: location?.display_text ?? 'Локация уточняется',
  }
}

function normalizeTags(tags: string[] | undefined) {
  const safeTags = tags ?? []
  const levels = safeTags
    .filter((tag) => levelTags.some((level) => level.toLowerCase() === tag.toLowerCase()))
    .map((tag) => levelTags.find((level) => level.toLowerCase() === tag.toLowerCase()) ?? tag)

  return {
    levels: levels as Opportunity['levels'],
    technologies: safeTags.filter(
      (tag) => !levels.some((level) => level.toLowerCase() === tag.toLowerCase()),
    ) as Opportunity['technologies'],
  }
}

function normalizeOpportunity(
  opportunity: BackendOpportunity,
  locationsById: Record<string, BackendLocation>,
): Opportunity {
  const tagGroups = normalizeTags(opportunity.tags)

  return {
    id: opportunity.id,
    title: opportunity.title,
    summary: opportunity.short_description || opportunity.full_description || 'Описание появится позже.',
    companyId: opportunity.company_id ?? '',
    companyName: opportunity.company_name ?? 'Компания',
    companyDescription: '',
    companyWebsite: '',
    type: (opportunity.opportunity_type as Opportunity['type']) || 'vacancy',
    workFormat: (opportunity.work_format as Opportunity['workFormat']) || 'remote',
    location: normalizeLocation(opportunity, locationsById),
    publishedAt: opportunity.published_at ?? new Date().toISOString(),
    expiresAt: opportunity.expires_at ?? new Date().toISOString(),
    salaryFrom: opportunity.salary_min,
    salaryTo: opportunity.salary_max,
    technologies: tagGroups.technologies,
    levels: tagGroups.levels,
    employment: normalizeEmploymentType(opportunity.employment_type),
    contacts: opportunity.contacts_info ? [opportunity.contacts_info] : [],
    resources: [],
    media: [],
    status:
      opportunity.status === 'closed'
        ? 'closed'
        : opportunity.status === 'draft'
          ? 'planned'
          : 'active',
  }
}

function normalizeOpportunityDetails(
  opportunity: BackendOpportunity,
  locationsById: Record<string, BackendLocation>,
): OpportunityDetails {
  const base = normalizeOpportunity(opportunity, locationsById)

  return {
    ...base,
    fullDescription: opportunity.full_description || base.summary,
    applicationsCount: opportunity.applications_count ?? 0,
    favoritesCount: opportunity.favorites_count ?? 0,
    viewsCount: opportunity.views_count ?? 0,
  }
}

export async function login(email: string, password: string) {
  const data = await request<AuthResponse>({
    method: 'post',
    url: '/auth/login',
    data: { email, password },
  })

  return normalizeAuth(data)
}

export async function loginCurator(email: string, password: string) {
  const data = await request<AuthResponse>({
    method: 'post',
    url: '/auth/curator/login',
    data: { email, password },
  })

  return normalizeAuth(data)
}

export async function register(payload: RegisterInput) {
  const data = await request<AuthResponse>({
    method: 'post',
    url: '/auth/register',
    data: payload,
  })

  return normalizeAuth(data)
}

export async function fetchCurrentUser() {
  return request<CurrentUserData>({
    method: 'get',
    url: '/me',
  })
}

export async function uploadMyAvatar(file: File) {
  const formData = new FormData()
  formData.append('file', file)

  const data = await request<AvatarUploadResponse>({
    method: 'put',
    url: '/me/avatar',
    data: formData,
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })

  return data
}

export async function fetchPublicCatalog(): Promise<PublicCatalog> {
  const [opportunitiesRaw, tagsRaw, locationsRaw] = await Promise.all([
    request<BackendOpportunity[]>({ method: 'get', url: '/opportunities' }),
    request<BackendTag[]>({ method: 'get', url: '/tags' }),
    request<BackendLocation[]>({ method: 'get', url: '/locations' }),
  ])

  const opportunities = asArray<BackendOpportunity>(opportunitiesRaw)
  const tags = asArray<BackendTag>(tagsRaw)
  const locations = asArray<BackendLocation>(locationsRaw)

  const locationsById = createLocationMap(locations)

  return {
    opportunities: opportunities.map((item) => normalizeOpportunity(item, locationsById)),
    tags,
    locations,
  }
}

export async function fetchStudentProfile() {
  return request<StudentProfileDto>({
    method: 'get',
    url: '/me/student-profile',
  })
}

export async function fetchOpportunityById(id: string) {
  const [opportunity, locations] = await Promise.all([
    request<BackendOpportunity>({
      method: 'get',
      url: `/opportunities/${id}`,
    }),
    request<BackendLocation[]>({
      method: 'get',
      url: '/locations',
    }),
  ])

  const locationsById = createLocationMap(asArray<BackendLocation>(locations))

  return normalizeOpportunityDetails(opportunity, locationsById)
}

export async function applyToOpportunity(
  id: string,
  payload: {
    cover_letter?: string
    resume_id?: string
  },
) {
  return request<Record<string, unknown>>({
    method: 'post',
    url: `/opportunities/${id}/applications`,
    data: payload,
  })
}

export async function fetchMyApplications() {
  const data = await request<ApplicationDto[]>({
    method: 'get',
    url: '/me/applications',
  })

  return asArray<ApplicationDto>(data)
}

export async function fetchFavoriteOpportunities() {
  const [favoritesRaw, locationsRaw] = await Promise.all([
    request<BackendOpportunity[]>({
      method: 'get',
      url: '/me/favorite-opportunities',
    }),
    request<BackendLocation[]>({
      method: 'get',
      url: '/locations',
    }),
  ])

  const favorites = asArray<BackendOpportunity>(favoritesRaw)
  const locations = asArray<BackendLocation>(locationsRaw)

  const locationsById = createLocationMap(locations)

  return favorites.map((item) => normalizeOpportunity(item, locationsById))
}

export async function fetchResumes() {
  const data = await request<ResumeDto[]>({
    method: 'get',
    url: '/me/resumes',
  })

  return asArray<ResumeDto>(data)
}

export async function fetchPortfolioProjects() {
  const data = await request<PortfolioProjectDto[]>({
    method: 'get',
    url: '/me/portfolio-projects',
  })

  return asArray<PortfolioProjectDto>(data)
}

export async function fetchContacts() {
  const data = await request<ContactDto[]>({
    method: 'get',
    url: '/me/contacts',
  })

  return asArray<ContactDto>(data)
}

export async function fetchContactRequests() {
  const data = await request<ContactDto[]>({
    method: 'get',
    url: '/me/contact-requests',
  })

  return asArray<ContactDto>(data)
}

export async function fetchNotifications() {
  const data = await request<NotificationDto[] | null>({
    method: 'get',
    url: '/me/notifications',
  })

  return asArray<NotificationDto>(data)
}

export async function fetchEmployerCompany() {
  return request<EmployerCompanyDto>({
    method: 'get',
    url: '/employer/company',
  })
}

export async function updateEmployerCompany(payload: EmployerCompanyInput) {
  return request<EmployerCompanyDto>({
    method: 'put',
    url: '/employer/company',
    data: payload,
  })
}

export async function submitEmployerVerification(payload: VerificationInput) {
  return request<VerificationDto>({
    method: 'post',
    url: '/employer/company-verifications',
    data: payload,
  })
}

export async function fetchEmployerOpportunities() {
  const [opportunitiesRaw, locationsRaw] = await Promise.all([
    request<BackendOpportunity[]>({
      method: 'get',
      url: '/employer/opportunities',
    }),
    request<BackendLocation[]>({
      method: 'get',
      url: '/locations',
    }),
  ])

  const opportunities = asArray<BackendOpportunity>(opportunitiesRaw)
  const locations = asArray<BackendLocation>(locationsRaw)

  const locationsById = createLocationMap(locations)

  return opportunities.map((item) => normalizeOpportunity(item, locationsById))
}

export async function createEmployerOpportunity(payload: OpportunityCreateInput) {
  return request<BackendOpportunity>({
    method: 'post',
    url: '/employer/opportunities',
    data: payload,
  })
}

export async function fetchCuratorModerationQueue() {
  const data = await request<ModerationQueueItemDto[]>({
    method: 'get',
    url: '/curator/moderation-queue',
  })

  return asArray<ModerationQueueItemDto>(data)
}

export async function fetchCuratorCompanyVerifications() {
  const data = await request<VerificationDto[]>({
    method: 'get',
    url: '/curator/company-verifications',
  })

  return asArray<VerificationDto>(data)
}

export async function fetchCuratorCompanyById(id: string) {
  return request<EmployerCompanyDto>({
    method: 'get',
    url: `/curator/companies/${id}`,
  })
}

export async function fetchCompanyRegistryByInn(inn: string) {
  const dadataToken = import.meta.env.VITE_DADATA_TOKEN
  const dadataUrl =
    import.meta.env.VITE_DADATA_PARTY_API_URL ??
    'https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party'

  if (!dadataToken) {
    throw new Error('Не задан VITE_DADATA_TOKEN для проверки компании по ИНН через DaData.')
  }

  const response = await axios.post<{ suggestions?: Array<Record<string, unknown>> }>(
    dadataUrl,
    { query: inn },
    {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Token ${dadataToken}`,
      },
    },
  )

  const suggestion = response.data?.suggestions?.[0] as
    | {
        value?: string
        unrestricted_value?: string
        data?: {
          inn?: string
          ogrn?: string
          kpp?: string
          employee_count?: number
          okved?: string
          emails?: Array<{ value?: string }>
          phones?: Array<{ value?: string }>
          state?: {
            status?: string
            registration_date?: number
          }
          name?: {
            full_with_opf?: string
            short_with_opf?: string
          }
          management?: {
            name?: string
            post?: string
          }
          address?: {
            value?: string
            unrestricted_value?: string
          }
        }
      }
    | undefined

  if (!suggestion?.data) {
    throw new Error('Внешний сервис не вернул данные организации по этому ИНН.')
  }

  const registry = suggestion.data

  return {
    inn: registry.inn,
    full_name: registry.name?.full_with_opf || suggestion.unrestricted_value || suggestion.value,
    short_name: registry.name?.short_with_opf || suggestion.value,
    status: registry.state?.status,
    address: registry.address?.unrestricted_value || registry.address?.value,
    ogrn: registry.ogrn,
    kpp: registry.kpp,
    registration_date: registry.state?.registration_date
      ? new Date(registry.state.registration_date).toISOString()
      : undefined,
    okved: registry.okved,
    management_name: registry.management?.name,
    management_post: registry.management?.post,
    email: registry.emails?.[0]?.value,
    phone: registry.phones?.[0]?.value,
    employee_count: registry.employee_count,
    source: 'DaData',
  }
}

export async function reviewCuratorCompanyVerification(
  id: string,
  payload: VerificationReviewInput,
) {
  return request<VerificationDto>({
    method: 'patch',
    url: `/curator/company-verifications/${id}`,
    data: payload,
  })
}

export async function fetchCuratorAuditLogs() {
  const data = await request<AuditLogDto[]>({
    method: 'get',
    url: '/curator/audit-logs',
  })

  return asArray<AuditLogDto>(data)
}

export function getRoleFromCurrentUser(payload: CurrentUserData) {
  return normalizeRole(payload.roles?.[0])
}

export function getPlatformUserFromCurrentUser(payload: CurrentUserData) {
  return normalizeUser(payload.user, payload.roles?.[0])
}
