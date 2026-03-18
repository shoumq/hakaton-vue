<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useSession } from '@/features/session/model/session'
import {
  fetchCompanyRegistryByInn,
  getApiErrorMessage,
  submitEmployerVerification,
  updateEmployerCompany,
} from '@/shared/api'
import type { VerificationInput } from '@/shared/api'

const router = useRouter()
const session = useSession()

const form = reactive({
  role: 'student' as 'student' | 'employer',
  email: '',
  displayName: '',
  password: '',
  companyName: '',
  inn: '',
  website: '',
})

const errorMessage = ref('')
const successMessage = ref('')
const isInnLookupLoading = ref(false)

const verificationSummary = computed(() => {
  if (form.role !== 'employer') {
    return 'Для соискателя регистрация ограничивается email, отображаемым именем и паролем.'
  }

  return 'Для работодателя компания создаётся сразу, а верификация отправляется только по ИНН.'
})

function buildVerificationPayload(): VerificationInput | null {
  const inn = form.inn.trim()
  const website = form.website.trim()

  if (!inn) {
    return null
  }

  return {
    inn_submitted: inn,
    verification_method: 'inn_check',
    documents_comment: website ? `Website: ${website}` : undefined,
  }
}

function normalizeWebsiteFromRegistryEmail(email: string | undefined) {
  if (!email) {
    return ''
  }

  const domain = email.split('@')[1]?.trim().toLowerCase()

  if (!domain) {
    return ''
  }

  return `https://${domain}`
}

async function autofillCompanyByInn() {
  const inn = form.inn.trim()

  if (!inn || form.role !== 'employer') {
    return
  }

  isInnLookupLoading.value = true

  try {
    const registry = await fetchCompanyRegistryByInn(inn)

    form.companyName = registry.short_name || registry.full_name || form.companyName

    const websiteFromRegistry = normalizeWebsiteFromRegistryEmail(registry.email)

    if (websiteFromRegistry) {
      form.website = websiteFromRegistry
    }
  } finally {
    isInnLookupLoading.value = false
  }
}

async function handleRegister() {
  errorMessage.value = ''
  successMessage.value = ''

  const result = await session.register({
    email: form.email.trim(),
    password: form.password,
    display_name: form.displayName.trim(),
    role: form.role,
    company_name: form.role === 'employer' ? form.companyName.trim() : undefined,
  })

  if (!result.ok) {
    errorMessage.value = result.message
    return
  }

  if (form.role === 'employer') {
    try {
      await autofillCompanyByInn()

      await updateEmployerCompany({
        legal_name: form.companyName.trim() || form.displayName.trim(),
        brand_name: form.companyName.trim() || form.displayName.trim(),
        website_url: form.website.trim() || undefined,
        inn: form.inn.trim() || undefined,
      })

      const verificationPayload = buildVerificationPayload()

      if (verificationPayload) {
        await submitEmployerVerification(verificationPayload)
      }

      successMessage.value = 'Аккаунт и профиль компании созданы.'
    } catch (error) {
      successMessage.value = 'Аккаунт создан, но данные компании сохранились не полностью.'
      errorMessage.value = getApiErrorMessage(
        error,
        'Не удалось завершить настройку компании или получить данные по ИНН.',
      )
    }

    await router.push('/dashboard/employer')
    return
  }

  successMessage.value = 'Аккаунт создан.'
  await router.push('/dashboard/applicant')
}
</script>

<template>
  <main class="page-shell">
    <section class="register-layout">
      <div class="register-copy">
        <p class="eyebrow">Регистрация</p>
        <h1>Роль выбирается сразу, а сценарий верификации зависит от неё.</h1>
        <p>
          Работодатель получает право публиковать возможности только после проверки компании.
          Соискатель после регистрации заполняет профиль, резюме и настраивает приватность.
        </p>

        <article class="explanation-card">
          <h2>Как работает верификация компании</h2>
          <p>
            После регистрации фронтенд может сохранить карточку компании через `PUT /api/employer/company`
            и сразу отправить верификацию по ИНН в `POST /api/employer/company-verifications`.
          </p>
        </article>
      </div>

      <form class="register-card" @submit.prevent="handleRegister">
        <label class="field">
          <span>Роль</span>
          <select v-model="form.role">
            <option value="student">Соискатель</option>
            <option value="employer">Работодатель</option>
          </select>
        </label>

        <label class="field">
          <span>Email</span>
          <input v-model="form.email" type="email" placeholder="name@example.com" required />
        </label>

        <label class="field">
          <span>Отображаемое имя</span>
          <input v-model="form.displayName" type="text" placeholder="Имя или название профиля" required />
        </label>

        <label class="field">
          <span>Пароль</span>
          <input v-model="form.password" type="password" placeholder="Минимум 8 символов" required />
        </label>

        <template v-if="form.role === 'employer'">
          <label class="field">
            <span>ИНН</span>
            <input v-model="form.inn" type="text" placeholder="7701234567" required />
          </label>

          <label class="field">
            <span>Сайт компании</span>
            <input v-model="form.website" type="url" placeholder="https://company.com" />
          </label>
        </template>

        <div class="summary-card">
          <strong>Логика сценария</strong>
          <p>{{ verificationSummary }}</p>
        </div>

        <p v-if="errorMessage" class="error-text">{{ errorMessage }}</p>
        <p v-if="successMessage" class="success-text">{{ successMessage }}</p>

        <button type="submit" class="primary-button" :disabled="session.isLoading.value">
          {{ session.isLoading.value ? 'Отправляем...' : 'Зарегистрироваться' }}
        </button>
      </form>
    </section>
  </main>
</template>

<style scoped>
.register-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(360px, 460px);
  gap: 18px;
  max-width: 1120px;
  margin: 0 auto;
}

.register-copy,
.register-card {
  display: grid;
  gap: 14px;
  padding: 20px 22px;
  border: 1px solid #d7dee7;
  border-radius: 14px;
  background: var(--surface);
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
}

.eyebrow {
  margin: 0;
  color: var(--accent-strong);
  font: 700 0.72rem/1 var(--font-mono);
  text-transform: uppercase;
}

h1,
h2 {
  margin: 0;
  font-family: var(--font-heading);
}

h1 {
  font-size: clamp(1.45rem, 3vw, 1.9rem);
  line-height: 1.15;
}

p {
  margin: 0;
  color: var(--muted);
  line-height: 1.5;
  font-size: 0.94rem;
}

.explanation-card,
.summary-card {
  display: grid;
  gap: 8px;
  padding: 14px;
  border: 1px solid #e4eaf1;
  border-radius: 10px;
  background: var(--surface-strong);
}

.field {
  display: grid;
  gap: 8px;
}

.field input,
.field select {
  min-height: 42px;
  padding: 0 12px;
  border: 1px solid #d7dee7;
  border-radius: 8px;
}

.primary-button {
  min-height: 40px;
  border: 1px solid var(--accent);
  border-radius: 8px;
  color: #fff;
  background: var(--accent);
  font-size: 0.92rem;
}

.primary-button:disabled {
  opacity: 0.65;
  cursor: progress;
}

.error-text {
  margin: 0;
  color: var(--danger);
}

.success-text {
  margin: 0;
  color: var(--accent-strong);
}

@media (max-width: 900px) {
  .register-layout {
    grid-template-columns: 1fr;
  }
}
</style>
