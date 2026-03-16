<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import { useSession } from '@/features/session/model/session'

const router = useRouter()
const session = useSession()

const email = ref('applicant@career.local')
const password = ref('demo123')
const errorMessage = ref('')

function resolveRoute(role: string) {
  if (role === 'applicant') {
    return '/dashboard/applicant'
  }

  if (role === 'employer') {
    return '/dashboard/employer'
  }

  return '/dashboard/curator'
}

function handleLogin() {
  const result = session.login(email.value, password.value)

  if (!result.ok) {
    errorMessage.value = result.message
    return
  }

  errorMessage.value = ''
  router.push(resolveRoute(result.user.role))
}
</script>

<template>
  <main class="page-shell">
    <section class="auth-layout">
      <div class="auth-copy">
        <p class="eyebrow">Авторизация</p>
        <h1>Вход в платформу для соискателей, работодателей и кураторов.</h1>
        <p>
          После входа пользователь попадает в свой кабинет. Куратор по умолчанию существует в системе как
          администратор и может заводить других кураторов.
        </p>

        <div class="demo-box">
          <p><strong>Демо-аккаунты</strong></p>
          <p>`applicant@career.local / demo123`</p>
          <p>`employer@career.local / demo123`</p>
          <p>`admin@career.local / admin123`</p>
        </div>
      </div>

      <form class="auth-card" @submit.prevent="handleLogin">
        <label class="field">
          <span>Email</span>
          <input v-model="email" type="email" required />
        </label>

        <label class="field">
          <span>Пароль</span>
          <input v-model="password" type="password" required />
        </label>

        <p v-if="errorMessage" class="error-text">{{ errorMessage }}</p>

        <button class="primary-button" type="submit">Войти</button>
        <RouterLink class="secondary-link" to="/register">Создать аккаунт</RouterLink>
      </form>
    </section>
  </main>
</template>

<style scoped>
.auth-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(340px, 420px);
  gap: 24px;
  max-width: 1180px;
  margin: 0 auto;
}

.auth-copy,
.auth-card {
  display: grid;
  gap: 18px;
  padding: 28px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
}

.eyebrow {
  margin: 0;
  color: var(--accent-strong);
  font: 700 0.82rem/1 var(--font-mono);
  letter-spacing: 0.04em;
}

h1 {
  margin: 0;
  font-family: var(--font-heading);
  font-size: clamp(1.8rem, 4vw, 2.6rem);
  line-height: 1.2;
}

p {
  margin: 0;
  color: var(--muted);
  line-height: 1.65;
}

.demo-box {
  display: grid;
  gap: 6px;
  padding: 18px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface-strong);
}

.field {
  display: grid;
  gap: 8px;
}

.field input {
  min-height: 48px;
  padding: 0 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
}

.primary-button,
.secondary-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  border-radius: 8px;
  text-decoration: none;
}

.primary-button {
  border: 1px solid var(--accent);
  color: #fff;
  background: var(--accent);
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
