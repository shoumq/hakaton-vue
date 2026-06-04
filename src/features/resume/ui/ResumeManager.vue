<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'

import WorkExperienceSection from '@/features/work-experience/ui/WorkExperienceSection.vue'
import {
  createResume,
  fetchAllCompanies,
  fetchResumes,
  getApiErrorMessage,
  setResumePrimary,
} from '@/shared/api'
import type { EmployerCompanyDto, ResumeCreateInput, ResumeDto } from '@/shared/api'
import { formatDate } from '@/shared/lib/formatters'
import { showErrorToast, showSuccessToast } from '@/shared/lib/toast'

// ── State ─────────────────────────────────────────────────────────────────────
const resumes = ref<ResumeDto[]>([])
const selectedId = ref('')
const isLoading = ref(false)
const loadError = ref('')

const companies = ref<EmployerCompanyDto[]>([])

const creatingResume = ref(false)
const isSavingResume = ref(false)
const settingPrimaryId = ref('')

const createForm = reactive({
  title: '',
  summary: '',
  experience_text: '',
  education_text: '',
})

// ── Computed ──────────────────────────────────────────────────────────────────
const selectedResume = computed(() => resumes.value.find((r) => r.id === selectedId.value) ?? null)

// ── Load ──────────────────────────────────────────────────────────────────────
async function load() {
  isLoading.value = true
  loadError.value = ''
  try {
    const [resumeList, companyList] = await Promise.all([fetchResumes(), fetchAllCompanies()])
    resumes.value = resumeList
    companies.value = companyList

    if (resumeList.length) {
      const primary = resumeList.find((r) => r.is_primary)
      selectedId.value = primary?.id ?? resumeList[0].id
    }
  } catch (e) {
    loadError.value = getApiErrorMessage(e, 'Не удалось загрузить резюме.')
  } finally {
    isLoading.value = false
  }
}

// ── Create resume ─────────────────────────────────────────────────────────────
function openCreate() {
  createForm.title = ''
  createForm.summary = ''
  createForm.experience_text = ''
  createForm.education_text = ''
  creatingResume.value = true
}

function closeCreate() {
  creatingResume.value = false
}

async function handleCreate() {
  if (!createForm.title.trim()) { showErrorToast('Введите название резюме.'); return }

  const payload: ResumeCreateInput = {
    title: createForm.title.trim(),
    summary: createForm.summary.trim() || undefined,
    experience_text: createForm.experience_text.trim() || undefined,
    education_text: createForm.education_text.trim() || undefined,
  }

  isSavingResume.value = true
  try {
    const created = await createResume(payload)
    resumes.value.push(created)
    selectedId.value = created.id
    closeCreate()
    showSuccessToast('Резюме создано.')
  } catch (e) {
    showErrorToast(getApiErrorMessage(e, 'Не удалось создать резюме.'))
  } finally {
    isSavingResume.value = false
  }
}

// ── Set primary ───────────────────────────────────────────────────────────────
async function handleSetPrimary(id: string) {
  settingPrimaryId.value = id
  try {
    const updated = await setResumePrimary(id)
    resumes.value = resumes.value.map((r) =>
      r.id === id ? { ...r, is_primary: true } : { ...r, is_primary: false },
    )
    // merge returned fields if any
    const idx = resumes.value.findIndex((r) => r.id === id)
    if (idx !== -1 && updated) resumes.value[idx] = { ...resumes.value[idx], ...updated, is_primary: true }
    showSuccessToast('Основное резюме обновлено.')
  } catch (e) {
    showErrorToast(getApiErrorMessage(e, 'Не удалось обновить.'))
  } finally {
    settingPrimaryId.value = ''
  }
}

onMounted(load)
</script>

