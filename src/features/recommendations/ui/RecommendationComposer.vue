<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import axios from 'axios'

import { useSession } from '@/features/session/model/session'
import {
  createRecommendation,
  fetchContacts,
  fetchRecommendationOpportunities,
  getApiErrorMessage,
} from '@/shared/api'
import type { ContactDto, RecommendationOpportunityDto } from '@/shared/api'
import { showSuccessToast } from '@/shared/lib/toast'

const props = defineProps<{
  open: boolean
  toUserId?: string
  targetLabel?: string
  opportunityId?: string
  opportunityTitle?: string
}>()

const emit = defineEmits<{
  close: []
  submitted: []
}>()

const session = useSession()
const opportunities = ref<RecommendationOpportunityDto[]>([])
const contacts = ref<ContactDto[]>([])
const isLoading = ref(false)
const isSubmitting = ref(false)
const isSubmitted = ref(false)
const loadError = ref('')
const submitError = ref('')

const form = reactive({
  toUserId: '',
  opportunityId: '',
  message: '',
})

const needsRecipientPicker = computed(() => !props.toUserId)
const needsOpportunityPicker = computed(() => !props.opportunityId)

const selectedOpportunity = computed(() =>
  opportunities.value.find((o) => o.id === form.opportunityId) ?? null,
)
const selectedOpportunityLabel = computed(() => {
  if (selectedOpportunity.value) {
    return [selectedOpportunity.value.title, selectedOpportunity.value.company_name]
      .filter(Boolean).join(' · ')
  }
  return props.opportunityTitle ?? ''
})

function formatSalary(opp: RecommendationOpportunityDto): string {
  if (!opp.is_salary_visible) return ''
  const cur = opp.salary_currency ?? 'RUB'
  const symbol = cur === 'RUB' ? '₽' : cur
  if (opp.salary_min && opp.salary_max) {
    return `${opp.salary_min.toLocaleString('ru-RU')} – ${opp.salary_max.toLocaleString('ru-RU')} ${symbol}`
  }
  if (opp.salary_min) return `от ${opp.salary_min.toLocaleString('ru-RU')} ${symbol}`
  if (opp.salary_max) return `до ${opp.salary_max.toLocaleString('ru-RU')} ${symbol}`
  return ''
}

function formatWorkFormat(value?: string): string {
  const map: Record<string, string> = {
    remote: 'Удалённо', onsite: 'Офис', hybrid: 'Гибрид',
    online: 'Онлайн', offline: 'Оффлайн',
  }
  return value ? (map[value] ?? value) : ''
}

function formatLevel(value?: string): string {
  const map: Record<string, string> = {
    junior: 'Junior', middle: 'Middle', senior: 'Senior',
    lead: 'Lead', intern: 'Intern',
  }
  return value ? (map[value.toLowerCase()] ?? value) : ''
}

function getErrorKind(error: unknown) {
  if (axios.isAxiosError(error)) {
    const s = error.response?.status
    if (s === 403) return 'forbidden'
    if (s === 401) return 'unauthorized'
    if (s === 400) return 'bad_request'
  }
  return 'generic'
}

function formatSubmitError(error: unknown): string {
  const kind = getErrorKind(error)
  if (kind === 'forbidden') return 'У вас нет прав для отправки рекомендаций.'
  if (kind === 'unauthorized') return 'Необходима авторизация. Войдите в систему.'
  return getApiErrorMessage(error, 'Не удалось отправить рекомендацию.')
}

const selectedContactLabel = computed(() => {
  if (!needsRecipientPicker.value) return props.targetLabel ?? ''
  const raw = contacts.value.find((c) => {
    const uid = (c as Record<string, unknown>).user_id as string | undefined
    return uid === form.toUserId
  })
  if (!raw) return form.toUserId
  return (raw as Record<string, unknown>).display_name as string || form.toUserId
})

async function loadData() {
  isLoading.value = true
  loadError.value = ''

  if (needsOpportunityPicker.value) {
    try {
      opportunities.value = await fetchRecommendationOpportunities()
    } catch (error) {
      loadError.value = getApiErrorMessage(error, 'Не удалось загрузить список вакансий.')
    }
  }

  if (needsRecipientPicker.value && session.role.value === 'student') {
    try {
      contacts.value = await fetchContacts()
    } catch {
      // non-critical — falls back to text input
    }
  }

  isLoading.value = false
}

