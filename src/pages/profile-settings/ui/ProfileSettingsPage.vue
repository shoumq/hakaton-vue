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
        display_name: studentForm.displayName.trim() || undefined,
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
      session.patchCurrentUser({
        displayName:
          studentProfile.value?.display_name ||
          session.currentUser.value?.displayName ||
          '',
      })
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
        <div class="hero-orb hero-orb-primary" aria-hidden="true" />
        <div class="hero-orb hero-orb-secondary" aria-hidden="true" />

        <div class="hero-copy">
          <p class="eyebrow">Profile Settings</p>
          <h1>{{ pageTitle }}</h1>
          <p class="hero-text">{{ pageDescription }}</p>
          <div class="hero-facts">
            <div v-for="fact in overviewFacts" :key="fact.label" class="hero-fact-chip">
              <span>{{ fact.label }}</span>
              <strong>{{ fact.value }}</strong>
            </div>
          </div>
          <div class="hero-actions">
            <RouterLink to="/notifications" class="ghost-button">Уведомления</RouterLink>
            <RouterLink
              :to="isEmployer ? '/dashboard/employer' : isStudent ? '/dashboard/applicant' : '/'"
              class="ghost-button"
            >
              Назад
            </RouterLink>
          </div>
        </div>

        <aside class="avatar-panel">
          <div class="profile-badge">
            <div class="avatar-shell">
              <img
                v-if="currentAvatarUrl"
                :src="currentAvatarUrl"
                alt="Аватар"
                class="avatar-image"
              />
              <span v-else class="avatar-fallback">{{ avatarFallback }}</span>
            </div>
            <div class="profile-badge-copy">
              <span class="profile-badge-label">{{ isEmployer ? 'Карточка компании' : 'Личный профиль' }}</span>
              <strong>{{ isEmployer ? companyForm.brandName || companyForm.legalName || 'Без названия' : studentForm.displayName || session.currentUser.value?.displayName || 'Без имени' }}</strong>
              <p>
                {{ isEmployer ? 'Обновите описание, бренд и ключевые реквизиты.' : 'Поддерживайте профиль актуальным для откликов и контактов.' }}
              </p>
            </div>
          </div>
          <div class="avatar-actions">
            <label class="secondary-button upload-button">
              <input type="file" accept="image/*" @change="handleAvatarChange" />
              {{ isUploadingAvatar ? 'Загрузка...' : 'Изменить фото' }}
            </label>
            <p class="avatar-hint">PNG, JPG или WEBP. Лучше квадратное изображение.</p>
          </div>
          <p v-if="avatarError" class="inline-error">{{ avatarError }}</p>
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
        <div v-if="isStudent" class="form-layout">
          <section class="form-section">
            <div class="section-heading">
              <p class="section-kicker">Identity</p>
              <h2>Основная информация</h2>
              <p>Базовые данные, по которым вас видят внутри платформы.</p>
            </div>
            <div class="settings-grid">
              <label class="field">
                <span>Отображаемое имя</span>
                <input v-model="studentForm.displayName" type="text" placeholder="Как показывать вас в профиле" />
              </label>
              <label class="field">
                <span>Имя</span>
                <input v-model="studentForm.firstName" type="text" placeholder="Алексей" />
              </label>
              <label class="field">
                <span>Фамилия</span>
                <input v-model="studentForm.lastName" type="text" placeholder="Иванов" />
              </label>
              <label class="field">
                <span>Отчество</span>
                <input v-model="studentForm.middleName" type="text" placeholder="Необязательно" />
              </label>
              <label class="field">
                <span>Университет</span>
                <input v-model="studentForm.universityName" type="text" placeholder="РЭУ им. Г.В. Плеханова" />
              </label>
              <label class="field">
                <span>Факультет</span>
                <input v-model="studentForm.faculty" type="text" placeholder="Высшая школа..." />
              </label>
              <label class="field">
                <span>Специализация</span>
                <input v-model="studentForm.specialization" type="text" placeholder="Маркетинг, аналитика, дизайн" />
              </label>
              <label class="field">
                <span>Курс</span>
                <input v-model="studentForm.studyYear" type="number" min="1" placeholder="3" />
              </label>
              <label class="field">
                <span>Год выпуска</span>
                <input v-model="studentForm.graduationYear" type="number" min="2020" placeholder="2027" />
              </label>
              <label class="field field-wide">
                <span>О себе</span>
                <textarea v-model="studentForm.about" rows="5" placeholder="Кратко опишите интересы, сильные стороны и карьерный фокус" />
              </label>
            </div>
          </section>

          <section class="form-section">
            <div class="section-heading">
              <p class="section-kicker">Contacts</p>
              <h2>Контакты и ссылки</h2>
              <p>Добавьте каналы связи и публичные профили.</p>
            </div>
            <div class="settings-grid">
              <label class="field">
                <span>Telegram</span>
                <input v-model="studentForm.telegram" type="text" placeholder="@username" />
              </label>
              <label class="field">
                <span>GitHub</span>
                <input v-model="studentForm.githubUrl" type="url" placeholder="https://github.com/username" />
              </label>
              <label class="field">
                <span>LinkedIn</span>
                <input v-model="studentForm.linkedinUrl" type="url" placeholder="https://linkedin.com/in/username" />
              </label>
              <label class="field">
                <span>Сайт</span>
                <input v-model="studentForm.websiteUrl" type="url" placeholder="https://example.com" />
              </label>
            </div>
          </section>

          <section class="form-section">
            <div class="section-heading">
              <p class="section-kicker">Privacy</p>
              <h2>Видимость профиля</h2>
              <p>Настройте, кто увидит ваш профиль и связанные данные.</p>
            </div>
            <div class="settings-grid privacy-grid">
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
                <small>Разрешает отображение резюме в профиле.</small>
              </label>
              <label class="toggle-field">
                <input v-model="studentForm.showApplications" type="checkbox" />
                <span>Показывать отклики</span>
                <small>Показывает связанную активность внутри платформы.</small>
              </label>
              <label class="toggle-field">
                <input v-model="studentForm.showCareerInterests" type="checkbox" />
                <span>Показывать карьерные интересы</span>
                <small>Помогает работодателям точнее понимать ваши цели.</small>
              </label>
            </div>
          </section>
        </div>

        <div v-else class="form-layout">
          <section class="form-section">
            <div class="section-heading">
              <p class="section-kicker">Brand</p>
              <h2>Образ компании</h2>
              <p>Оформите карточку компании так, как её увидят соискатели и кураторы.</p>
            </div>
            <div class="settings-grid">
              <label class="field">
                <span>Юридическое название</span>
                <input v-model="companyForm.legalName" type="text" placeholder="Полное юридическое наименование" />
              </label>
              <label class="field">
                <span>Бренд</span>
                <input v-model="companyForm.brandName" type="text" placeholder="Короткое и узнаваемое имя" />
              </label>
              <label class="field field-wide">
                <span>Описание</span>
                <textarea v-model="companyForm.description" rows="6" placeholder="Чем занимается компания, что важно знать кандидатам и партнёрам" />
              </label>
            </div>
          </section>

          <section class="form-section">
            <div class="section-heading">
              <p class="section-kicker">Details</p>
              <h2>Реквизиты и факты</h2>
              <p>Основные сведения для верификации и карточки работодателя.</p>
            </div>
            <div class="settings-grid">
              <label class="field">
                <span>Индустрия</span>
                <input v-model="companyForm.industry" type="text" placeholder="EdTech, FinTech, Retail..." />
              </label>
              <label class="field">
                <span>Сайт</span>
                <input v-model="companyForm.website" type="url" placeholder="https://company.ru" />
              </label>
              <label class="field">
                <span>Размер компании</span>
                <input v-model="companyForm.companySize" type="text" placeholder="50-100 сотрудников" />
              </label>
              <label class="field">
                <span>Год основания</span>
                <input v-model="companyForm.foundedYear" type="number" min="1900" placeholder="2014" />
              </label>
              <label class="field field-wide">
                <span>ИНН</span>
                <input v-model="companyForm.inn" type="text" placeholder="7705043493" />
              </label>
            </div>
          </section>
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
  max-width: 1180px;
  margin: 0 auto;
  display: grid;
  gap: 18px;
}