<template>
  <section class="rm-root">
    <!-- Header -->
    <div class="rm-section-head">
      <div>
        <p class="section-kicker">Resume</p>
        <h2>Резюме</h2>
        <p class="rm-desc">Управляйте резюме и опытом работы внутри каждого.</p>
      </div>
      <button v-if="!creatingResume" class="rm-btn rm-btn-accent" type="button" @click="openCreate">
        + Создать резюме
      </button>
    </div>

    <!-- Global loading / error -->
    <div v-if="isLoading" class="rm-status">
      <span class="rm-spinner"></span> Загружаем резюме…
    </div>
    <div v-else-if="loadError" class="rm-status rm-status--error">{{ loadError }}</div>

    <!-- Create form -->
    <div v-if="creatingResume" class="rm-create-form">
      <div class="rm-form-head">
        <strong>Новое резюме</strong>
        <button type="button" class="rm-close" @click="closeCreate">✕</button>
      </div>
      <div class="rm-form-grid">
        <label class="rm-field rm-field--full">
          <span>Название *</span>
          <input v-model="createForm.title" type="text" placeholder="Frontend Developer — 2025" />
        </label>
        <label class="rm-field rm-field--full">
          <span>Краткое описание (summary)</span>
          <textarea v-model="createForm.summary" rows="2" placeholder="Кратко о себе: стек, уровень, цели" />
        </label>
      </div>
      <div class="rm-form-foot">
        <button class="primary-button" type="button" :disabled="isSavingResume" @click="handleCreate">
          {{ isSavingResume ? 'Создаём…' : 'Создать резюме' }}
        </button>
        <button class="ghost-button" type="button" @click="closeCreate">Отмена</button>
      </div>
    </div>

    <!-- Empty state (no resumes) -->
    <div v-if="!isLoading && !loadError && !resumes.length && !creatingResume" class="rm-empty">
      <div class="rm-empty-icon">📄</div>
      <strong>Резюме не найдено</strong>
      <p>Создайте первое резюме, чтобы откликаться на вакансии и добавлять опыт работы.</p>
      <button class="primary-button" type="button" @click="openCreate">Создать резюме</button>
    </div>

    <!-- Resume content (tabs + detail) -->
    <template v-if="resumes.length">
      <!-- Resume tabs -->
      <div class="rm-tabs-scroll">
        <div class="rm-tabs">
          <button
            v-for="r in resumes"
            :key="r.id"
            type="button"
            class="rm-tab"
            :class="{ 'rm-tab--active': selectedId === r.id }"
            @click="selectedId = r.id"
          >
            <span class="rm-tab-title">{{ r.title || 'Без названия' }}</span>
            <span v-if="r.is_primary" class="rm-badge-primary">Основное</span>
          </button>
        </div>
      </div>

      <!-- Selected resume detail -->
      <div v-if="selectedResume" class="rm-detail">

        <!-- Resume meta card -->
        <div class="rm-meta-card">
          <div class="rm-meta-top">
            <div class="rm-meta-title-row">
              <h3 class="rm-resume-title">{{ selectedResume.title || 'Без названия' }}</h3>
              <span v-if="selectedResume.is_primary" class="rm-badge-primary rm-badge-lg">⭐ Основное</span>
            </div>
            <button
              v-if="!selectedResume.is_primary"
              class="rm-btn rm-btn-outline rm-btn-sm"
              type="button"
              :disabled="settingPrimaryId === selectedResume.id"
              @click="handleSetPrimary(selectedResume.id)"
            >
              {{ settingPrimaryId === selectedResume.id ? 'Обновляем…' : 'Сделать основным' }}
            </button>
          </div>

          <div class="rm-meta-grid">
            <div v-if="selectedResume.summary" class="rm-meta-block rm-meta-block--wide">
              <span class="rm-meta-label">Summary</span>
              <p class="rm-meta-text">{{ selectedResume.summary }}</p>
            </div>
            <div class="rm-meta-block">
              <span class="rm-meta-label">Создано</span>
              <p class="rm-meta-value">{{ selectedResume.created_at ? formatDate(selectedResume.created_at) : '—' }}</p>
            </div>
            <div class="rm-meta-block">
              <span class="rm-meta-label">Обновлено</span>
              <p class="rm-meta-value">{{ selectedResume.updated_at ? formatDate(selectedResume.updated_at) : '—' }}</p>
            </div>
          </div>
        </div>

        <!-- Work experience -->
        <div class="rm-we-wrapper">
          <WorkExperienceSection
            :key="selectedResume.id"
            :resume-id="selectedResume.id"
            :companies="companies"
          />
        </div>

      </div>
    </template>
  </section>
</template>

<style scoped>
.rm-root {
  display: grid;
  gap: 18px;
  padding: 22px;
  border: 1px solid var(--border);
  border-radius: 22px;
  background: linear-gradient(180deg, rgba(255,255,255,.98), rgba(250,251,254,.92));
}

/* header */
.rm-section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.rm-section-head > div { display: grid; gap: 4px; }

.section-kicker {
  margin: 0;
  font: 700 0.72rem/1 var(--font-mono, monospace);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: #2952cc;
}

.rm-section-head h2 {
  margin: 0;
  font-family: var(--font-heading);
  font-size: 1.35rem;
  color: var(--text);
  line-height: 1.05;
}

