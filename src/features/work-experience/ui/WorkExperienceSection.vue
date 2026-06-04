<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'

import {
  createWorkExperience,
  deleteWorkExperience,
  fetchWorkExperiences,
  getApiErrorMessage,
  updateWorkExperience,
} from '@/shared/api'
import type { EmployerCompanyDto, WorkExperienceDto, WorkExperienceInput } from '@/shared/api'
import { showErrorToast, showSuccessToast } from '@/shared/lib/toast'

const props = defineProps<{
  resumeId: string
  companies: EmployerCompanyDto[]
}>()

// ── List ──────────────────────────────────────────────────────────────────────
const experiences = ref<WorkExperienceDto[]>([])
const isLoading = ref(false)
const loadError = ref('')

// ── Form ──────────────────────────────────────────────────────────────────────
const formOpen = ref(false)
const editingId = ref<string | null>(null)
const isSaving = ref(false)
const deletingId = ref('')

const form = reactive({
  position_title: '',
  started_at: '',
  finished_at: '',
  description: '',
  is_current: false,
})

// ── Company ───────────────────────────────────────────────────────────────────
const companyMode = ref<'search' | 'manual'>('search')
const companyQuery = ref('')
const selectedCompany = ref<EmployerCompanyDto | null>(null)
const manualCompanyName = ref('')

const filteredCompanies = computed(() => {
  const q = companyQuery.value.trim().toLowerCase()
  if (!q) return props.companies.slice(0, 8)
  return props.companies
    .filter((c) => {
      const name = (c.brand_name || c.legal_name || '').toLowerCase()
      return name.includes(q)
    })
    .slice(0, 8)
})

const showDropdown = computed(
  () => companyMode.value === 'search' && !selectedCompany.value && companyQuery.value.length >= 1,
)

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatMonthYear(dateStr?: string): string {
  if (!dateStr) return ''
  const [year, month] = dateStr.split('-').map(Number)
  return new Date(year, (month || 1) - 1, 1).toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'short',
  })
}

function companyDisplayName(exp: WorkExperienceDto) {
  return exp.company?.brand_name || exp.company?.legal_name || exp.company_name || 'Компания не указана'
}

// ── Load ──────────────────────────────────────────────────────────────────────
async function load() {
  if (!props.resumeId) return
  isLoading.value = true
  loadError.value = ''
  try {
    experiences.value = await fetchWorkExperiences(props.resumeId)
  } catch (e) {
    loadError.value = getApiErrorMessage(e, 'Не удалось загрузить опыт работы.')
  } finally {
    isLoading.value = false
  }
}

// ── Company selection ─────────────────────────────────────────────────────────
function selectCompany(c: EmployerCompanyDto) {
  selectedCompany.value = c
  companyQuery.value = c.brand_name || c.legal_name || ''
}

function clearCompany() {
  selectedCompany.value = null
  companyQuery.value = ''
}

watch(companyQuery, () => {
  if (selectedCompany.value) {
    const q = companyQuery.value
    const name = selectedCompany.value.brand_name || selectedCompany.value.legal_name || ''
    if (q !== name) selectedCompany.value = null
  }
})

// ── Form open / close ─────────────────────────────────────────────────────────
function resetForm() {
  form.position_title = ''
  form.started_at = ''
  form.finished_at = ''
  form.description = ''
  form.is_current = false
  companyMode.value = 'search'
  clearCompany()
  manualCompanyName.value = ''
}

function openAdd() {
  editingId.value = null
  resetForm()
  formOpen.value = true
}

function openEdit(exp: WorkExperienceDto) {
  editingId.value = exp.id
  form.position_title = exp.position_title
  form.started_at = exp.started_at ?? ''
  form.finished_at = exp.finished_at ?? ''
  form.is_current = !exp.finished_at
  form.description = exp.description ?? ''

  if (exp.company) {
    companyMode.value = 'search'
    selectedCompany.value = exp.company as EmployerCompanyDto
    companyQuery.value = exp.company.brand_name || exp.company.legal_name || ''
    manualCompanyName.value = ''
  } else if (exp.company_name) {
    companyMode.value = 'manual'
    manualCompanyName.value = exp.company_name
    clearCompany()
  } else {
    companyMode.value = 'search'
    clearCompany()
    manualCompanyName.value = ''
  }

  formOpen.value = true
}

