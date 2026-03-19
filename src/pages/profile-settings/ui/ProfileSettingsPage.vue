<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'

import { useSession } from '@/features/session/model/session'
import {
  fetchEmployerCompany,
  fetchStudentProfile,
  getApiErrorMessage,
  updateEmployerCompany,
  updateStudentProfile,
  uploadEmployerCompanyAvatar,
  uploadMyAvatar,
} from '@/shared/api'
import type {
  EmployerCompanyDto,
  EmployerCompanyInput,
  StudentProfileDto,
  StudentProfileInput,
  StudentProfileVisibility,
} from '@/shared/api'

const session = useSession()

const role = ref<'student' | 'employer' | 'curator' | 'guest'>('guest')
const studentProfile = ref<StudentProfileDto | null>(null)
const companyProfile = ref<EmployerCompanyDto | null>(null)
const isLoading = ref(true)
const isSaving = ref(false)
const isUploadingAvatar = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const avatarError = ref('')

const studentVisibilityOptions: Array<{ value: StudentProfileVisibility; label: string }> = [
  { value: 'private', label: 'Приватный' },
  { value: 'contacts_only', label: 'Только контактам' },
  { value: 'authorized_only', label: 'Только авторизованным' },
  { value: 'public_inside_platform', label: 'Публичный внутри платформы' },
]

const studentForm = reactive({
  displayName: '',
  firstName: '',
  lastName: '',
  middleName: '',
  universityName: '',
  faculty: '',
  specialization: '',
  studyYear: '',
  graduationYear: '',
  about: '',
  telegram: '',
  githubUrl: '',
  linkedinUrl: '',
  websiteUrl: '',
  profileVisibility: 'authorized_only' as StudentProfileVisibility,
  showResume: true,
  showApplications: true,
  showCareerInterests: true,
})

const companyForm = reactive({
  legalName: '',
  brandName: '',
  description: '',
  industry: '',
  website: '',
  companySize: '',
  foundedYear: '',
  inn: '',
})

const isStudent = computed(() => role.value === 'student')
const isEmployer = computed(() => role.value === 'employer')
const studentVisibilityLabel = computed(() => {
  return (
    studentVisibilityOptions.find((item) => item.value === studentForm.profileVisibility)?.label ||
    'Только авторизованным'
  )
})
const pageTitle = computed(() => {
  if (isStudent.value) {
    return 'Редактирование профиля'
  }

  if (isEmployer.value) {
    return 'Редактирование компании'
  }

  return 'Настройки аккаунта'
})

const pageDescription = computed(() => {
  if (isStudent.value) {
    return 'Короткая отдельная страница для фото, контактов, приватности и учебного профиля.'
  }

  if (isEmployer.value) {
    return 'Редактируйте только данные компании. Они используются в верификации и публикации возможностей.'
  }

  return 'Для этой роли отдельная форма редактирования пока не настроена.'
})

const overviewFacts = computed(() => {
  if (isStudent.value) {
    return [
      { label: 'Роль', value: 'Студент' },
      { label: 'Университет', value: studentForm.universityName || 'Не указан' },
      { label: 'Приватность', value: studentVisibilityLabel.value },
    ]
  }

  if (isEmployer.value) {
    return [
      { label: 'Роль', value: 'Работодатель' },
      { label: 'Компания', value: companyForm.brandName || companyForm.legalName || 'Не указана' },
      { label: 'ИНН', value: companyForm.inn || 'Не указан' },
    ]
  }

  return [{ label: 'Роль', value: 'Не определена' }]
})

const avatarFallback = computed(() => {
  const source =
    session.currentUser.value?.displayName ||
    companyForm.brandName ||
    studentForm.displayName ||
    session.currentUser.value?.email ||
    'U'

  return source
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
})

const currentAvatarUrl = computed(() => {
  if (isEmployer.value) {
    return companyProfile.value?.avatar_url || ''
  }

  return session.currentUser.value?.avatarUrl || ''
})

function syncStudentForm(profile: StudentProfileDto | null) {
  const normalizedVisibility =
    profile?.profile_visibility === 'public' ? 'public_inside_platform' : profile?.profile_visibility

  studentForm.displayName = profile?.display_name ?? ''
  studentForm.firstName = profile?.first_name ?? ''
  studentForm.lastName = profile?.last_name ?? ''
  studentForm.middleName = profile?.middle_name ?? ''
  studentForm.universityName = profile?.university_name ?? ''
  studentForm.faculty = profile?.faculty ?? ''
  studentForm.specialization = profile?.specialization ?? ''
  studentForm.studyYear = profile?.study_year ? String(profile.study_year) : ''
  studentForm.graduationYear = profile?.graduation_year ? String(profile.graduation_year) : ''
  studentForm.about = profile?.about ?? ''
  studentForm.telegram = profile?.telegram ?? ''
  studentForm.githubUrl = profile?.github_url ?? ''
  studentForm.linkedinUrl = profile?.linkedin_url ?? ''
  studentForm.websiteUrl = profile?.website_url ?? ''
  studentForm.profileVisibility = studentVisibilityOptions.some((item) => item.value === normalizedVisibility)
    ? (normalizedVisibility as StudentProfileVisibility)
    : 'authorized_only'
  studentForm.showResume = profile?.show_resume ?? true
  studentForm.showApplications = profile?.show_applications ?? true
  studentForm.showCareerInterests = profile?.show_career_interests ?? true
}

