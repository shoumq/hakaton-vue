<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import { fetchPublicResumeById, getApiErrorMessage } from '@/shared/api'
import type { PublicResumeDto, WorkExperienceDto } from '@/shared/api'
import { formatDate } from '@/shared/lib/formatters'

const route = useRoute()

const userId   = computed(() => String(route.params.userId   || ''))
const resumeId = computed(() => String(route.params.resumeId || ''))

const resume      = ref<PublicResumeDto | null>(null)
const experiences = ref<WorkExperienceDto[]>([])
const isLoading   = ref(true)
const error       = ref('')

function formatMonthYear(dateStr?: string): string {
  if (!dateStr) return ''
  const [year, month] = dateStr.split('-').map(Number)
  return new Date(year, (month || 1) - 1, 1).toLocaleDateString('ru-RU', {
    year: 'numeric', month: 'long',
  })
}

function companyName(exp: WorkExperienceDto) {
  return exp.company?.brand_name || exp.company?.legal_name || exp.company_name || 'Компания не указана'
}

async function load() {
  if (!userId.value || !resumeId.value) return
  isLoading.value = true
  error.value = ''
  try {
    const r = await fetchPublicResumeById(userId.value, resumeId.value)
    resume.value = r
    // Backend may include work_experiences inline, otherwise use the nested array
    experiences.value = r.work_experiences ?? []
  } catch (e) {
    error.value = getApiErrorMessage(e, 'Не удалось загрузить резюме.')
    resume.value = null
  } finally {
    isLoading.value = false
  }
}

onMounted(load)
watch([userId, resumeId], load)
</script>