function closeForm() {
  formOpen.value = false
  editingId.value = null
}

// ── Save ──────────────────────────────────────────────────────────────────────
async function handleSave() {
  if (!form.position_title.trim()) { showErrorToast('Укажите должность.'); return }
  if (!form.started_at) { showErrorToast('Укажите дату начала.'); return }

  const payload: WorkExperienceInput = {
    position_title: form.position_title.trim(),
    started_at: form.started_at,
    finished_at: form.is_current ? undefined : (form.finished_at || undefined),
    description: form.description.trim() || undefined,
  }

  if (companyMode.value === 'search' && selectedCompany.value) {
    payload.company_id = selectedCompany.value.id
  } else if (companyMode.value === 'manual' && manualCompanyName.value.trim()) {
    payload.company_name = manualCompanyName.value.trim()
  }

  isSaving.value = true
  try {
    if (editingId.value) {
      const updated = await updateWorkExperience(props.resumeId, editingId.value, payload)
      const idx = experiences.value.findIndex((e) => e.id === editingId.value)
      if (idx !== -1) experiences.value[idx] = updated
      showSuccessToast('Опыт работы обновлён.')
    } else {
      const created = await createWorkExperience(props.resumeId, payload)
      experiences.value.unshift(created)
      showSuccessToast('Запись добавлена.')
    }
    closeForm()
  } catch (e) {
    showErrorToast(getApiErrorMessage(e, 'Не удалось сохранить.'))
  } finally {
    isSaving.value = false
  }
}

// ── Delete ────────────────────────────────────────────────────────────────────
async function handleDelete(exp: WorkExperienceDto) {
  if (!confirm(`Удалить «${exp.position_title}»?`)) return
  deletingId.value = exp.id
  try {
    await deleteWorkExperience(props.resumeId, exp.id)
    experiences.value = experiences.value.filter((e) => e.id !== exp.id)
    showSuccessToast('Запись удалена.')
  } catch (e) {
    showErrorToast(getApiErrorMessage(e, 'Не удалось удалить.'))
  } finally {
    deletingId.value = ''
  }
}

watch(() => props.resumeId, load)
onMounted(load)
</script>

