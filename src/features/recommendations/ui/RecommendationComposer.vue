<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'

import type { Opportunity } from '@/entities/opportunity/model/types'
import { useSession } from '@/features/session/model/session'
import { createRecommendation, fetchEmployerOpportunities, getApiErrorMessage } from '@/shared/api'
import { showErrorToast, showSuccessToast } from '@/shared/lib/toast'

const props = defineProps<{
  open: boolean
  toUserId: string
  targetLabel: string
}>()

const emit = defineEmits<{
  close: []
  submitted: []
}>()

const session = useSession()
const opportunities = ref<Opportunity[]>([])
const isLoading = ref(false)
const opportunitiesError = ref('')
const submitError = ref('')
const isSubmitting = ref(false)
const isSubmitted = ref(false)

const form = reactive({
  toUserId: '',
  opportunityId: '',
  message: '',
})

const selectedOpportunity = computed(() =>
  opportunities.value.find((item) => item.id === form.opportunityId) ?? null,
)

async function loadOpportunities() {
  isLoading.value = true
  opportunitiesError.value = ''

  try {
    if (session.role.value !== 'employer') {
      opportunities.value = []
      opportunitiesError.value = 'Рекомендации доступны только работодателям с собственными возможностями.'
      return
    }

    opportunities.value = await fetchEmployerOpportunities()
  } catch (error) {
    opportunitiesError.value = getApiErrorMessage(error, 'Не удалось загрузить список возможностей работодателя.')
  } finally {
    isLoading.value = false
  }
}

function close() {
  emit('close')
}

async function handleSubmit() {
  submitError.value = ''
  isSubmitting.value = true

  try {
    await createRecommendation({
      to_user_id: form.toUserId,
      opportunity_id: form.opportunityId,
      message: form.message.trim() || undefined,
    })

    isSubmitted.value = true
    showSuccessToast('Рекомендация отправлена.')
    emit('submitted')
  } catch (error) {
    submitError.value = getApiErrorMessage(error, 'Не удалось отправить рекомендацию.')
    showErrorToast(submitError.value)
  } finally {
    isSubmitting.value = false
  }
}

watch(
  () => props.open,
  (open) => {
    if (!open) {
      return
    }

    form.toUserId = props.toUserId
    form.opportunityId = ''
    form.message = ''
    submitError.value = ''
    isSubmitted.value = false

    if (!opportunities.value.length && !isLoading.value) {
      void loadOpportunities()
    }
  },
)
</script>

<template>
  <div v-if="open" class="modal-overlay" @click.self="close">
    <div class="modal-card">
      <div class="modal-head">
        <div>
          <p class="eyebrow">Recommendation</p>
          <h2>Рекомендовать соискателя</h2>
          <p class="helper-text">История рекомендаций появится после расширения API.</p>
        </div>
        <button type="button" class="ghost-button close-button" @click="close">Закрыть</button>
      </div>

      <div v-if="isSubmitted" class="success-state">
        <strong>Рекомендация отправлена</strong>
        <p>
          {{ props.targetLabel }} получил рекомендацию
          <span v-if="selectedOpportunity">на «{{ selectedOpportunity.title }}»</span>.
        </p>
        <button type="button" class="primary-button" @click="close">Готово</button>
      </div>

      <form v-else class="modal-form" @submit.prevent="handleSubmit">
        <label class="field">
          <span>Получатель</span>
          <input :value="form.toUserId" type="text" readonly />
        </label>

        <label class="field">
          <span>Возможность</span>
          <select v-model="form.opportunityId" :disabled="isLoading || !opportunities.length" required>
            <option value="">Выберите возможность</option>
            <option v-for="opportunity in opportunities" :key="opportunity.id" :value="opportunity.id">
              {{ opportunity.title }} · {{ opportunity.companyName }}
            </option>
          </select>
        </label>

        <p v-if="opportunitiesError" class="status-text error">{{ opportunitiesError }}</p>
        <p v-else-if="isLoading" class="status-text">Загружаем список вакансий...</p>
        <p v-else-if="!opportunities.length" class="status-text">
          Пока нет доступных возможностей для рекомендации.
        </p>

        <label class="field">
          <span>Комментарий</span>
          <textarea
            v-model="form.message"
            rows="5"
            placeholder="Коротко объясните, почему этот кандидат подходит."
          />
        </label>

        <p v-if="submitError" class="status-text error">{{ submitError }}</p>

        <div class="modal-actions">
          <button
            class="primary-button"
            type="submit"
            :disabled="isSubmitting || isLoading || !form.opportunityId"
          >
            {{ isSubmitting ? 'Отправляем...' : 'Отправить рекомендацию' }}
          </button>
          <button class="ghost-button" type="button" @click="close">Отмена</button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(15, 23, 42, 0.42);
  backdrop-filter: blur(6px);
}

.modal-card {
  width: min(680px, 100%);
  display: grid;
  gap: 16px;
  padding: 20px;
  border: 1px solid rgba(18, 38, 63, 0.08);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.22);
}

.modal-head,
.modal-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: start;
  justify-content: space-between;
}

.modal-form,
.success-state {
  display: grid;
  gap: 14px;
}

.eyebrow {
  margin: 0 0 6px;
  color: #2952cc;
  font: 700 0.72rem/1 var(--font-mono);
  text-transform: uppercase;
}

h2,
p {
  margin: 0;
}

.helper-text,
.status-text,
.success-state p {
  color: #5f6b7a;
  line-height: 1.5;
}

.status-text.error {
  color: var(--danger);
}

.field {
  display: grid;
  gap: 8px;
}

.field span {
  color: #334155;
  font-size: 0.82rem;
  font-weight: 600;
}

.field input,
.field select,
.field textarea {
  min-height: 44px;
  padding: 11px 13px;
  border: 1px solid rgba(148, 163, 184, 0.3);
  border-radius: 10px;
  background: #fff;
  font: inherit;
}

.field textarea {
  min-height: 120px;
  resize: vertical;
}

.success-state {
  padding: 6px 0 2px;
}

.success-state strong {
  color: #162033;
  font-size: 1.05rem;
}

.close-button {
  min-height: 38px;
}

@media (max-width: 720px) {
  .modal-overlay {
    padding: 12px;
  }

  .modal-card {
    padding: 16px;
    border-radius: 16px;
  }
}
</style>
