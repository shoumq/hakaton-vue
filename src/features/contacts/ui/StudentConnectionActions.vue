<script setup lang="ts">
import type { ApplicantConnectionRelation } from '@/features/contacts/model/network'

defineProps<{
  relation: ApplicantConnectionRelation
  contactLoading?: boolean
  chatLoading?: boolean
  recommendationDisabled?: boolean
}>()

defineEmits<{
  add: []
  accept: []
  reject: []
  cancel: []
  message: []
  recommend: []
}>()
</script>

<template>
  <div v-if="relation !== 'self'" class="action-row">
    <button
      class="primary-button"
      type="button"
      :disabled="relation === 'contact' || relation === 'outgoing_pending' || contactLoading"
      @click="relation === 'incoming_pending' ? $emit('accept') : $emit('add')"
    >
      {{
        contactLoading
          ? 'Сохраняем...'
          : relation === 'contact'
            ? 'В контактах'
            : relation === 'outgoing_pending'
              ? 'Запрос отправлен'
              : relation === 'incoming_pending'
                ? 'Принять запрос'
                : relation === 'rejected'
                  ? 'Добавить снова'
                  : relation === 'cancelled'
                    ? 'Отправить запрос'
                    : 'Добавить в контакты'
      }}
    </button>

    <button
      v-if="relation === 'incoming_pending'"
      class="ghost-button"
      type="button"
      :disabled="contactLoading"
      @click="$emit('reject')"
    >
      Отклонить
    </button>

    <button
      v-if="relation === 'outgoing_pending'"
      class="ghost-button"
      type="button"
      :disabled="contactLoading"
      @click="$emit('cancel')"
    >
      Отменить запрос
    </button>

    <button class="ghost-button" type="button" :disabled="chatLoading" @click="$emit('message')">
      {{ chatLoading ? 'Открываем чат...' : 'Написать' }}
    </button>

    <button
      class="ghost-button"
      type="button"
      :disabled="recommendationDisabled"
      @click="$emit('recommend')"
    >
      Рекомендовать
    </button>
  </div>
</template>

<style scoped>
.action-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
</style>