<template>
  <div class="we-root">
    <div class="we-header">
      <div>
        <p class="we-kicker">Experience</p>
        <h3 class="we-title">Опыт работы</h3>
      </div>
      <button v-if="!formOpen" class="we-add-btn" type="button" @click="openAdd">
        + Добавить
      </button>
    </div>

    <!-- Loading / error -->
    <div v-if="isLoading" class="we-msg">
      <span class="we-spinner"></span> Загружаем…
    </div>
    <div v-else-if="loadError" class="we-msg we-msg--error">{{ loadError }}</div>

    <!-- List -->
    <div v-if="experiences.length" class="we-list">
      <div v-for="exp in experiences" :key="exp.id" class="we-card">
        <div class="we-avatar">
          <img v-if="exp.company?.avatar_url" :src="exp.company.avatar_url" :alt="companyDisplayName(exp)" />
          <span v-else>{{ companyDisplayName(exp).slice(0,1) }}</span>
        </div>
        <div class="we-info">
          <div class="we-info-top">
            <strong>{{ exp.position_title }}</strong>
            <span v-if="!exp.finished_at" class="we-badge-now">Сейчас</span>
          </div>
          <a
            v-if="exp.company?.website_url"
            :href="exp.company.website_url"
            target="_blank" rel="noopener noreferrer"
            class="we-company-link"
          >{{ companyDisplayName(exp) }}</a>
          <span v-else class="we-company-text">{{ companyDisplayName(exp) }}</span>
          <span class="we-dates">
            {{ formatMonthYear(exp.started_at) }} — {{ exp.finished_at ? formatMonthYear(exp.finished_at) : 'по настоящее время' }}
          </span>
          <p v-if="exp.description" class="we-desc">{{ exp.description }}</p>
        </div>
        <div class="we-actions">
          <button class="we-btn-icon" type="button" title="Редактировать" @click="openEdit(exp)">✏️</button>
          <button
            class="we-btn-icon we-btn-icon--del"
            type="button"
            :disabled="deletingId === exp.id"
            @click="handleDelete(exp)"
          >{{ deletingId === exp.id ? '…' : '🗑' }}</button>
        </div>
      </div>
    </div>

    <div v-else-if="!isLoading && !loadError && !formOpen" class="we-empty">
      <span>💼</span>
      <p>Опыт работы не добавлен. Нажмите «Добавить», чтобы внести первое место работы.</p>
    </div>

    <!-- Form -->
    <div v-if="formOpen" class="we-form">
      <div class="we-form-head">
        <span>{{ editingId ? 'Редактировать запись' : 'Новое место работы' }}</span>
        <button type="button" class="we-close" @click="closeForm">✕</button>
      </div>

      <div class="we-form-body">
        <!-- Position -->
        <label class="we-field we-field--full">
          <span>Должность *</span>
          <input v-model="form.position_title" type="text" placeholder="Frontend Developer" />
        </label>

        <!-- Company toggle -->
        <div class="we-field we-field--full">
          <span>Компания</span>
          <div class="we-tabs">
            <button type="button" :class="['we-tab', { active: companyMode === 'search' }]" @click="companyMode = 'search'; manualCompanyName = ''">Из системы</button>
            <button type="button" :class="['we-tab', { active: companyMode === 'manual' }]" @click="companyMode = 'manual'; clearCompany()">Вручную</button>
          </div>
        </div>

        <!-- Company from system -->
        <div v-if="companyMode === 'search'" class="we-field we-field--full">
          <div v-if="selectedCompany" class="we-selected">
            <div class="we-sel-avatar">
              <img v-if="selectedCompany.avatar_url" :src="selectedCompany.avatar_url" alt="" />
              <span v-else>{{ (selectedCompany.brand_name || selectedCompany.legal_name || '?')[0] }}</span>
            </div>
            <span class="we-sel-name">{{ selectedCompany.brand_name || selectedCompany.legal_name }}</span>
            <button type="button" class="we-close we-close--sm" @click="clearCompany">✕</button>
          </div>
          <div v-else class="we-search-wrap">
            <input v-model="companyQuery" type="text" placeholder="Начните вводить название…" class="we-input" />
            <ul v-if="showDropdown && filteredCompanies.length" class="we-dropdown">
              <li
                v-for="c in filteredCompanies"
                :key="c.id"
                class="we-dropdown-item"
                @mousedown.prevent="selectCompany(c)"
              >
                <div class="we-drop-avatar">
                  <img v-if="c.avatar_url" :src="c.avatar_url" alt="" />
                  <span v-else>{{ (c.brand_name || c.legal_name || '?')[0] }}</span>
                </div>
                <div>
                  <strong>{{ c.brand_name || c.legal_name }}</strong>
                  <span v-if="c.brand_name && c.legal_name">{{ c.legal_name }}</span>
                </div>
              </li>
            </ul>
            <p v-else-if="showDropdown && !filteredCompanies.length" class="we-no-results">
              Не найдено. <button type="button" class="we-link" @click="companyMode = 'manual'">Ввести вручную</button>
            </p>
          </div>
        </div>

        <!-- Manual company -->
        <label v-if="companyMode === 'manual'" class="we-field we-field--full">
          <span>Название компании</span>
          <input v-model="manualCompanyName" type="text" placeholder="ООО Ромашка" />
        </label>

        <!-- Dates -->
        <label class="we-field">
          <span>Дата начала *</span>
          <input v-model="form.started_at" type="date" />
        </label>
        <label class="we-field">
          <span>Дата окончания</span>
          <input v-model="form.finished_at" type="date" :disabled="form.is_current" />
        </label>

        <!-- Current -->
        <label class="we-field we-field--full we-checkbox">
          <input v-model="form.is_current" type="checkbox" />
          <span>Текущее место работы</span>
        </label>

        <!-- Description -->
        <label class="we-field we-field--full">
          <span>Обязанности и достижения</span>
          <textarea v-model="form.description" rows="3" placeholder="Кратко опишите задачи и результаты…" />
        </label>
      </div>

      <div class="we-form-foot">
        <button class="primary-button" type="button" :disabled="isSaving" @click="handleSave">
          {{ isSaving ? 'Сохраняем…' : editingId ? 'Сохранить' : 'Добавить' }}
        </button>
        <button class="ghost-button" type="button" @click="closeForm">Отмена</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.we-root { display: grid; gap: 14px; }

