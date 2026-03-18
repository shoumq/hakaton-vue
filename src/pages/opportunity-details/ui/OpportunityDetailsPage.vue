<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useSession } from '@/features/session/model/session'
import MapLibreOpportunityMap from '@/shared/ui/MapLibreOpportunityMap.vue'
import {
  applyToOpportunity,
  fetchOpportunityById,
  fetchResumes,
  getApiErrorMessage,
} from '@/shared/api'
import type { OpportunityDetails, ResumeDto } from '@/shared/api'
import { formatDate, formatMoneyRange } from '@/shared/lib/formatters'

const route = useRoute()
const router = useRouter()
const session = useSession()

const opportunity = ref<OpportunityDetails | null>(null)
const resumes = ref<ResumeDto[]>([])
const isLoading = ref(true)
const isSubmitting = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const applyForm = reactive({
  resumeId: '',
  coverLetter: '',
})

const isStudent = computed(() => session.role.value === 'student')
const canApply = computed(() => session.isAuthenticated.value && isStudent.value)

async function loadPage() {
  isLoading.value = true
  errorMessage.value = ''

  try {
    const id = String(route.params.id)
    opportunity.value = await fetchOpportunityById(id)

    if (canApply.value) {
      resumes.value = await fetchResumes()
      applyForm.resumeId = resumes.value.find((item) => item.is_primary)?.id ?? resumes.value[0]?.id ?? ''
    }
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, 'Не удалось загрузить страницу возможности.')
  } finally {
    isLoading.value = false
  }
}

async function handleApply() {
  if (!opportunity.value) {
    return
  }

  if (!session.isAuthenticated.value) {
    await router.push('/login')
    return
  }

  if (!isStudent.value) {
    errorMessage.value = 'Отклик доступен только для профиля соискателя.'
    return
  }

  isSubmitting.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    await applyToOpportunity(opportunity.value.id, {
      resume_id: applyForm.resumeId || undefined,
      cover_letter: applyForm.coverLetter.trim() || undefined,
    })
    successMessage.value = 'Отклик отправлен.'
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, 'Не удалось отправить отклик.')
  } finally {
    isSubmitting.value = false
  }
}

onMounted(async () => {
  await session.restoreSession()
  await loadPage()
})
</script>

<template>
  <main class="page-shell">
    <section class="details-page">
      <p v-if="errorMessage" class="status-banner error">{{ errorMessage }}</p>
      <p v-else-if="successMessage" class="status-banner success">{{ successMessage }}</p>
      <p v-else-if="isLoading" class="status-banner">Загружаем возможность...</p>

      <template v-if="opportunity">
        <header class="details-hero">
          <div class="hero-main">
            <p class="section-label">Возможность</p>
            <h1>{{ opportunity.title }}</h1>
            <p class="hero-company">{{ opportunity.companyName }}</p>
            <p class="hero-copy">{{ opportunity.fullDescription }}</p>

            <div class="hero-tags">
              <span class="pill">{{ opportunity.type }}</span>
              <span class="pill">{{ opportunity.workFormat }}</span>
              <span class="pill">{{ opportunity.employment }}</span>
              <span v-for="tag in opportunity.technologies" :key="tag" class="tag">{{ tag }}</span>
              <span v-for="level in opportunity.levels" :key="level" class="tag muted">{{ level }}</span>
            </div>
          </div>

          <aside class="hero-side">
            <div class="summary-card">
              <span>Доход</span>
              <strong>{{ formatMoneyRange(opportunity.salaryFrom, opportunity.salaryTo) }}</strong>
            </div>
            <div class="summary-card">
              <span>Публикация</span>
              <strong>{{ formatDate(opportunity.publishedAt) }}</strong>
            </div>
            <div class="summary-card">
              <span>Дедлайн</span>
              <strong>{{ formatDate(opportunity.expiresAt) }}</strong>
            </div>
            <div class="summary-card">
              <span>Отклики / просмотры</span>
              <strong>{{ opportunity.applicationsCount }} / {{ opportunity.viewsCount }}</strong>
            </div>
          </aside>
        </header>

        <section class="content-grid">
          <div class="main-column">
            <article class="section-card">
              <div class="section-head">
                <div>
                  <p class="section-label">Описание</p>
                  <h2>Что нужно делать</h2>
                </div>
              </div>
              <p class="section-copy">{{ opportunity.fullDescription }}</p>
            </article>

            <article class="section-card">
              <div class="section-head">
                <div>
                  <p class="section-label">Локация</p>
                  <h2>Местоположение на карте</h2>
                </div>
              </div>
              <MapLibreOpportunityMap
                :latitude="opportunity.location.latitude"
                :longitude="opportunity.location.longitude"
                :label="opportunity.location.placementLabel"
              />
              <div class="location-card">
                <strong>{{ opportunity.location.placementLabel }}</strong>
                <span>Координаты: {{ opportunity.location.latitude }}, {{ opportunity.location.longitude }}</span>
              </div>
            </article>
          </div>

          <aside class="side-column">
            <article class="section-card compact">
              <div class="section-head">
                <div>
                  <p class="section-label">Компания</p>
                  <h2>{{ opportunity.companyName }}</h2>
                </div>
              </div>
              <div class="stack-list">
                <div class="mini-card">
                  <strong>Контакты</strong>
                  <span>{{ opportunity.contacts[0] || 'Не указаны' }}</span>
                </div>
                <div class="mini-card">
                  <strong>Формат</strong>
                  <span>{{ opportunity.workFormat }}</span>
                </div>
                <div class="mini-card">
                  <strong>Тип</strong>
                  <span>{{ opportunity.type }}</span>
                </div>
              </div>
            </article>

            <article class="section-card compact">
              <div class="section-head">
                <div>
                  <p class="section-label">Отклик</p>
                  <h2>Подать заявку</h2>
                </div>
              </div>

              <form class="apply-form" @submit.prevent="handleApply">
                <p v-if="!session.isAuthenticated.value" class="hint-copy">
                  Для отклика сначала войдите в аккаунт.
                </p>
                <p v-else-if="!isStudent" class="hint-copy">
                  Отклик доступен только для роли соискателя.
                </p>

                <label v-if="canApply" class="field">
                  <span>Резюме</span>
                  <select v-model="applyForm.resumeId">
                    <option value="">Без резюме</option>
                    <option v-for="resume in resumes" :key="resume.id" :value="resume.id">
                      {{ resume.title || resume.id }}
                    </option>
                  </select>
                </label>

                <label v-if="canApply" class="field">
                  <span>Сопроводительное письмо</span>
                  <textarea v-model="applyForm.coverLetter" rows="6" placeholder="Коротко опишите, почему вы подходите." />
                </label>

                <button class="primary-button" type="submit" :disabled="isSubmitting">
                  {{
                    !session.isAuthenticated.value
                      ? 'Войти и откликнуться'
                      : isSubmitting
                        ? 'Отправляем...'
                        : 'Откликнуться'
                  }}
                </button>
              </form>
            </article>
          </aside>
        </section>
      </template>
    </section>
  </main>