function close() {
  emit('close')
}

async function handleSubmit() {
  submitError.value = ''
  isSubmitting.value = true
  try {
    await createRecommendation({
      to_user_id: props.toUserId || form.toUserId,
      opportunity_id: props.opportunityId || form.opportunityId,
      message: form.message.trim() || undefined,
    })
    isSubmitted.value = true
    showSuccessToast('Рекомендация отправлена.')
    emit('submitted')
  } catch (error) {
    submitError.value = formatSubmitError(error)
  } finally {
    isSubmitting.value = false
  }
}

const canSubmit = computed(() => {
  const hasRecipient = Boolean(props.toUserId || form.toUserId.trim())
  const hasOpportunity = Boolean(props.opportunityId || form.opportunityId)
  return hasRecipient && hasOpportunity && !isSubmitting.value
})

watch(
  () => props.open,
  (open) => {
    if (!open) return
    form.toUserId = ''
    form.opportunityId = props.opportunityId ?? ''
    form.message = ''
    submitError.value = ''
    isSubmitted.value = false
    void loadData()
  },
)
</script>

<template>
  <div v-if="open" class="rc-overlay" @click.self="close">
    <div class="rc-card">

      <!-- Header -->
      <div class="rc-head">
        <div>
          <p class="rc-eyebrow">Recommendation</p>
          <h2 class="rc-title">Рекомендовать вакансию</h2>
          <p v-if="targetLabel && !needsRecipientPicker" class="rc-subtitle">
            Получатель: <strong>{{ targetLabel }}</strong>
          </p>
        </div>
        <button type="button" class="rc-icon-btn" @click="close">✕</button>
      </div>

      <!-- Success -->
      <div v-if="isSubmitted" class="rc-success">
        <div class="rc-success-icon">✓</div>
        <strong>Рекомендация отправлена</strong>
        <p>
          {{ selectedContactLabel || props.targetLabel || 'Получатель' }} получит уведомление
          <template v-if="selectedOpportunityLabel">о вакансии «{{ selectedOpportunityLabel }}»</template>.
        </p>
        <button type="button" class="rc-btn-primary" @click="close">Готово</button>
      </div>

      <!-- Form -->
      <form v-else class="rc-form" @submit.prevent="handleSubmit">

        <!-- Recipient: pre-filled -->
        <div v-if="!needsRecipientPicker" class="rc-field">
          <span class="rc-label">Получатель</span>
          <div class="rc-readonly">{{ targetLabel || toUserId }}</div>
        </div>
        <!-- Recipient: contacts dropdown -->
        <div v-else-if="contacts.length" class="rc-field">
          <span class="rc-label">Получатель</span>
          <select v-model="form.toUserId" required>
            <option value="">Выберите контакт</option>
            <option
              v-for="c in contacts"
              :key="(c as Record<string,unknown>).user_id as string || c.id"
              :value="(c as Record<string,unknown>).user_id as string || c.id"
            >
              {{ (c as Record<string,unknown>).display_name as string || c.id }}
            </option>
          </select>
        </div>
        <!-- Recipient: text input fallback -->
        <div v-else class="rc-field">
          <span class="rc-label">ID получателя</span>
          <input v-model="form.toUserId" type="text" placeholder="user_id получателя" required />
        </div>

        <!-- Opportunity: pre-filled -->
        <div v-if="!needsOpportunityPicker" class="rc-field">
          <span class="rc-label">Вакансия</span>
          <div class="rc-readonly">{{ opportunityTitle || opportunityId }}</div>
        </div>

        <!-- Opportunity: card picker -->
        <div v-else class="rc-field">
          <span class="rc-label">Вакансия</span>

          <div v-if="isLoading" class="rc-status">Загружаем вакансии…</div>
          <div v-else-if="loadError" class="rc-status rc-status--error">{{ loadError }}</div>

          <div v-else-if="!opportunities.length" class="rc-empty">
            Вакансии для рекомендации не найдены.
          </div>

          <div v-else class="rc-opp-list">
            <label
              v-for="opp in opportunities"
              :key="opp.id"
              class="rc-opp-card"
              :class="{ 'rc-opp-card--selected': form.opportunityId === opp.id }"
            >
              <input
                v-model="form.opportunityId"
                type="radio"
                :value="opp.id"
                class="rc-opp-radio"
              />

              <!-- Avatar -->
              <div class="rc-opp-avatar">
                <img
                  v-if="opp.company_avatar_url"
                  :src="opp.company_avatar_url"
                  :alt="opp.company_name ?? ''"
                />
                <span v-else>{{ (opp.company_name ?? opp.title).slice(0, 1).toUpperCase() }}</span>
              </div>

              <!-- Body -->
              <div class="rc-opp-body">
                <div class="rc-opp-top">
                  <strong class="rc-opp-title">{{ opp.title }}</strong>
                  <span v-if="formatSalary(opp)" class="rc-opp-salary">{{ formatSalary(opp) }}</span>
                </div>

                <div class="rc-opp-meta">
                  <span v-if="opp.company_name" class="rc-opp-company">{{ opp.company_name }}</span>
                  <span v-if="opp.work_format" class="rc-chip rc-chip--grey">{{ formatWorkFormat(opp.work_format) }}</span>
                  <span v-if="opp.vacancy_level" class="rc-chip rc-chip--blue">{{ formatLevel(opp.vacancy_level) }}</span>
                </div>

                <p v-if="opp.short_description" class="rc-opp-desc">{{ opp.short_description }}</p>

                <div v-if="opp.tags?.length" class="rc-opp-tags">
                  <span v-for="tag in opp.tags.slice(0, 5)" :key="tag" class="rc-tag">{{ tag }}</span>
                </div>
              </div>
            </label>
          </div>
        </div>

        <!-- Message -->
        <div class="rc-field">
          <span class="rc-label">Сообщение <span class="rc-optional">(необязательно)</span></span>
          <textarea v-model="form.message" rows="3" placeholder="Добавьте комментарий получателю…" />
        </div>

        <p v-if="submitError" class="rc-status rc-status--error">{{ submitError }}</p>

        <div class="rc-actions">
          <button class="rc-btn-primary" type="submit" :disabled="!canSubmit">
            {{ isSubmitting ? 'Отправляем…' : 'Отправить рекомендацию' }}
          </button>
          <button class="rc-ghost" type="button" @click="close">Отмена</button>
        </div>

      </form>
    </div>
  </div>