<template>
  <main class="page-shell">
    <div class="rp-root">

      <!-- Back -->
      <RouterLink :to="`/profiles/students/${userId}`" class="rp-back">
        ← Назад к профилю
      </RouterLink>

      <!-- Loading -->
      <div v-if="isLoading" class="rp-status">
        <span class="rp-spinner"></span> Загружаем резюме…
      </div>

      <!-- Error -->
      <div v-else-if="error" class="rp-status rp-status--error">{{ error }}</div>

      <template v-else-if="resume">
        <!-- Hero -->
        <div class="rp-hero">
          <div class="rp-hero-left">
            <div class="rp-hero-icon">📄</div>
            <div>
              <p class="rp-eyebrow">Резюме</p>
              <h1 class="rp-title">{{ resume.title || 'Без названия' }}</h1>
              <div class="rp-meta-row">
                <span v-if="resume.is_primary" class="rp-badge-primary">⭐ Основное</span>
                <span class="rp-date">Обновлено {{ resume.updated_at ? formatDate(resume.updated_at) : '—' }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Summary -->
        <div v-if="resume.summary" class="rp-card">
          <p class="rp-kicker">О себе</p>
          <p class="rp-body-text">{{ resume.summary }}</p>
        </div>

        <!-- Work experiences -->
        <div class="rp-card">
          <p class="rp-kicker">Опыт работы</p>

          <div v-if="!experiences.length" class="rp-empty">
            Опыт работы пока не добавлен.
          </div>

          <div v-else class="rp-we-list">
            <div v-for="exp in experiences" :key="exp.id" class="rp-we-item">
              <!-- Company avatar -->
              <div class="rp-co-avatar">
                <img v-if="exp.company?.avatar_url" :src="exp.company.avatar_url" :alt="companyName(exp)" />
                <span v-else>{{ companyName(exp).slice(0,1) }}</span>
              </div>

              <div class="rp-we-body">
                <div class="rp-we-top">
                  <strong class="rp-we-position">{{ exp.position_title }}</strong>
                  <span v-if="!exp.finished_at" class="rp-badge-now">Сейчас</span>
                </div>

                <div class="rp-we-company">
                  <a
                    v-if="exp.company?.website_url"
                    :href="exp.company.website_url"
                    target="_blank" rel="noopener noreferrer"
                    class="rp-we-link"
                  >{{ companyName(exp) }}</a>
                  <span v-else>{{ companyName(exp) }}</span>
                </div>

                <span class="rp-we-dates">
                  {{ formatMonthYear(exp.started_at) }} —
                  {{ exp.finished_at ? formatMonthYear(exp.finished_at) : 'по настоящее время' }}
                </span>

                <p v-if="exp.description" class="rp-we-desc">{{ exp.description }}</p>
              </div>
            </div>
          </div>
        </div>
      </template>

    </div>
  </main>
</template>

<style scoped>
.rp-root {
  display: grid;
  gap: 16px;
  max-width: 820px;
  margin: 0 auto;
}

.rp-back {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.85rem;
  color: #2563eb;
  text-decoration: none;
  font-weight: 500;
}
.rp-back:hover { text-decoration: underline; }

/* status */
.rp-status {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 18px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--surface);
  font-size: 0.9rem;
  color: var(--muted);
}
.rp-status--error { border-color: #fca5a5; background: #fef2f2; color: #991b1b; }

.rp-spinner {
  width: 16px; height: 16px;
  border: 2px solid #e2e8f0;
  border-top-color: #2563eb;
  border-radius: 50%;
  animation: spin .7s linear infinite;
  flex-shrink: 0;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* hero */
.rp-hero {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 24px 28px;
  border-radius: 18px;
  background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 55%, #60a5fa 100%);
  color: #fff;
}

.rp-hero-left { display: flex; align-items: center; gap: 16px; }

.rp-hero-icon {
  font-size: 2.2rem;
  line-height: 1;
  background: rgba(255,255,255,0.15);
  border-radius: 14px;
  width: 56px; height: 56px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}

.rp-eyebrow {
  margin: 0 0 4px;
  font: 700 0.65rem/1 var(--font-mono, monospace);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(255,255,255,.65);
}

.rp-title {
  margin: 0 0 8px;
  font-family: var(--font-heading);
  font-size: clamp(1.3rem, 2.5vw, 1.8rem);
  color: #fff;
  line-height: 1.15;
}

.rp-meta-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

.rp-badge-primary {
  height: 20px;
  padding: 0 9px;
  border-radius: 5px;
  background: rgba(255,255,255,0.2);
  color: #fff;
  font-size: 0.7rem;
  font-weight: 700;
  display: inline-flex; align-items: center;
}

.rp-date { font-size: 0.78rem; color: rgba(255,255,255,.7); }

/* cards */
.rp-card {
  padding: 18px 20px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--surface);
  box-shadow: 0 2px 8px rgba(15,23,42,.04);
  display: grid;
  gap: 10px;
}

.rp-kicker {
  margin: 0;
  font: 700 0.65rem/1 var(--font-mono, monospace);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #2563eb;
}

.rp-body-text {
  margin: 0;
  font-size: 0.9rem;
  color: var(--text);
  line-height: 1.7;
}

.rp-pre { white-space: pre-wrap; }

/* empty */
.rp-empty {
  padding: 16px;
  border: 1.5px dashed #e2e8f0;
  border-radius: 10px;
  font-size: 0.84rem;
  color: var(--border-strong);
  text-align: center;
}

/* work experiences */
.rp-we-list { display: grid; gap: 12px; }

.rp-we-item {
  display: grid;
  grid-template-columns: 44px minmax(0,1fr);
  gap: 12px;
  align-items: start;
  padding: 14px 16px;
  border: 1px solid #f1f5f9;
  border-radius: 12px;
  background: var(--surface-strong);
}
.rp-we-item:hover { border-color: #dbeafe; }

.rp-co-avatar {
  width: 44px; height: 44px;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid var(--border);
  background: var(--surface-muted);
  display: flex; align-items: center; justify-content: center;
  font-size: 1rem; font-weight: 700; color: var(--muted);
  flex-shrink: 0;
}
.rp-co-avatar img { width: 100%; height: 100%; object-fit: cover; }

.rp-we-body { display: grid; gap: 3px; min-width: 0; }

.rp-we-top { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

.rp-we-position { font-size: 0.925rem; font-weight: 600; color: var(--text); }

.rp-badge-now {
  height: 18px; padding: 0 8px;
  border-radius: 5px;
  background: #dcfce7; color: #166534;
  font-size: 0.67rem; font-weight: 700;
  display: inline-flex; align-items: center;
}

.rp-we-company { font-size: 0.82rem; color: var(--muted); }
.rp-we-link { color: #2563eb; text-decoration: none; }
.rp-we-link:hover { text-decoration: underline; }

.rp-we-dates { font-size: 0.75rem; color: var(--border-strong); }

.rp-we-desc {
  margin: 4px 0 0;
  font-size: 0.83rem;
  color: var(--muted);
  line-height: 1.55;
}
</style>