.settings-hero,
.settings-card,
.status-banner {
  border: 1px solid rgba(18, 38, 63, 0.08);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 22px 56px rgba(15, 23, 42, 0.07);
}

.settings-hero {
  position: relative;
  overflow: hidden;
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(280px, 360px);
  gap: 24px;
  padding: 28px;
  background:
    radial-gradient(circle at top left, rgba(42, 89, 255, 0.14), transparent 34%),
    radial-gradient(circle at bottom right, rgba(31, 191, 162, 0.12), transparent 28%),
    linear-gradient(180deg, #ffffff 0%, #f5f8fe 100%);
}

.hero-copy,
.avatar-panel {
  display: grid;
  gap: 16px;
  align-content: start;
}

.hero-copy {
  position: relative;
  z-index: 1;
  gap: 18px;
  align-content: start;
}

.eyebrow {
  margin: 0;
  color: #2952cc;
  font: 700 0.72rem/1 var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.16em;
}

h1 {
  margin: 0;
  font-family: var(--font-heading);
  font-size: clamp(2.2rem, 4vw, 3.5rem);
  line-height: 0.96;
  letter-spacing: -0.04em;
  max-width: 12ch;
}

.hero-text {
  margin: 0;
  max-width: 58ch;
  color: #5f6b7a;
  line-height: 1.6;
  font-size: 1rem;
}

.hero-facts {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.hero-fact-chip {
  min-width: 170px;
  padding: 14px 16px;
  border: 1px solid rgba(18, 38, 63, 0.08);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(10px);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.55);
}

.hero-fact-chip span {
  display: block;
  margin-bottom: 6px;
  color: #6b7686;
  font-size: 0.76rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.hero-fact-chip strong {
  color: #132033;
  font-size: 0.96rem;
  line-height: 1.4;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.avatar-panel {
  position: relative;
  z-index: 1;
  padding: 20px;
  border: 1px solid rgba(18, 38, 63, 0.08);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(12px);
}

.profile-badge {
  display: grid;
  gap: 16px;
}

.profile-badge-copy {
  display: grid;
  gap: 8px;
}

.profile-badge-label {
  color: #2952cc;
  font-size: 0.76rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.profile-badge-copy strong {
  color: #162033;
  font-family: var(--font-heading);
  font-size: 1.2rem;
  line-height: 1.15;
}

.profile-badge-copy p {
  margin: 0;
  color: #667386;
  line-height: 1.55;
  font-size: 0.94rem;
}

.avatar-shell {
  display: grid;
  place-items: center;
  width: 110px;
  height: 110px;
  overflow: hidden;
  border-radius: 28px;
  background:
    radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.34), transparent 30%),
    linear-gradient(135deg, #1d3fa5 0%, #2f67ff 55%, #6fd1ff 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.25),
    0 22px 40px rgba(47, 103, 255, 0.22);
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
  font: 700 1.5rem/1 var(--font-heading);
  color: #fff;
}

.avatar-actions {
  display: grid;
  gap: 10px;
}

.avatar-hint {
  margin: 0;
  color: #758196;
  font-size: 0.82rem;
  line-height: 1.5;
}

.settings-card {
  display: grid;
  gap: 24px;
  padding: 28px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(247, 249, 252, 0.95));
}

.form-layout {
  display: grid;
  gap: 18px;
}

.form-section {
  display: grid;
  gap: 16px;
  padding: 22px;
  border: 1px solid rgba(18, 38, 63, 0.08);
  border-radius: 22px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(250, 251, 254, 0.92));
}

.section-heading {
  display: grid;
  gap: 6px;
}

.section-kicker {
  margin: 0;
  color: #2952cc;
  font: 700 0.72rem/1 var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.14em;
}

.section-heading h2 {
  margin: 0;
  color: #162033;
  font-family: var(--font-heading);
  font-size: 1.35rem;
  line-height: 1.05;
}

.section-heading p {
  margin: 0;
  color: #697588;
  line-height: 1.55;
}

.settings-card {
  display: grid;
  gap: 12px;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.field {
  display: grid;
  gap: 8px;
}

.field span {
  color: #4f6077;
  font-size: 0.82rem;
  font-weight: 600;
}

.field input,
.field select,
.field textarea {
  min-height: 48px;
  padding: 0 14px;
  border: 1px solid #d8e0ea;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.96);
  color: #162033;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease;
}

.field input::placeholder,
.field textarea::placeholder {
  color: #9aa5b4;
}

.field input:focus,
.field select:focus,
.field textarea:focus {
  outline: none;
  border-color: rgba(41, 82, 204, 0.38);
  box-shadow: 0 0 0 4px rgba(41, 82, 204, 0.08);
}

.field textarea {
  min-height: 140px;
  padding: 14px;
  resize: vertical;
}

.field-wide {
  grid-column: 1 / -1;
}

.privacy-grid {
  align-items: start;
}

.toggle-field {
  display: grid;
  grid-template-columns: 22px 1fr;
  column-gap: 12px;
  row-gap: 2px;
  min-height: 92px;
  padding: 16px 18px;
  border: 1px solid rgba(18, 38, 63, 0.08);
  border-radius: 16px;
  background: #fbfcfe;
  color: #1d2939;
}

.toggle-field input {
  margin-top: 2px;
  width: 18px;
  height: 18px;
  accent-color: #2952cc;
}

.toggle-field span {
  color: #162033;
  font-weight: 600;
}

.toggle-field small {
  grid-column: 2;
  color: #728095;
  line-height: 1.45;
  font-size: 0.82rem;
}

.form-actions {
  display: flex;
  justify-content: flex-start;
  padding-top: 2px;
}

.secondary-button,
.ghost-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 42px;
  padding: 0 16px;
  border-radius: 14px;
  text-decoration: none;
  font-size: 0.92rem;
  font-weight: 600;
}

.secondary-button,
.ghost-button {
  border: 1px solid rgba(18, 38, 63, 0.08);
  color: #2447b9;
  background: rgba(255, 255, 255, 0.88);
  cursor: pointer;
}

.secondary-button:hover,
.ghost-button:hover {
  border-color: rgba(36, 71, 185, 0.24);
  background: rgba(255, 251, 240, 0.98);
}

.upload-button input {
  display: none;
}

.status-banner {
  margin: 0;
  padding: 14px 18px;
  font-size: 0.94rem;
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

.hero-orb {
  position: absolute;
  border-radius: 999px;
  filter: blur(10px);
  pointer-events: none;
}

.hero-orb-primary {
  top: -72px;
  right: 26%;
  width: 220px;
  height: 220px;
  background: rgba(62, 123, 255, 0.12);
}

.hero-orb-secondary {
  right: -60px;
  bottom: -70px;
  width: 180px;
  height: 180px;
  background: rgba(255, 241, 241, 0.2);
}

@media (max-width: 900px) {
  .settings-hero,
  .settings-grid,
  .privacy-grid {
    grid-template-columns: 1fr;
  }

  .settings-hero,
  .settings-card {
    padding: 18px;
    border-radius: 20px;
  }

  .form-section {
    padding: 18px;
    border-radius: 18px;
  }

  h1 {
    max-width: none;
    font-size: clamp(1.9rem, 9vw, 2.8rem);
  }

  .hero-fact-chip {
    min-width: 0;
    flex: 1 1 100%;
  }

  .avatar-shell {
    width: 96px;
    height: 96px;
  }
}
</style>