</template>

<style scoped>
.rc-overlay {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(6px);
}

.rc-card {
  width: min(620px, 100%);
  max-height: 90dvh;
  display: flex;
  flex-direction: column;
  gap: 0;
  border: 1px solid rgba(18, 38, 63, 0.08);
  border-radius: 20px;
  background: var(--surface);
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.2);
  overflow: hidden;
}

.rc-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  padding: 22px 24px 18px;
  border-bottom: 1px solid #f1f5f9;
  flex-shrink: 0;
}

.rc-eyebrow {
  margin: 0 0 4px;
  font: 700 0.68rem/1 var(--font-mono, monospace);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #2563eb;
}

.rc-title {
  margin: 0 0 4px;
  font-family: var(--font-heading);
  font-size: 1.1rem;
  color: var(--text);
}

.rc-subtitle {
  margin: 0;
  font-size: 0.82rem;
  color: var(--muted);
}
.rc-subtitle strong { color: var(--text); }

.rc-icon-btn {
  width: 30px;
  height: 30px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: transparent;
  color: var(--muted);
  font-size: 0.8rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.15s;
}
.rc-icon-btn:hover { background: var(--surface-strong); }

.rc-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px 24px 22px;
  overflow-y: auto;
}

.rc-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rc-label {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text);
}

.rc-optional {
  font-weight: 400;
  color: var(--border-strong);
}

.rc-field input[type="text"],
.rc-field select,
.rc-field textarea {
  min-height: 40px;
  padding: 9px 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface-strong);
  font: inherit;
  font-size: 0.875rem;
  color: var(--text);
  transition: border-color 0.15s, box-shadow 0.15s;
  outline: none;
}

