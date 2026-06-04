<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'

import { useSession } from '@/features/session/model/session'
import ResumeManager from '@/features/resume/ui/ResumeManager.vue'
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
const studentVisibilityLabel = computed(
  () => studentVisibilityOptions.find((o) => o.value === studentForm.profileVisibility)?.label ?? 'Только авторизованным',
)
const pageTitle = computed(() =>
  isStudent.value ? 'Настройки профиля' : isEmployer.value ? 'Настройки компании' : 'Настройки аккаунта',
)

const avatarFallback = computed(() => {
  const source =
    session.currentUser.value?.displayName ||
    companyForm.brandName ||
    [studentForm.firstName, studentForm.lastName].filter(Boolean).join(' ') ||
    session.currentUser.value?.email ||
    'U'
  return source.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()
})

const currentAvatarUrl = computed(() =>
  isEmployer.value ? companyProfile.value?.avatar_url || '' : session.currentUser.value?.avatarUrl || '',
)

const profileName = computed(() =>
  isEmployer.value
    ? companyForm.brandName || companyForm.legalName || 'Без названия'
    : [studentForm.firstName, studentForm.lastName].filter(Boolean).join(' ') ||
      studentForm.displayName ||
      session.currentUser.value?.displayName ||
      'Без имени',
)

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
  studentForm.profileVisibility = studentVisibilityOptions.some((o) => o.value === normalizedVisibility)
    ? (normalizedVisibility as StudentProfileVisibility)
    : 'authorized_only'
  studentForm.showResume = profile?.show_resume ?? true
  studentForm.showApplications = profile?.show_applications ?? true
  studentForm.showCareerInterests = profile?.show_career_interests ?? true
}