function normalizeStudentVisibility(value: string): StudentProfileVisibility {
  if (value === 'public') {
    return 'public_inside_platform'
  }

  if (studentVisibilityOptions.some((item) => item.value === value)) {
    return value as StudentProfileVisibility
  }

  return 'authorized_only'
}

function syncCompanyForm(profile: EmployerCompanyDto | null) {
  companyForm.legalName = profile?.legal_name ?? ''
  companyForm.brandName = profile?.brand_name ?? ''
  companyForm.description = profile?.description ?? ''
  companyForm.industry = profile?.industry ?? ''
  companyForm.website = profile?.website_url ?? ''
  companyForm.companySize = profile?.company_size ?? ''
  companyForm.foundedYear = profile?.founded_year ? String(profile.founded_year) : ''
  companyForm.inn = profile?.inn ?? ''
}

async function loadPage() {
  isLoading.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const me = await session.refreshCurrentUser()
    role.value = me.role

    if (me.role === 'student') {
      studentProfile.value = await fetchStudentProfile()
      syncStudentForm(studentProfile.value)
      companyProfile.value = null
      return
    }

    if (me.role === 'employer') {
      companyProfile.value = await fetchEmployerCompany()
      syncCompanyForm(companyProfile.value)
      studentProfile.value = null
      return
    }

    studentProfile.value = null
    companyProfile.value = null
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, 'Не удалось загрузить настройки профиля.')
  } finally {
    isLoading.value = false
  }
}

async function handleAvatarChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  if (!file) {
    return
  }

  isUploadingAvatar.value = true
  avatarError.value = ''

  try {
    if (isEmployer.value) {
      companyProfile.value = await uploadEmployerCompanyAvatar(file)
      syncCompanyForm(companyProfile.value)
      return
    }

    const user = await uploadMyAvatar(file)
    session.patchCurrentUser({
      displayName: user.display_name || session.currentUser.value?.displayName || user.email,
      avatarUrl: user.avatar_url,
    })
  } catch (error) {
    avatarError.value = getApiErrorMessage(error, 'Не удалось загрузить аватар.')
  } finally {
    isUploadingAvatar.value = false
    input.value = ''
  }
}

async function handleSave() {
  isSaving.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    if (isStudent.value) {
      const profileVisibility = normalizeStudentVisibility(studentForm.profileVisibility)

      studentProfile.value = await updateStudentProfile({
        first_name: studentForm.firstName.trim() || undefined,
        last_name: studentForm.lastName.trim() || undefined,
        middle_name: studentForm.middleName.trim() || undefined,
        university_name: studentForm.universityName.trim() || undefined,
        faculty: studentForm.faculty.trim() || undefined,
        specialization: studentForm.specialization.trim() || undefined,
        study_year: studentForm.studyYear ? Number(studentForm.studyYear) : undefined,
        graduation_year: studentForm.graduationYear ? Number(studentForm.graduationYear) : undefined,
        about: studentForm.about.trim() || undefined,
        telegram: studentForm.telegram.trim() || undefined,
        github_url: studentForm.githubUrl.trim() || undefined,
        linkedin_url: studentForm.linkedinUrl.trim() || undefined,
        website_url: studentForm.websiteUrl.trim() || undefined,
        profile_visibility: profileVisibility,
        show_resume: studentForm.showResume,
        show_applications: studentForm.showApplications,
        show_career_interests: studentForm.showCareerInterests,
      } satisfies StudentProfileInput)
      syncStudentForm(studentProfile.value)
      successMessage.value = 'Профиль соискателя сохранен.'
      return
    }

    if (isEmployer.value) {
      companyProfile.value = await updateEmployerCompany({
        legal_name: companyForm.legalName.trim() || undefined,
        brand_name: companyForm.brandName.trim() || undefined,
        description: companyForm.description.trim() || undefined,
        industry: companyForm.industry.trim() || undefined,
        website_url: companyForm.website.trim() || undefined,
        company_size: companyForm.companySize.trim() || undefined,
        founded_year: companyForm.foundedYear ? Number(companyForm.foundedYear) : undefined,
        inn: companyForm.inn.trim() || undefined,
      } satisfies EmployerCompanyInput)
      syncCompanyForm(companyProfile.value)
      session.patchCurrentUser({
        displayName: companyProfile.value.brand_name || companyProfile.value.legal_name || session.currentUser.value?.displayName || '',
      })
      successMessage.value = 'Данные компании сохранены.'
      return
    }

    errorMessage.value = 'Для этой роли редактирование профиля не настроено.'
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, 'Не удалось сохранить изменения.')
  } finally {
    isSaving.value = false
  }
}