.rc-field input[type="text"]:focus,
.rc-field select:focus,
.rc-field textarea:focus {
  border-color: #3b82f6;
  background: var(--surface);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.rc-field textarea { min-height: 80px; resize: vertical; }

.rc-readonly {
  min-height: 40px;
  padding: 9px 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface-muted);
  font-size: 0.875rem;
  color: var(--muted);
  display: flex;
  align-items: center;
}

/* Opportunity list */
.rc-opp-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 340px;
  overflow-y: auto;
  padding-right: 2px;
}

.rc-opp-card {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr);
  gap: 12px;
  align-items: start;
  padding: 12px 14px;
  border: 1.5px solid #e2e8f0;
  border-radius: 12px;
  background: var(--surface-strong);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
}

.rc-opp-card:hover {
  border-color: var(--accent-soft);
  background: #f0f7ff;
}

.rc-opp-card--selected {
  border-color: #2563eb;
  background: #eff6ff;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
}

.rc-opp-radio {
  display: none;
}

.rc-opp-avatar {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid var(--border);
  background: var(--surface-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  font-weight: 700;
  color: var(--muted);
  flex-shrink: 0;
}

.rc-opp-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.rc-opp-body {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.rc-opp-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

.rc-opp-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text);
  line-height: 1.3;
}

.rc-opp-salary {
  font-size: 0.8rem;
  font-weight: 600;
  color: #16a34a;
  white-space: nowrap;
}

.rc-opp-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 5px;
}

.rc-opp-company {
  font-size: 0.78rem;
  color: var(--muted);
}

.rc-chip {
  display: inline-flex;
  align-items: center;
  height: 18px;
  padding: 0 7px;
  border-radius: 5px;
  font-size: 0.68rem;
  font-weight: 600;
  white-space: nowrap;
}

.rc-chip--grey { background: #f1f5f9; color: var(--muted); }
.rc-chip--blue { background: #dbeafe; color: #1d4ed8; }

.rc-opp-desc {
  margin: 0;
  font-size: 0.78rem;
  color: var(--muted);
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.rc-opp-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 2px;
}

.rc-tag {
  display: inline-flex;
  align-items: center;
  height: 18px;
  padding: 0 7px;
  border-radius: 5px;
  background: #f0fdf4;
  color: #15803d;
  font-size: 0.66rem;
  font-weight: 600;
}

.rc-empty {
  padding: 24px 16px;
  border: 1.5px dashed #e2e8f0;
  border-radius: 12px;
  text-align: center;
  font-size: 0.84rem;
  color: var(--border-strong);
}

.rc-status {
  margin: 0;
  font-size: 0.84rem;
  color: var(--muted);
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--surface-strong);
  border: 1px solid var(--border);
}

.rc-status--error {
  color: #991b1b;
  background: #fef2f2;
  border-color: #fca5a5;
}

.rc-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  padding-top: 2px;
}

.rc-btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  padding: 0 20px;
  border: none;
  border-radius: 10px;
  background: #2563eb;
  color: #fff;
  font: inherit;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}
.rc-btn-primary:hover { background: #1d4ed8; }
.rc-btn-primary:disabled { opacity: 0.5; pointer-events: none; }

.rc-ghost {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  padding: 0 16px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: transparent;
  color: var(--muted);
  font: inherit;
  font-size: 0.875rem;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.rc-ghost:hover { background: var(--surface-strong); border-color: var(--border-strong); }

/* Success */
.rc-success {
  display: grid;
  gap: 10px;
  padding: 24px;
  text-align: center;
  justify-items: center;
}

.rc-success-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: #dcfce7;
  color: #16a34a;
  font-size: 1.3rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.rc-success strong { font-size: 1rem; color: var(--text); }
.rc-success p { margin: 0; font-size: 0.86rem; color: var(--muted); line-height: 1.5; }

@media (max-width: 640px) {
  .rc-overlay { padding: 12px; }
  .rc-head { padding: 16px 18px 14px; }
  .rc-form { padding: 16px 18px 18px; }
}
</style>
