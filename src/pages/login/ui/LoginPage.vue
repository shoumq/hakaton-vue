<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import { useSession } from '@/features/session/model/session'

const router = useRouter()
const session = useSession()

const authMode = ref<'student' | 'employer' | 'curator'>('student')
const email = ref('')
const password = ref('')
const errorMessage = ref('')

function resolveRoute(role: string) {
  if (role === 'student') {
    return '/dashboard/applicant'
  }

  if (role === 'employer') {
    return '/dashboard/employer'
  }

  return '/dashboard/curator'
}

async function handleLogin() {
  const result = await session.login(
    email.value,
    password.value,
    authMode.value === 'curator' ? 'curator' : 'user',
  )

  if (!result.ok) {
    errorMessage.value = result.message
    return
  }

  errorMessage.value = ''
  await router.push(resolveRoute(result.user.role))
}
</script>

<template>
  <main class="page-shell">
    <section class="auth-layout">
      <div class="auth-copy">
        <p class="eyebrow">Авторизация</p>
        <h1>Вход в платформу для соискателей, работодателей и кураторов.</h1>
        <p>
          Для соискателей и работодателей используется `POST /api/auth/login`, для кураторов
          отдельная ручка `POST /api/auth/curator/login`.
        </p>
      </div>

      <form class="auth-card" @submit.prevent="handleLogin">
        <label class="field">
          <span>Сценарий входа</span>
          <select v-model="authMode">
            <option value="student">Соискатель</option>
            <option value="employer">Работодатель</option>
            <option value="curator">Куратор</option>
          </select>
        </label>

        <label class="field">
          <span>Email</span>
          <input v-model="email" type="email" required />
        </label>

        <label class="field">
          <span>Пароль</span>
          <input v-model="password" type="password" required />
        </label>

        <p v-if="errorMessage" class="error-text">{{ errorMessage }}</p>

        <button class="primary-button" type="submit" :disabled="session.isLoading.value">
          {{ session.isLoading.value ? 'Входим...' : 'Войти' }}
        </button>
        <RouterLink class="secondary-link" to="/register">Создать аккаунт</RouterLink>
      </form>
    </section>
  </main>
</template>

<style scoped>
.auth-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(340px, 420px);
  gap: 18px;
  max-width: 1120px;
  margin: 0 auto;
}

.auth-copy,
.auth-card {
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
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  font-family: var(--font-heading);
  font-size: clamp(1.45rem, 3vw, 1.9rem);
  line-height: 1.15;
}

p {
  margin: 0;
  color: var(--muted);
  line-height: 1.5;
  font-size: 0.94rem;
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

.primary-button,
.secondary-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  border-radius: 8px;
  text-decoration: none;
  font-size: 0.92rem;
}

.primary-button {
  border: 1px solid var(--accent);
  color: #fff;
  background: var(--accent);
}

.primary-button:disabled {
  opacity: 0.65;
  cursor: progress;
}

.secondary-link {
  border: 1px solid var(--border);
  background: var(--surface);
}

.error-text {
  color: var(--danger);
}

@media (max-width: 900px) {
  .auth-layout {
    grid-template-columns: 1fr;
  }
}
</style>
