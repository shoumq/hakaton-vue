<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import { fetchStudentById, getApiErrorMessage } from '@/shared/api'
import type { StudentProfileDto } from '@/shared/api'
import { getStudentProfilePreview } from '@/shared/lib/profile-preview'
import { formatDate } from '@/shared/lib/formatters'

const route = useRoute()

const profileId = computed(() => String(route.params.id || ''))
const preview = computed(() => getStudentProfilePreview(profileId.value))
const profile = ref<StudentProfileDto | null>(null)
const isLoading = ref(true)
const profileError = ref('')

const fullName = computed(() => {
  const current = profile.value

  if (!current) {
    return preview.value?.displayName || 'Соискатель'
  }

  const firstName = current.first_name?.trim() ?? ''
  const lastName = current.last_name?.trim() ?? ''
  const displayName = current.display_name?.trim() ?? ''

  return [firstName, lastName].filter(Boolean).join(' ') || displayName || preview.value?.displayName || 'Соискатель'
})

const profileSummary = computed(() => {
  const current = profile.value
  const parts = [
    current?.university_name?.trim() ?? '',
    current?.faculty?.trim() ?? '',
    current?.specialization?.trim() ?? '',
  ].filter(Boolean)

  return parts.join(' • ') || preview.value?.headline || 'Публичная карточка кандидата на платформе.'
})

const aboutText = computed(
  () =>
    profile.value?.about?.trim() ||
    preview.value?.about ||
    'Пользователь пока не добавил подробное описание профиля.',
)

const privacyLabel = computed(() => {
  const visibility = profile.value?.profile_visibility ?? 'authorized_only'

  if (visibility === 'public_inside_platform' || visibility === 'public') {
    return 'Публичный внутри платформы'
  }

  if (visibility === 'private') {
    return 'Приватный'
  }

  if (visibility === 'contacts_only') {
    return 'Только контактам'
  }

  return 'Только авторизованным'
})

const profileHighlights = computed(() => {
  if (!profile.value && !preview.value) {
    return []
  }

  return [
    { label: 'Кандидат', value: fullName.value || 'Не указано' },
    { label: 'Университет', value: profile.value?.university_name || 'Не указан' },
    { label: 'Факультет', value: profile.value?.faculty || 'Не указан' },
    { label: 'Специализация', value: profile.value?.specialization || 'Не указана' },
    { label: 'Курс', value: profile.value?.study_year ? String(profile.value.study_year) : 'Не указан' },
    { label: 'Год выпуска', value: profile.value?.graduation_year ? String(profile.value.graduation_year) : 'Не указан' },
    { label: 'Видимость', value: privacyLabel.value },
    { label: 'Отклик обновлён', value: profile.value?.updated_at ? formatDate(profile.value.updated_at) : preview.value?.updatedAt ? formatDate(preview.value.updatedAt) : 'Не указано' },
  ]
})

const contactHighlights = computed(() => {
  if (!profile.value && !preview.value) {
    return []
  }

  return [
    { label: 'Telegram', value: profile.value?.telegram || 'Не указан' },
    { label: 'GitHub', value: profile.value?.github_url || 'Не указан' },
    { label: 'LinkedIn', value: profile.value?.linkedin_url || 'Не указан' },
    { label: 'Сайт', value: profile.value?.website_url || 'Не указан' },
    { label: 'Показывать резюме', value: profile.value?.show_resume ? 'Да' : 'Нет' },
    { label: 'Показывать отклики', value: profile.value?.show_applications ? 'Да' : 'Нет' },
    { label: 'Показывать карьерные интересы', value: profile.value?.show_career_interests ? 'Да' : 'Нет' },
    { label: 'Связано с возможностью', value: preview.value?.sourceOpportunityTitle || 'Не указано' },
  ]
})

const initials = computed(() =>
  (fullName.value || 'ST')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase(),
)

async function loadProfile() {
  if (!profileId.value) {
    profile.value = null
    profileError.value = 'Некорректный идентификатор профиля.'
    isLoading.value = false
    return
  }

  isLoading.value = true
  profileError.value = ''

  try {
    profile.value = await fetchStudentById(profileId.value)
  } catch (error) {
    profile.value = null
    profileError.value = getApiErrorMessage(error, 'Не удалось загрузить профиль студента.')
  } finally {
    isLoading.value = false
  }
}

onMounted(loadProfile)
watch(profileId, loadProfile)
</script>

