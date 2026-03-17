<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'

import type { Opportunity } from '@/entities/opportunity/model/types'
import { useSession } from '@/features/session/model/session'
import OpportunityCard from '@/entities/opportunity/ui/OpportunityCard.vue'
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
import type { BackendTag, EmployerCompanyDto } from '@/shared/api'

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
  corporateEmail: '',
  inn: '',
  comment: '',
})

const opportunityForm = reactive({
  title: '',
  shortDescription: '',
  fullDescription: '',
  opportunityType: 'internship',
  employmentType: 'part_time',
  workFormat: 'remote',
  locationId: '',
  salaryMin: '',
  salaryMax: '',
  status: 'draft',
  selectedTagIds: [] as string[],
})

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

const technologyAndLevelTags = computed(() =>
  tags.value.filter((tag) => ['technology', 'level'].includes(tag.tag_type)),
)
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
    opportunityForm.locationId = catalogResult.value.locations[0]?.id ?? ''
  } else {
    locations.value = []
    tags.value = []
    opportunityForm.locationId = ''
  }

  companyForm.legalName = companyData.legal_name ?? ''
  companyForm.brandName = companyData.brand_name ?? ''
  companyForm.website = companyData.website_url ?? ''
  companyForm.industry = companyData.industry ?? ''
  companyForm.foundedYear = companyData.founded_year ? String(companyData.founded_year) : ''
  companyForm.inn = companyData.inn ?? ''

  verificationForm.inn = companyData.inn ?? ''
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
      email_domain: verificationForm.corporateEmail.includes('@')
        ? verificationForm.corporateEmail.split('@')[1]
        : undefined,
    })
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
    await submitEmployerVerification({
      corporate_email: verificationForm.corporateEmail.trim(),
      inn_submitted: verificationForm.inn.trim() || undefined,
      verification_method: 'website',
      documents_comment: verificationForm.comment.trim() || undefined,
    })
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
    await createEmployerOpportunity({
      title: opportunityForm.title.trim(),
      short_description: opportunityForm.shortDescription.trim(),
      full_description: opportunityForm.fullDescription.trim(),
      opportunity_type: opportunityForm.opportunityType,
      employment_type: opportunityForm.employmentType,
      work_format: opportunityForm.workFormat,
      location_id: opportunityForm.locationId,
      salary_min: opportunityForm.salaryMin ? Number(opportunityForm.salaryMin) : undefined,
      salary_max: opportunityForm.salaryMax ? Number(opportunityForm.salaryMax) : undefined,
      salary_currency: 'RUB',
      is_salary_visible: true,
      tag_ids: opportunityForm.selectedTagIds,
      status: opportunityForm.status,
    })
    infoMessage.value = 'Карточка возможности создана.'
    opportunityForm.title = ''
    opportunityForm.shortDescription = ''
    opportunityForm.fullDescription = ''
    opportunityForm.salaryMin = ''
    opportunityForm.salaryMax = ''
    opportunityForm.selectedTagIds = []
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
</script>