function normalizeStudentVisibility(value: string): StudentProfileVisibility {
  if (value === 'public') return 'public_inside_platform'
  if (studentVisibilityOptions.some((o) => o.value === value)) return value as StudentProfileVisibility
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
  if (!file) return
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
        profile_visibility: normalizeStudentVisibility(studentForm.profileVisibility),
        show_resume: studentForm.showResume,
        show_applications: studentForm.showApplications,
        show_career_interests: studentForm.showCareerInterests,
      } satisfies StudentProfileInput)
      syncStudentForm(studentProfile.value)
      session.patchCurrentUser({ displayName: studentProfile.value?.display_name || session.currentUser.value?.displayName || '' })
      successMessage.value = 'Профиль сохранён.'
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
      session.patchCurrentUser({ displayName: companyProfile.value.brand_name || companyProfile.value.legal_name || session.currentUser.value?.displayName || '' })
      successMessage.value = 'Данные компании сохранены.'
      return
    }
    errorMessage.value = 'Для этой роли редактирование не настроено.'
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
    <div class="ps-root">

      <!-- Header -->
      <header class="ps-header">
        <div class="ps-header-left">
          <RouterLink
            :to="isEmployer ? '/dashboard/employer' : isStudent ? '/dashboard/applicant' : '/'"
            class="ps-back"
          >← Назад</RouterLink>
          <div>
            <p class="ps-eyebrow">{{ isStudent ? 'Соискатель' : isEmployer ? 'Работодатель' : 'Аккаунт' }}</p>
            <h1 class="ps-title">{{ pageTitle }}</h1>
          </div>
        </div>

        <!-- Avatar block -->
        <div class="ps-avatar-block">
          <div class="ps-avatar-wrap">
            <img v-if="currentAvatarUrl" :src="currentAvatarUrl" alt="Аватар" class="ps-avatar-img" />
            <span v-else class="ps-avatar-fallback">{{ avatarFallback }}</span>
          </div>
          <div class="ps-avatar-meta">
            <strong>{{ profileName }}</strong>
            <span>{{ session.currentUser.value?.email }}</span>
            <label class="ps-upload-btn">
              <input type="file" accept="image/*" @change="handleAvatarChange" />
              {{ isUploadingAvatar ? 'Загружаем…' : 'Изменить фото' }}
            </label>
            <p v-if="avatarError" class="ps-avatar-error">{{ avatarError }}</p>
          </div>
        </div>
      </header>

      <!-- Status banners -->
      <div v-if="errorMessage" class="ps-banner ps-banner--error">{{ errorMessage }}</div>
      <div v-else-if="successMessage" class="ps-banner ps-banner--success">{{ successMessage }}</div>
      <div v-else-if="isLoading" class="ps-banner">
        <span class="ps-spinner"></span> Загружаем данные профиля…
      </div>

      <!-- Form -->
      <form v-if="!isLoading && (isStudent || isEmployer)" @submit.prevent="handleSave">

        <!-- ── STUDENT ──────────────────────────────────────────────── -->
        <template v-if="isStudent">

          <div class="ps-section">
            <div class="ps-section-label">
              <p class="ps-kicker">Личные данные</p>
              <h2>Основная информация</h2>
              <p>Имя, университет, специализация и описание профиля.</p>
            </div>
            <div class="ps-fields">
              <label class="ps-field">
                <span>Имя</span>
                <input v-model="studentForm.firstName" type="text" placeholder="Алексей" />
              </label>
              <label class="ps-field">
                <span>Фамилия</span>
                <input v-model="studentForm.lastName" type="text" placeholder="Иванов" />
              </label>
              <label class="ps-field">
                <span>Отчество</span>
                <input v-model="studentForm.middleName" type="text" placeholder="Необязательно" />
              </label>
              <label class="ps-field">
                <span>Университет</span>
                <input v-model="studentForm.universityName" type="text" placeholder="РЭУ им. Г.В. Плеханова" />
              </label>
              <label class="ps-field">
                <span>Факультет</span>
                <input v-model="studentForm.faculty" type="text" placeholder="Высшая школа…" />
              </label>
              <label class="ps-field">
                <span>Специализация</span>
                <input v-model="studentForm.specialization" type="text" placeholder="Маркетинг, аналитика, дизайн" />
              </label>
              <label class="ps-field">
                <span>Курс</span>
                <input v-model="studentForm.studyYear" type="number" min="1" placeholder="3" />
              </label>
              <label class="ps-field">
                <span>Год выпуска</span>
                <input v-model="studentForm.graduationYear" type="number" placeholder="2027" />
              </label>
              <label class="ps-field ps-field--full">
                <span>О себе</span>
                <textarea v-model="studentForm.about" rows="4" placeholder="Кратко опишите интересы, сильные стороны и карьерный фокус" />
              </label>
            </div>
          </div>

          <div class="ps-section">
            <div class="ps-section-label">
              <p class="ps-kicker">Контакты</p>
              <h2>Ссылки и контакты</h2>
              <p>Добавьте каналы связи и публичные профили.</p>
            </div>
            <div class="ps-fields">
              <label class="ps-field">
                <span>Telegram</span>
                <input v-model="studentForm.telegram" type="text" placeholder="@username" />
              </label>
              <label class="ps-field">
                <span>GitHub</span>
                <input v-model="studentForm.githubUrl" type="url" placeholder="https://github.com/username" />
              </label>
              <label class="ps-field">
                <span>LinkedIn</span>
                <input v-model="studentForm.linkedinUrl" type="url" placeholder="https://linkedin.com/in/username" />
              </label>
              <label class="ps-field">
                <span>Сайт</span>
                <input v-model="studentForm.websiteUrl" type="url" placeholder="https://example.com" />
              </label>
            </div>
          </div>

          <div class="ps-section">
            <div class="ps-section-label">
              <p class="ps-kicker">Приватность</p>
              <h2>Видимость профиля</h2>
              <p>Настройте, кто видит ваш профиль и связанные данные.</p>
            </div>
            <div class="ps-fields ps-fields--privacy">
              <label class="ps-field ps-field--full">
                <span>Видимость профиля</span>
                <select v-model="studentForm.profileVisibility">
                  <option v-for="o in studentVisibilityOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
                </select>
              </label>
              <label class="ps-toggle">
                <input v-model="studentForm.showResume" type="checkbox" />
                <div class="ps-toggle-text">
                  <span>Показывать резюме</span>
                  <small>Разрешает отображение резюме в профиле</small>
                </div>
              </label>
              <label class="ps-toggle">
                <input v-model="studentForm.showApplications" type="checkbox" />
                <div class="ps-toggle-text">
                  <span>Показывать отклики</span>
                  <small>Показывает активность внутри платформы</small>
                </div>
              </label>
              <label class="ps-toggle">
                <input v-model="studentForm.showCareerInterests" type="checkbox" />
                <div class="ps-toggle-text">
                  <span>Показывать карьерные интересы</span>
                  <small>Помогает работодателям точнее понимать ваши цели</small>
                </div>
              </label>
            </div>
          </div>

        </template>

        <!-- ── EMPLOYER ─────────────────────────────────────────────── -->
        <template v-else>

          <div class="ps-section">
            <div class="ps-section-label">
              <p class="ps-kicker">Бренд</p>
              <h2>Образ компании</h2>
              <p>Оформите карточку компании так, как её увидят соискатели.</p>
            </div>
            <div class="ps-fields">
              <label class="ps-field">
                <span>Юридическое название</span>
                <input v-model="companyForm.legalName" type="text" placeholder="Полное юридическое наименование" />
              </label>
              <label class="ps-field">
                <span>Бренд</span>
                <input v-model="companyForm.brandName" type="text" placeholder="Короткое и узнаваемое имя" />
              </label>
              <label class="ps-field ps-field--full">
                <span>Описание</span>
                <textarea v-model="companyForm.description" rows="5" placeholder="Чем занимается компания" />
              </label>
            </div>
          </div>

          <div class="ps-section">
            <div class="ps-section-label">
              <p class="ps-kicker">Реквизиты</p>
              <h2>Факты о компании</h2>
              <p>Для верификации и карточки работодателя.</p>
            </div>
            <div class="ps-fields">
              <label class="ps-field">
                <span>Индустрия</span>
                <input v-model="companyForm.industry" type="text" placeholder="EdTech, FinTech, Retail…" />
              </label>
              <label class="ps-field">
                <span>Сайт</span>
                <input v-model="companyForm.website" type="url" placeholder="https://company.ru" />
              </label>
              <label class="ps-field">
                <span>Размер</span>
                <input v-model="companyForm.companySize" type="text" placeholder="50–100 сотрудников" />
              </label>
              <label class="ps-field">
                <span>Год основания</span>
                <input v-model="companyForm.foundedYear" type="number" placeholder="2014" />
              </label>
              <label class="ps-field ps-field--full">
                <span>ИНН</span>
                <input v-model="companyForm.inn" type="text" placeholder="7705043493" />
              </label>
            </div>
          </div>

        </template>

        <!-- Save bar -->
        <div class="ps-save-bar">
          <button class="ps-save-btn" type="submit" :disabled="isSaving">
            {{ isSaving ? 'Сохраняем…' : 'Сохранить изменения' }}
          </button>
          <span v-if="successMessage" class="ps-save-ok">✓ {{ successMessage }}</span>
          <span v-if="errorMessage" class="ps-save-err">{{ errorMessage }}</span>
        </div>
      </form>

      <!-- Resume manager — only students -->
      <div v-if="isStudent && !isLoading">
        <ResumeManager />
      </div>

      <div v-else-if="!isLoading && !isStudent && !isEmployer" class="ps-banner">
        Для этой роли редактирование профиля пока не настроено.
      </div>

    </div>
  </main>