onMounted(loadPage)
</script>

<template>
  <main class="page-shell">
    <section class="profile-settings-page">
      <header class="settings-hero">
        <div class="hero-copy">
          <p class="eyebrow">Profile Settings</p>
          <h1>{{ pageTitle }}</h1>
          <p class="hero-text">{{ pageDescription }}</p>
          <div class="hero-actions">
            <RouterLink to="/notifications" class="secondary-button">Уведомления</RouterLink>
            <RouterLink
              :to="isEmployer ? '/dashboard/employer' : isStudent ? '/dashboard/applicant' : '/'"
              class="secondary-button"
            >
              Назад
            </RouterLink>
          </div>
        </div>

        <aside class="avatar-panel">
          <div class="avatar-shell">
            <img
              v-if="currentAvatarUrl"
              :src="currentAvatarUrl"
              alt="Аватар"
              class="avatar-image"
            />
            <span v-else class="avatar-fallback">{{ avatarFallback }}</span>
          </div>
          <label class="secondary-button upload-button">
            <input type="file" accept="image/*" @change="handleAvatarChange" />
            {{ isUploadingAvatar ? 'Загрузка...' : 'Изменить фото' }}
          </label>
          <p v-if="avatarError" class="inline-error">{{ avatarError }}</p>
          <div class="facts-strip">
            <div v-for="fact in overviewFacts" :key="fact.label" class="fact-item">
              <span>{{ fact.label }}</span>
              <strong>{{ fact.value }}</strong>
            </div>
          </div>
        </aside>
      </header>

      <p v-if="errorMessage" class="status-banner error">{{ errorMessage }}</p>
      <p v-else-if="successMessage" class="status-banner success">{{ successMessage }}</p>
      <p v-else-if="isLoading" class="status-banner">Загружаем данные профиля...</p>

      <form
        v-if="!isLoading && (isStudent || isEmployer)"
        class="settings-card"
        @submit.prevent="handleSave"
      >
        <div v-if="isStudent" class="settings-grid">
          <label class="field">
            <span>Отображаемое имя</span>
            <input v-model="studentForm.displayName" type="text" />
          </label>
          <label class="field">
            <span>Имя</span>
            <input v-model="studentForm.firstName" type="text" />
          </label>
          <label class="field">
            <span>Фамилия</span>
            <input v-model="studentForm.lastName" type="text" />
          </label>
          <label class="field">
            <span>Отчество</span>
            <input v-model="studentForm.middleName" type="text" />
          </label>
          <label class="field">
            <span>Университет</span>
            <input v-model="studentForm.universityName" type="text" />
          </label>
          <label class="field">
            <span>Факультет</span>
            <input v-model="studentForm.faculty" type="text" />
          </label>
          <label class="field">
            <span>Специализация</span>
            <input v-model="studentForm.specialization" type="text" />
          </label>
          <label class="field">
            <span>Курс</span>
            <input v-model="studentForm.studyYear" type="number" min="1" />
          </label>
          <label class="field">
            <span>Год выпуска</span>
            <input v-model="studentForm.graduationYear" type="number" min="2020" />
          </label>
          <label class="field">
            <span>Telegram</span>
            <input v-model="studentForm.telegram" type="text" />
          </label>
          <label class="field">
            <span>GitHub</span>
            <input v-model="studentForm.githubUrl" type="url" />
          </label>
          <label class="field">
            <span>LinkedIn</span>
            <input v-model="studentForm.linkedinUrl" type="url" />
          </label>
          <label class="field field-wide">
            <span>Сайт</span>
            <input v-model="studentForm.websiteUrl" type="url" />
          </label>
          <label class="field field-wide">
            <span>О себе</span>
            <textarea v-model="studentForm.about" rows="5" />
          </label>
          <label class="field">
            <span>Видимость профиля</span>
            <select v-model="studentForm.profileVisibility">
              <option v-for="option in studentVisibilityOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </label>
          <label class="toggle-field">
            <input v-model="studentForm.showResume" type="checkbox" />
            <span>Показывать резюме</span>
          </label>
          <label class="toggle-field">
            <input v-model="studentForm.showApplications" type="checkbox" />
            <span>Показывать отклики</span>
          </label>
          <label class="toggle-field">
            <input v-model="studentForm.showCareerInterests" type="checkbox" />
            <span>Показывать карьерные интересы</span>
          </label>
        </div>

        <div v-else class="settings-grid">
          <label class="field">
            <span>Юридическое название</span>
            <input v-model="companyForm.legalName" type="text" />
          </label>
          <label class="field">
            <span>Бренд</span>
            <input v-model="companyForm.brandName" type="text" />
          </label>
          <label class="field field-wide">
            <span>Описание</span>
            <textarea v-model="companyForm.description" rows="5" />
          </label>
          <label class="field">
            <span>Индустрия</span>
            <input v-model="companyForm.industry" type="text" />
          </label>
          <label class="field">
            <span>Сайт</span>
            <input v-model="companyForm.website" type="url" />
          </label>
          <label class="field">
            <span>Размер компании</span>
            <input v-model="companyForm.companySize" type="text" />
          </label>
          <label class="field">
            <span>Год основания</span>
            <input v-model="companyForm.foundedYear" type="number" min="1900" />
          </label>
          <label class="field">
            <span>ИНН</span>
            <input v-model="companyForm.inn" type="text" />
          </label>
        </div>

        <div class="form-actions">
          <button class="primary-button" type="submit" :disabled="isSaving">
            {{ isSaving ? 'Сохраняем...' : 'Сохранить изменения' }}
          </button>
        </div>
      </form>

      <article v-else-if="!isLoading" class="settings-card muted-card">
        <strong>Для этой роли отдельная форма пока не доступна.</strong>
      </article>
    </section>
  </main>