<template>
  <main class="page-shell">
    <section class="dashboard">
      <div class="dashboard-hero">
        <div>
          <p class="eyebrow">Кабинет работодателя</p>
          <h1>{{ company?.brand_name || company?.legal_name || 'Компания' }}</h1>
          <p class="hero-copy">
            {{ company?.description || 'Заполните профиль компании и отправьте верификацию перед публикацией.' }}
          </p>
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

      <section class="dashboard-grid">
        <article class="section-card">
          <h2>Профиль компании</h2>
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

        <article class="section-card">
          <h2>Верификация компании</h2>
          <form class="editor-grid" @submit.prevent="handleSubmitVerification">
            <label class="field">
              <span>Корпоративная почта</span>
              <input v-model="verificationForm.corporateEmail" type="email" required />
            </label>
            <label class="field">
              <span>ИНН</span>
              <input v-model="verificationForm.inn" type="text" />
            </label>
            <label class="field field-wide">
              <span>Комментарий</span>
              <textarea v-model="verificationForm.comment" rows="4" />
            </label>

            <button class="primary-button" type="submit" :disabled="isSubmittingVerification">
              {{ isSubmittingVerification ? 'Отправляем...' : 'Отправить на проверку' }}
            </button>
          </form>
        </article>
      </section>

      <section class="dashboard-section">
        <h2>Новая возможность</h2>
        <form class="editor-grid opportunity-editor" @submit.prevent="handleCreateOpportunity">
          <label class="field">
            <span>Название</span>
            <input v-model="opportunityForm.title" type="text" required />
          </label>
          <label class="field">
            <span>Тип</span>
            <select v-model="opportunityForm.opportunityType">
              <option value="internship">Стажировка</option>
              <option value="vacancy">Вакансия</option>
              <option value="mentorship">Менторство</option>
              <option value="event">Событие</option>
            </select>
          </label>
          <label class="field">
            <span>Формат</span>
            <select v-model="opportunityForm.workFormat">
              <option value="remote">Удаленно</option>
              <option value="hybrid">Гибрид</option>
              <option value="office">Офис</option>
            </select>
          </label>
          <label class="field">
            <span>Занятость</span>
            <select v-model="opportunityForm.employmentType">
              <option value="full_time">Полная</option>
              <option value="part_time">Частичная</option>
              <option value="project">Проектная</option>
            </select>
          </label>
          <label class="field">
            <span>Локация</span>
            <select v-model="opportunityForm.locationId">
              <option v-for="location in locations" :key="location.id" :value="location.id">
                {{ location.display_text || location.id }}
              </option>
            </select>
          </label>
          <label class="field">
            <span>Статус</span>
            <select v-model="opportunityForm.status">
              <option value="draft">Черновик</option>
              <option value="published">Опубликовать</option>
            </select>
          </label>
          <label class="field field-wide">
            <span>Короткое описание</span>
            <textarea v-model="opportunityForm.shortDescription" rows="3" required />
          </label>
          <label class="field field-wide">
            <span>Полное описание</span>
            <textarea v-model="opportunityForm.fullDescription" rows="5" required />
          </label>
          <label class="field">
            <span>Зарплата от</span>
            <input v-model="opportunityForm.salaryMin" type="number" min="0" />
          </label>
          <label class="field">
            <span>Зарплата до</span>
            <input v-model="opportunityForm.salaryMax" type="number" min="0" />
          </label>
          <label class="field field-wide">
            <span>Теги</span>
            <div class="checkbox-grid">
              <label v-for="tag in technologyAndLevelTags" :key="tag.id" class="checkbox-item">
                <input v-model="opportunityForm.selectedTagIds" type="checkbox" :value="tag.id" />
                <span>{{ tag.name }}</span>
              </label>
            </div>
          </label>

          <button class="primary-button" type="submit" :disabled="isSubmittingOpportunity">
            {{ isSubmittingOpportunity ? 'Создаем...' : 'Создать возможность' }}
          </button>
        </form>
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
  padding: 18px 20px;
  border: 1px solid #d7dee7;
  border-radius: 14px;
  background: var(--surface);
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
}

.dashboard-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 16px;
}

.eyebrow {
  margin: 0;
  color: var(--accent-strong);
  font: 700 0.72rem/1 var(--font-mono);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

h1,
h2 {
  margin: 0;
  font-family: var(--font-heading);
}

h1 {
  font-size: clamp(1.55rem, 3vw, 1.95rem);
}

.hero-copy,
.section-card p,
.verification-card p {
  margin: 0;
  color: var(--muted);
  line-height: 1.5;
  font-size: 0.92rem;
}

.status-banner {
  margin: 0;
  padding: 12px 14px;
  border: 1px solid #d7dee7;
  border-radius: 12px;
  background: var(--surface);
  font-size: 0.9rem;
}

.status-banner.error {
  color: var(--danger);
}

.dashboard-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.verification-card,
.editor-grid {
  display: grid;
  gap: 8px;
  padding: 14px;
  border: 1px solid #e4eaf1;
  border-radius: 10px;
  background: var(--surface-strong);
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
  width: 96px;
  height: 96px;
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
  color: var(--accent-strong);
  font-size: 0.88rem;
  cursor: pointer;
}

.avatar-upload input {
  display: none;
}

.upload-error {
  color: var(--danger);
  font-size: 0.8rem;
}

.editor-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.field {
  display: grid;
  gap: 8px;
}

.field input,
.field select,
.field textarea {
  min-height: 38px;
  padding: 9px 11px;
  border: 1px solid #d7dee7;
  border-radius: 8px;
  font: inherit;
  font-size: 0.9rem;
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
  padding: 7px 9px;
  border: 1px solid #d7dee7;
  border-radius: 999px;
  background: var(--surface);
  font-size: 0.85rem;
}

.primary-button {
  min-height: 38px;
  padding: 0 14px;
  border: 1px solid var(--accent);
  border-radius: 8px;
  color: #fff;
  background: var(--accent);
  font-size: 0.9rem;
}

.primary-button:disabled {
  opacity: 0.65;
  cursor: progress;
}

.opportunity-editor {
  background: transparent;
  padding: 0;
  border: 0;
}

@media (max-width: 900px) {
  .dashboard-hero,
  .dashboard-grid,
  .editor-grid {
    grid-template-columns: 1fr;
  }
}
</style>