</template>

<style scoped>
/* ── Root ── */
.ps-root {
  display: grid;
  gap: 24px;
  max-width: 900px;
  margin: 0 auto;
}

/* ── Header ── */
.ps-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
  padding: 24px 28px;
  border-radius: 20px;
  border: 1px solid var(--border);
  background: linear-gradient(135deg, #0f2c7a 0%, #1d4ed8 50%, #3b82f6 100%);
  color: #fff;
}

.ps-header-left {
  display: grid;
  gap: 10px;
}

.ps-back {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.82rem;
  font-weight: 500;
  color: rgba(255,255,255,.7);
  text-decoration: none;
  width: fit-content;
}
.ps-back:hover { color: #fff; }

.ps-eyebrow {
  margin: 0 0 4px;
  font: 700 0.65rem/1 var(--font-mono, monospace);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(255,255,255,.6);
}

.ps-title {
  margin: 0;
  font-family: var(--font-heading);
  font-size: clamp(1.6rem, 3vw, 2.2rem);
  color: #fff;
  line-height: 1.1;
}

/* Avatar block in header */
.ps-avatar-block {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 18px;
  border-radius: 14px;
  background: rgba(255,255,255,0.12);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255,255,255,0.2);
}

.ps-avatar-wrap {
  width: 64px;
  height: 64px;
  border-radius: 14px;
  overflow: hidden;
  border: 3px solid rgba(255,255,255,0.35);
  background: rgba(255,255,255,0.15);
  flex-shrink: 0;
}

.ps-avatar-img { width: 100%; height: 100%; object-fit: cover; }

.ps-avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  font-size: 1.3rem;
  font-weight: 800;
  color: #fff;
  font-family: var(--font-heading);
}

.ps-avatar-meta {
  display: grid;
  gap: 3px;
}

.ps-avatar-meta strong {
  font-size: 0.92rem;
  font-weight: 700;
  color: #fff;
  line-height: 1.2;
}

.ps-avatar-meta span {
  font-size: 0.76rem;
  color: rgba(255,255,255,.65);
}

