<script setup lang="ts">
import { computed, reactive } from 'vue'

import type { UserRole } from '@/entities/user/model/types'

const form = reactive({
  role: 'applicant' as Exclude<UserRole, 'guest'>,
  email: '',
  displayName: '',
  password: '',
  companyName: '',
  corporateEmail: '',
  inn: '',
  website: '',
})

const verificationSummary = computed(() => {
  if (form.role !== 'employer') {
    return 'Для соискателя предварительная регистрация ограничивается email, отображаемым именем и паролем.'
  }

  return 'Для работодателя нужна корпоративная почта, ИНН и сайт компании. После отправки карточка попадает к куратору на ручную верификацию.'
})
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
            1. Работодатель указывает корпоративную почту, ИНН и сайт компании.
            2. Платформа сверяет домен почты с доменом сайта.
            3. Куратор проверяет документы и подтверждает компанию вручную.
          </p>
        </article>
      </div>

      <form class="register-card">
        <label class="field">
          <span>Роль</span>
          <select v-model="form.role">
            <option value="applicant">Соискатель</option>
            <option value="employer">Работодатель</option>
            <option value="curator">Куратор</option>
          </select>
        </label>

        <label class="field">
          <span>Email</span>
          <input v-model="form.email" type="email" placeholder="name@example.com" />
        </label>

        <label class="field">
          <span>Отображаемое имя</span>
          <input v-model="form.displayName" type="text" placeholder="Имя или название профиля" />
        </label>

        <label class="field">
          <span>Пароль</span>
          <input v-model="form.password" type="password" placeholder="Минимум 8 символов" />
        </label>

        <template v-if="form.role === 'employer'">
          <label class="field">
            <span>Компания</span>
            <input v-model="form.companyName" type="text" placeholder="Aurora Cloud" />
          </label>

          <label class="field">
            <span>Корпоративная почта</span>
            <input v-model="form.corporateEmail" type="email" placeholder="hr@company.com" />
          </label>

          <label class="field">
            <span>ИНН</span>
            <input v-model="form.inn" type="text" placeholder="7701234567" />
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

        <button type="button" class="primary-button">Зарегистрироваться</button>
      </form>
    </section>
  </main>
</template>

<style scoped>
.register-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(360px, 460px);
  gap: 24px;
  max-width: 1180px;
  margin: 0 auto;
}

.register-copy,
.register-card {
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

h1,
h2 {
  margin: 0;
  font-family: var(--font-heading);
}

h1 {
  font-size: clamp(1.8rem, 4vw, 2.5rem);
  line-height: 1.2;
}

p {
  margin: 0;
  color: var(--muted);
  line-height: 1.65;
}

.explanation-card,
.summary-card {
  display: grid;
  gap: 8px;
  padding: 18px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface-strong);
}

.field {
  display: grid;
  gap: 8px;
}

.field input,
.field select {
  min-height: 48px;
  padding: 0 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
}

.primary-button {
  min-height: 50px;
  border: 1px solid var(--accent);
  border-radius: 8px;
  color: #fff;
  background: var(--accent);
}

@media (max-width: 900px) {
  .register-layout {
    grid-template-columns: 1fr;
  }
}
</style>