.we-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 8px;
}

.we-kicker {
  margin: 0;
  font: 700 0.65rem/1 var(--font-mono, monospace);
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: #2952cc;
}

.we-title { margin: 0; font-family: var(--font-heading); font-size: 1.05rem; color: var(--text); }

.we-add-btn {
  height: 32px;
  padding: 0 14px;
  border: 1px solid #2952cc;
  border-radius: 9px;
  background: #eef3ff;
  color: #2952cc;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}
.we-add-btn:hover { background: #dde8ff; }

/* msg */
.we-msg {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  font-size: 0.86rem;
  color: var(--muted);
}
.we-msg--error { border-color: var(--border-red); background: var(--surface-red); color: #991b1b; }

.we-spinner {
  display: inline-block;
  width: 13px; height: 13px;
  border: 2px solid #dde9f8;
  border-top-color: #2952cc;
  border-radius: 50%;
  animation: spin .7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* empty */
.we-empty {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px;
  border: 1.5px dashed #dde6f0;
  border-radius: 12px;
  font-size: 0.84rem;
  color: var(--muted);
}
.we-empty span { font-size: 1.3rem; flex-shrink: 0; }
.we-empty p { margin: 0; }

/* list */
.we-list { display: grid; gap: 8px; }

.we-card {
  display: grid;
  grid-template-columns: 40px minmax(0,1fr) auto;
  gap: 10px;
  align-items: start;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
}
.we-card:hover { border-color: #c7d7f0; }

.we-avatar {
  width: 40px; height: 40px;
  border-radius: 9px;
  overflow: hidden;
  border: 1px solid var(--border);
  background: var(--surface-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--muted);
  flex-shrink: 0;
}
.we-avatar img { width: 100%; height: 100%; object-fit: cover; }

.we-info { display: grid; gap: 2px; min-width: 0; }
.we-info-top { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
.we-info-top strong { font-size: 0.88rem; font-weight: 600; color: var(--text); }

.we-badge-now {
  height: 17px;
  padding: 0 7px;
  border-radius: 5px;
  background: var(--chip-green);
  color: var(--success);
  font-size: 0.66rem;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
}

.we-company-link { font-size: 0.8rem; color: #2563eb; text-decoration: none; }
.we-company-link:hover { text-decoration: underline; }
.we-company-text { font-size: 0.8rem; color: var(--muted); }
.we-dates { font-size: 0.73rem; color: var(--border-strong); }
.we-desc { margin: 3px 0 0; font-size: 0.79rem; color: var(--muted); line-height: 1.5; }

.we-actions { display: flex; gap: 3px; }

.we-btn-icon {
  width: 28px; height: 28px;
  border-radius: 7px;
  border: 1px solid var(--border);
  background: var(--surface-strong);
  cursor: pointer;
  font-size: 0.8rem;
  display: flex;
  align-items: center;
  justify-content: center;
}
.we-btn-icon:hover { background: var(--surface-muted); }
.we-btn-icon:disabled { opacity: .5; pointer-events: none; }
.we-btn-icon--del:hover { background: var(--surface-red); border-color: var(--border-red); }

/* form */
.we-form {
  border: 1px solid #bdd3f5;
  border-radius: 14px;
  overflow: hidden;
}

.we-form-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  background: #eef4ff;
  border-bottom: 1px solid #d4e5f9;
  font-size: 0.87rem;
  font-weight: 600;
  color: #1e3a8a;
}

.we-close {
  width: 24px; height: 24px;
  border: 1px solid #c7d7f0;
  border-radius: 6px;
  background: var(--surface);
  color: var(--muted);
  font-size: 0.76rem;
  cursor: pointer;
}

.we-close--sm { width: 20px; height: 20px; border-radius: 5px; font-size: 0.7rem; }

.we-form-body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  padding: 14px;
  background: var(--surface-blue);
}

.we-field { display: grid; gap: 5px; }
.we-field--full { grid-column: 1 / -1; }

.we-field > span {
  font-size: 0.79rem;
  font-weight: 600;
  color: #4f6077;
}

.we-field input,
.we-field textarea,
.we-input {
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
  width: 100%;
  box-sizing: border-box;
}
.we-field textarea { min-height: 76px; padding: 10px 12px; resize: vertical; }
.we-field input:focus, .we-field textarea:focus, .we-input:focus {
  border-color: rgba(41,82,204,.4);
  box-shadow: 0 0 0 3px rgba(41,82,204,.07);
}
.we-field input:disabled { background: var(--surface-muted); color: var(--border-strong); }

/* tabs */
.we-tabs { display: flex; gap: 5px; }
.we-tab {
  height: 28px;
  padding: 0 12px;
  border: 1px solid #d8e0ea;
  border-radius: 7px;
  background: var(--surface);
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 500;
  cursor: pointer;
}
.we-tab.active { border-color: #2952cc; background: #eef3ff; color: #2952cc; font-weight: 700; }

/* company search */
.we-search-wrap { position: relative; }

.we-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0; right: 0;
  z-index: 30;
  margin: 0;
  padding: 4px;
  list-style: none;
  border: 1px solid #d4e5f9;
  border-radius: 10px;
  background: var(--surface);
  box-shadow: 0 8px 20px rgba(15,23,42,.1);
  max-height: 200px;
  overflow-y: auto;
}

.we-dropdown-item {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 7px 9px;
  border-radius: 7px;
  cursor: pointer;
}
.we-dropdown-item:hover { background: #eef4ff; }
.we-dropdown-item strong { font-size: 0.83rem; color: var(--text); display: block; }
.we-dropdown-item span { font-size: 0.73rem; color: var(--muted); }

.we-drop-avatar {
  width: 28px; height: 28px;
  border-radius: 6px;
  overflow: hidden;
  background: var(--surface-muted);
  border: 1px solid var(--border);
  display: flex; align-items: center; justify-content: center;
  font-size: 0.78rem; font-weight: 700; color: var(--muted);
  flex-shrink: 0;
}
.we-drop-avatar img { width: 100%; height: 100%; object-fit: cover; }

.we-no-results { margin: 6px 0 0; font-size: 0.78rem; color: var(--border-strong); }
.we-link { border: none; background: none; color: #2952cc; font-size: .78rem; font-weight: 600; cursor: pointer; text-decoration: underline; padding: 0; }

/* selected company */
.we-selected {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border: 1px solid #bdd3f5;
  border-radius: 10px;
  background: #eef4ff;
}
.we-sel-avatar {
  width: 26px; height: 26px;
  border-radius: 6px;
  overflow: hidden;
  background: var(--chip-blue);
  display: flex; align-items: center; justify-content: center;
  font-size: 0.72rem; font-weight: 700; color: var(--chip-blue-text);
  flex-shrink: 0;
}
.we-sel-avatar img { width: 100%; height: 100%; object-fit: cover; }
.we-sel-name { flex: 1; font-size: 0.86rem; font-weight: 600; color: #1e3a8a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* checkbox */
.we-checkbox { flex-direction: row; align-items: center; gap: 8px; cursor: pointer; }
.we-checkbox input { width: 15px; height: 15px; accent-color: #2952cc; cursor: pointer; margin: 0; }
.we-checkbox span { font-size: 0.84rem; color: var(--text); }

/* form footer */
.we-form-foot {
  display: flex;
  gap: 8px;
  padding: 10px 14px;
  border-top: 1px solid #d4e5f9;
  background: #eef4ff;
}
</style>