.ps-upload-btn {
  display: inline-flex;
  align-items: center;
  height: 26px;
  padding: 0 12px;
  border-radius: 6px;
  border: 1px solid rgba(255,255,255,0.35);
  background: rgba(255,255,255,0.12);
  color: #fff;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  width: fit-content;
  margin-top: 4px;
  transition: background 0.15s;
}
.ps-upload-btn:hover { background: rgba(255,255,255,0.2); }
.ps-upload-btn input { display: none; }

.ps-avatar-error {
  margin: 2px 0 0;
  font-size: 0.73rem;
  color: #fca5a5;
}

/* ── Banners ── */
.ps-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 13px 18px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--surface);
  font-size: 0.88rem;
  color: var(--muted);
}

.ps-banner--error { border-color: #fca5a5; background: #fef2f2; color: #991b1b; }
.ps-banner--success { border-color: #bbf7d0; background: #f0fdf4; color: #166534; }

.ps-spinner {
  width: 15px; height: 15px;
  border: 2px solid #e2e8f0;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin .7s linear infinite;
  flex-shrink: 0;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Form sections ── */
form { display: grid; gap: 16px; }

.ps-section {
  display: grid;
  grid-template-columns: 200px minmax(0,1fr);
  gap: 24px;
  padding: 22px 24px;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: var(--surface);
  box-shadow: 0 2px 10px rgba(15,23,42,0.04);
}

.ps-section-label { display: grid; gap: 5px; align-content: start; }

.ps-kicker {
  margin: 0;
  font: 700 0.65rem/1 var(--font-mono, monospace);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #3b82f6;
}

.ps-section-label h2 {
  margin: 0;
  font-family: var(--font-heading);
  font-size: 1rem;
  color: var(--text);
  line-height: 1.2;
}

.ps-section-label p {
  margin: 0;
  font-size: 0.8rem;
  color: var(--muted);
  line-height: 1.5;
}

/* ── Fields grid ── */
.ps-fields {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  align-content: start;
}

.ps-fields--privacy {
  grid-template-columns: 1fr;
}

.ps-field {
  display: grid;
  gap: 6px;
}

.ps-field--full { grid-column: 1 / -1; }

.ps-field > span {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--muted);
}

.ps-field input,
.ps-field select,
.ps-field textarea {
  min-height: 40px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface-strong);
  font: inherit;
  font-size: 0.875rem;
  color: var(--text);
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
}

.ps-field input::placeholder,
.ps-field textarea::placeholder { color: var(--border-strong); }

.ps-field input:focus,
.ps-field select:focus,
.ps-field textarea:focus {
  border-color: #3b82f6;
  background: var(--surface);
  box-shadow: 0 0 0 3px rgba(59,130,246,0.1);
}

.ps-field textarea {
  min-height: 110px;
  padding: 10px 12px;
  resize: vertical;
}

/* ── Privacy toggles ── */
.ps-toggle {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid #f1f5f9;
  border-radius: 12px;
  background: var(--surface-strong);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.ps-toggle:hover { border-color: #dbeafe; background: var(--surface); }

.ps-toggle input {
  width: 16px;
  height: 16px;
  margin-top: 2px;
  accent-color: #3b82f6;
  cursor: pointer;
  flex-shrink: 0;
}

.ps-toggle-text { display: grid; gap: 2px; }
.ps-toggle-text span { font-size: 0.86rem; font-weight: 600; color: var(--text); }
.ps-toggle-text small { font-size: 0.76rem; color: var(--muted); line-height: 1.45; }

/* ── Save bar ── */
.ps-save-bar {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 20px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--surface);
  box-shadow: 0 2px 10px rgba(15,23,42,0.04);
}

.ps-save-btn {
  min-height: 40px;
  padding: 0 24px;
  border-radius: 10px;
  border: none;
  background: #2563eb;
  color: #fff;
  font: inherit;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, transform 0.1s;
}
.ps-save-btn:hover { background: #1d4ed8; }
.ps-save-btn:active { transform: scale(0.98); }
.ps-save-btn:disabled { opacity: 0.55; pointer-events: none; }

.ps-save-ok { font-size: 0.84rem; color: #16a34a; font-weight: 500; }
.ps-save-err { font-size: 0.84rem; color: #dc2626; }

/* ── Responsive ── */
@media (max-width: 860px) {
  .ps-section { grid-template-columns: 1fr; }
  .ps-header { flex-direction: column; }
  .ps-avatar-block { align-self: stretch; }
}

@media (max-width: 600px) {
  .ps-fields { grid-template-columns: 1fr; }
  .ps-field--full { grid-column: 1; }
  .ps-header { padding: 18px 20px; }
  .ps-section { padding: 16px 18px; }
}
</style>