</template>

<style scoped>
.details-page,
.content-grid,
.main-column,
.side-column,
.stack-list {
  display: grid;
  gap: 16px;
}

.details-page {
  max-width: 1240px;
  margin: 0 auto;
}

.details-hero,
.section-card,
.status-banner {
  border: 1px solid #d7dee7;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
}

.details-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
}

.hero-main {
  display: grid;
  gap: 10px;
  padding: 20px 22px;
}

.hero-side {
  display: grid;
  gap: 10px;
  padding: 20px 18px;
  border-left: 1px solid #e3e8ef;
  background: linear-gradient(180deg, #fbfcfd 0%, #f6f9fc 100%);
}

.section-label {
  margin: 0;
  color: #526581;
  font: 700 0.7rem/1 var(--font-mono);
  text-transform: uppercase;
}

h1,
h2 {
  margin: 0;
  color: #1d2939;
  font-family: var(--font-heading);
}

h1 {
  font-size: 1.8rem;
  line-height: 1.08;
}

h2 {
  font-size: 1rem;
  line-height: 1.22;
}

.hero-company,
.hero-copy,
.section-copy,
.hint-copy,
.mini-card span,
.location-card span {
  margin: 0;
  color: #526581;
  line-height: 1.5;
  font-size: 0.92rem;
}

.hero-company {
  color: #0a66c2;
  font-weight: 600;
}

.hero-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 2px;
}

.pill,
.tag {
  display: inline-flex;
  align-items: center;
  min-height: 26px;
  padding: 0 9px;
  border-radius: 999px;
  border: 1px solid #d9e1ea;
  background: #f8fafb;
  font-size: 0.74rem;
}

.tag.muted {
  color: #667085;
}

.summary-card {
  display: grid;
  gap: 4px;
  padding: 12px 14px;
  border: 1px solid #dfe7f0;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.92);
}

.summary-card span {
  color: #667085;
  font-size: 0.72rem;
  text-transform: uppercase;
}

.summary-card strong {
  font-size: 0.95rem;
  line-height: 1.25;
}

.content-grid {
  grid-template-columns: minmax(0, 1fr) 320px;
  align-items: start;
}

.section-card {
  padding: 16px 18px;
}

.section-card.compact {
  padding: 14px;
}

.section-head {
  margin-bottom: 10px;
}

.section-head > div {
  display: grid;
  gap: 7px;
}

.location-card,
.mini-card {
  display: grid;
  gap: 4px;
  padding: 11px 12px;
  border: 1px solid #e4eaf1;
  border-radius: 10px;
  background: #fafbfd;
  margin-top: 12px;
}

.apply-form {
  display: grid;
  gap: 10px;
}

.field {
  display: grid;
  gap: 6px;
}

.field span {
  color: #667085;
  font-size: 0.8rem;
}

.field select,
.field textarea {
  min-height: 38px;
  padding: 9px 11px;
  border: 1px solid #d7dee7;
  border-radius: 8px;
  font: inherit;
  font-size: 0.9rem;
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

.status-banner {
  padding: 12px 14px;
  font-size: 0.9rem;
}

.status-banner.error {
  color: var(--danger);
}

.status-banner.success {
  color: var(--success);
}

@media (max-width: 1100px) {
  .details-hero,
  .content-grid {
    grid-template-columns: 1fr;
  }

  .hero-side {
    border-left: 0;
    border-top: 1px solid #e3e8ef;
  }
}
</style>