.rm-desc { margin: 0; font-size: 0.83rem; color: #697588; }

/* status */
.rm-status {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 11px 14px;
  border: 1px solid var(--border);
  border-radius: 11px;
  font-size: 0.87rem;
  color: var(--muted);
}
.rm-status--error { border-color: var(--border-red); background: var(--surface-red); color: #991b1b; }

.rm-spinner {
  display: inline-block;
  width: 14px; height: 14px;
  border: 2px solid #dde9f8;
  border-top-color: #2952cc;
  border-radius: 50%;
  animation: spin .7s linear infinite;
  flex-shrink: 0;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* empty */
.rm-empty {
  display: grid;
  gap: 10px;
  justify-items: center;
  text-align: center;
  padding: 36px 24px;
  border: 1.5px dashed #dde6f0;
  border-radius: 16px;
  background: var(--surface-strong);
}
.rm-empty-icon { font-size: 2rem; }
.rm-empty strong { font-size: 0.95rem; color: var(--text); }
.rm-empty p { margin: 0; font-size: 0.83rem; color: var(--border-strong); max-width: 32ch; }

/* create form */
.rm-create-form {
  border: 1px solid #bdd3f5;
  border-radius: 14px;
  overflow: hidden;
}

.rm-form-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  background: #eef4ff;
  border-bottom: 1px solid #d4e5f9;
  font-size: 0.88rem;
  font-weight: 600;
  color: #1e3a8a;
}

.rm-close {
  width: 24px; height: 24px;
  border: 1px solid #c7d7f0;
  border-radius: 6px;
  background: var(--surface);
  color: var(--muted);
  font-size: 0.76rem;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}

.rm-form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 11px;
  padding: 14px;
  background: var(--surface-blue);
}

.rm-field { display: grid; gap: 5px; }
.rm-field--full { grid-column: 1 / -1; }
.rm-field span { font-size: 0.8rem; font-weight: 600; color: #4f6077; }

.rm-field input,
.rm-field textarea {
  min-height: 40px;
  padding: 0 12px;
  border: 1px solid #d8e0ea;
  border-radius: 10px;
  background: var(--surface);
  font: inherit;
  font-size: 0.86rem;
  color: var(--text);
  outline: none;
  transition: border-color .15s, box-shadow .15s;
}
.rm-field textarea { min-height: 72px; padding: 10px 12px; resize: vertical; }
.rm-field input:focus, .rm-field textarea:focus {
  border-color: rgba(41,82,204,.4);
  box-shadow: 0 0 0 3px rgba(41,82,204,.07);
}

.rm-form-foot {
  display: flex;
  gap: 8px;
  padding: 10px 14px;
  border-top: 1px solid #d4e5f9;
  background: #eef4ff;
}

/* tabs */
.rm-tabs-scroll { overflow-x: auto; padding-bottom: 2px; }

.rm-tabs {
  display: flex;
  gap: 6px;
  min-width: max-content;
}

.rm-tab {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 36px;
  padding: 0 14px;
  border: 1px solid #d8e0ea;
  border-radius: 10px;
  background: var(--surface);
  color: var(--muted);
  font-size: 0.84rem;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: all .15s;
}
.rm-tab:hover { border-color: #aac4f0; background: #f0f5ff; }
.rm-tab--active { border-color: #2952cc; background: #eef3ff; color: #2952cc; font-weight: 700; }

.rm-tab-title { max-width: 160px; overflow: hidden; text-overflow: ellipsis; }

/* badges */
.rm-badge-primary {
  height: 18px;
  padding: 0 7px;
  border-radius: 5px;
  background: #fef3c7;
  color: #92400e;
  font-size: 0.65rem;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
}
.rm-badge-lg { height: 22px; padding: 0 10px; font-size: 0.72rem; }

/* detail */
.rm-detail { display: grid; gap: 14px; }

.rm-meta-card {
  padding: 16px 18px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--surface);
  display: grid;
  gap: 14px;
}

.rm-meta-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.rm-meta-title-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

.rm-resume-title { margin: 0; font-family: var(--font-heading); font-size: 1.05rem; color: var(--text); }

.rm-meta-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.rm-meta-block {
  display: grid;
  gap: 3px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--surface-strong);
  border: 1px solid #f1f5f9;
}
.rm-meta-block--wide { grid-column: 1 / -1; }

.rm-meta-label {
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .05em;
  color: var(--border-strong);
}

.rm-meta-text {
  margin: 0;
  font-size: 0.84rem;
  color: var(--muted);
  line-height: 1.55;
}

.rm-meta-text--pre { white-space: pre-wrap; }

.rm-meta-value { margin: 0; font-size: 0.875rem; font-weight: 600; color: var(--text); }

/* work experience wrapper */
.rm-we-wrapper {
  padding: 16px 18px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--surface);
}

/* buttons */
.rm-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 34px;
  padding: 0 14px;
  border-radius: 9px;
  border: 1px solid transparent;
  font: inherit;
  font-size: 0.84rem;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  transition: all .15s;
  white-space: nowrap;
}
.rm-btn:disabled { opacity: .55; pointer-events: none; }

.rm-btn-accent {
  background: #2952cc;
  border-color: #2952cc;
  color: #fff;
}
.rm-btn-accent:hover { background: #1e40af; border-color: #1e40af; }

.rm-btn-outline {
  background: transparent;
  border-color: var(--border-strong);
  color: var(--muted);
}
.rm-btn-outline:hover { background: var(--surface-strong); border-color: var(--border-strong); }

.rm-btn-sm { min-height: 28px; padding: 0 12px; font-size: 0.78rem; border-radius: 7px; }

/* responsive */
@media (max-width: 700px) {
  .rm-form-grid, .rm-meta-grid { grid-template-columns: 1fr; }
  .rm-meta-block--wide { grid-column: 1; }
}
</style>