<template>
  <main class="page-shell">
    <section class="dashboard">
      <p v-if="profileError" class="section-copy error-copy">{{ profileError }}</p>
      <p v-else-if="isLoading" class="section-copy">Загружаем профиль студента...</p>

      <template v-if="profile">
        <div class="dashboard-hero">
          <div class="hero-copy-block">
            <p class="eyebrow">Student Profile</p>
            <h1>{{ fullName }}</h1>
            <p class="hero-copy">{{ profileSummary }}</p>
            <p class="hero-copy">{{ aboutText }}</p>
          </div>

          <div class="verification-card">
            <div class="avatar-shell large">
              <img
                v-if="preview?.avatarUrl"
                :src="preview.avatarUrl"
                :alt="fullName"
                class="avatar-image"
              />
              <div v-else class="student-avatar-art">
                <span class="avatar-fallback">{{ initials }}</span>
              </div>
            </div>
            <strong>Профиль кандидата</strong>
            <div class="hero-side-actions">
              <RouterLink to="/chats" class="primary-button">Открыть чаты</RouterLink>
              <RouterLink to="/" class="ghost-button">На главную</RouterLink>
            </div>
          </div>
        </div>

        <section class="dashboard-grid single-column">
          <article class="section-card">
            <div class="section-title">
              <h2>Профиль кандидата</h2>
              <p>На этой странице отображаются реальные данные публичного профиля студента по его `id`.</p>
            </div>
            <div class="editor-grid profile-summary-grid">
              <div v-for="item in profileHighlights" :key="item.label" class="summary-card">
                <span>{{ item.label }}</span>
                <strong>{{ item.value }}</strong>
              </div>
            </div>
          </article>

          <article class="section-card">
            <div class="section-title">
              <h2>Контакты и настройки</h2>
              <p>Доступные публичные каналы связи и параметры видимости профиля.</p>
            </div>
            <div class="editor-grid profile-summary-grid">
              <div v-for="item in contactHighlights" :key="item.label" class="summary-card">
                <span>{{ item.label }}</span>
                <strong>{{ item.value }}</strong>
              </div>
            </div>
          </article>

          <article v-if="profile.about || preview?.coverLetter" class="section-card">
            <div class="section-title">
              <h2>О кандидате</h2>
              <p>Основное описание профиля и сопроводительное письмо, если оно было сохранено из отклика.</p>
            </div>
            <div class="content-stack">
              <article v-if="profile.about" class="note-card">
                <span>О себе</span>
                <p>{{ profile.about }}</p>
              </article>
              <article v-if="preview?.coverLetter" class="note-card">
                <span>Сопроводительное письмо</span>
                <p>{{ preview.coverLetter }}</p>
              </article>
            </div>
          </article>
        </section>
      </template>

      <article v-else-if="!isLoading" class="section-card">
        <div class="section-title">
          <h2>Профиль недоступен</h2>
          <p>Профиль не найден или недоступен с текущими настройками приватности.</p>
        </div>
        <div class="summary-actions">
          <RouterLink to="/" class="ghost-button">На главную</RouterLink>
        </div>
      </article>
    </section>
  </main>
</template>

<style scoped>
.dashboard,
.dashboard-grid {
  display: grid;
  gap: 16px;
}

.dashboard {
  max-width: 1240px;
  margin: 0 auto;
}

.dashboard-hero,
.section-card {
  padding: 24px;
  border: 1px solid rgba(18, 38, 63, 0.08);
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

.eyebrow {
  margin: 0;
  color: #2952cc;
  font: 700 0.72rem/1 var(--font-mono);
  text-transform: uppercase;
}

h1,
h2 {
  margin: 0;
  font-family: var(--font-heading);
}

h1 {
  font-size: clamp(1.9rem, 4vw, 3rem);
  line-height: 1;
}

.hero-copy,
.section-card p,
.note-card p {
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

.verification-card,
.editor-grid,
.note-card {
  display: grid;
  gap: 12px;
  padding: 18px;
  border: 1px solid rgba(18, 38, 63, 0.08);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.78);
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
  color: #fff;
}

.student-avatar-art {
  display: grid;
  place-items: center;
  width: calc(100% - 12px);
  height: calc(100% - 12px);
  border-radius: 999px;
  background:
    radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.34), transparent 34%),
    linear-gradient(135deg, #0f2c7a 0%, #1f56e0 62%, #49b3ff 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.24),
    0 14px 28px rgba(31, 86, 224, 0.2);
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
  background: rgba(255, 255, 255, 0.92);
}

.summary-card span,
.note-card span {
  color: #627087;
  font-size: 0.8rem;
}

.summary-card strong {
  color: #162033;
  font-size: 0.94rem;
  line-height: 1.35;
}

.content-stack {
  display: grid;
  gap: 14px;
}

.summary-actions {
  display: flex;
  padding-top: 4px;
}

.section-copy {
  margin: 0;
  color: #5c6778;
  line-height: 1.6;
  font-size: 0.95rem;
}

.error-copy {
  color: var(--danger);
}

.note-card {
  padding: 20px;
}

@media (max-width: 1100px) {
  .dashboard-hero {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .dashboard-hero,
  .section-card {
    padding: 18px;
  }

  .editor-grid {
    grid-template-columns: 1fr;
  }
}
</style>