</template>

<style scoped>
.profile-settings-page {
  max-width: 980px;
  margin: 0 auto;
  display: grid;
  gap: 14px;
}

.settings-hero,
.settings-card,
.status-banner {
  border: 1px solid rgba(18, 38, 63, 0.08);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 10px 22px rgba(15, 23, 42, 0.045);
}

.settings-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 260px;
  gap: 18px;
  padding: 18px;
}

.hero-copy,
.avatar-panel,
.settings-card {
  display: grid;
  gap: 12px;
}

.avatar-panel {
  justify-items: start;
  align-content: start;
}

.eyebrow {
  margin: 0;
  color: var(--accent-strong);
  font: 700 0.72rem/1 var(--font-mono);
  text-transform: uppercase;
}

h1 {
  margin: 0;
  font-family: var(--font-heading);
  font-size: clamp(1.6rem, 3vw, 2.2rem);
  line-height: 1.1;
}

.hero-text {
  margin: 0;
  color: var(--muted);
  line-height: 1.6;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.avatar-shell {
  width: 84px;
  height: 84px;
  overflow: hidden;
  border-radius: 10px;
  background: linear-gradient(180deg, #eff4f9, #dde7f2);
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
  font: 700 1.2rem/1 var(--font-heading);
  color: var(--accent-strong);
}

.upload-button input {
  display: none;
}

.facts-strip {
  display: grid;
  width: 100%;
  gap: 8px;
}

.fact-item {
  display: grid;
  gap: 4px;
  width: 100%;
  padding: 10px 11px;
  border: 1px solid #dbe4ef;
  border-radius: 10px;
  background: #f8fafd;
}

.fact-item span {
  color: #5f6b7a;
  font-size: 0.78rem;
}

.fact-item strong {
  color: #162033;
  font-size: 0.9rem;
  line-height: 1.35;
}

.settings-card {
  padding: 18px;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.field {
  display: grid;
  gap: 8px;
}

.field span {
  color: #526581;
  font-size: 0.82rem;
  font-weight: 600;
}

.field input,
.field select,
.field textarea {
  min-height: 40px;
  padding: 0 11px;
  border: 1px solid #d7dee7;
  border-radius: 8px;
  background: #fff;
}

.field textarea {
  min-height: 112px;
  padding: 11px;
  resize: vertical;
}

.field-wide {
  grid-column: 1 / -1;
}

.toggle-field {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-height: 42px;
  color: #1d2939;
}

.toggle-field input {
  width: 18px;
  height: 18px;
}

.form-actions {
  display: flex;
  justify-content: flex-start;
  padding-top: 6px;
}

.secondary-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 36px;
  padding: 0 13px;
  border-radius: 8px;
  text-decoration: none;
  font-size: 0.9rem;
}

.secondary-button {
  border: 1px solid var(--border);
  color: var(--accent-strong);
  background: var(--surface);
  cursor: pointer;
}

.status-banner {
  margin: 0;
  padding: 11px 13px;
  font-size: 0.92rem;
}

.status-banner.error,
.inline-error {
  color: var(--danger);
}

.status-banner.success {
  color: var(--success);
}

.muted-card strong {
  color: var(--muted);
}

@media (max-width: 900px) {
  .settings-hero,
  .settings-grid {
    grid-template-columns: 1fr;
  }

  .settings-hero,
  .settings-card {
    padding: 16px;
    border-radius: 12px;
  }
}
</style>
