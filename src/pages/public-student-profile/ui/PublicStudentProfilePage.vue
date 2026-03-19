<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import { getStudentProfilePreview } from '@/shared/lib/profile-preview'
import { formatDate } from '@/shared/lib/formatters'

const route = useRoute()

const profileId = computed(() => String(route.params.id || ''))
const profile = computed(() => getStudentProfilePreview(profileId.value))
</script>

<template>
  <main class="page-shell">
    <section class="public-profile-page">
      <article v-if="profile" class="profile-card">
        <p class="section-label">Профиль кандидата</p>
        <h1>{{ profile.displayName }}</h1>
        <p v-if="profile.headline" class="lead-copy">{{ profile.headline }}</p>
        <p v-if="profile.about" class="body-copy">{{ profile.about }}</p>

        <div class="detail-grid">
          <div class="detail-card">
            <span>ID пользователя</span>
            <strong>{{ profile.id }}</strong>
          </div>
          <div class="detail-card">
            <span>Резюме</span>
            <strong>{{ profile.resumeId || 'Не приложено' }}</strong>
          </div>
          <div class="detail-card">
            <span>Отклик обновлен</span>
            <strong>{{ profile.updatedAt ? formatDate(profile.updatedAt) : 'Не указано' }}</strong>
          </div>
          <div class="detail-card">
            <span>По возможности</span>
            <strong>{{ profile.sourceOpportunityTitle || 'Не указано' }}</strong>
          </div>
        </div>

        <article v-if="profile.coverLetter" class="note-card">
          <span>Сопроводительное письмо</span>
          <p>{{ profile.coverLetter }}</p>
        </article>

        <div class="actions-row">
          <RouterLink to="/chats" class="primary-button">Открыть чаты</RouterLink>
          <RouterLink to="/" class="ghost-button">На главную</RouterLink>
        </div>
      </article>

      <article v-else class="profile-card">
        <h1>Профиль недоступен</h1>
        <p class="body-copy">
          Для этого пользователя ещё нет сохраненных данных на клиенте. Сначала откройте его из отклика или чата.
        </p>
        <div class="actions-row">
          <RouterLink to="/" class="ghost-button">На главную</RouterLink>
        </div>
      </article>
    </section>
  </main>
</template>

<style scoped>
.public-profile-page {
  max-width: 880px;
  margin: 0 auto;
}

.profile-card,
.detail-card,
.note-card {
  border: 1px solid #d7dee7;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
}

.profile-card {
  display: grid;
  gap: 14px;
  padding: 20px;
}

.section-label {
  margin: 0;
  color: #526581;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  color: #1d2939;
  font-size: 1.9rem;
}

.lead-copy,
.body-copy,
.note-card p {
  margin: 0;
  color: #526581;
  line-height: 1.55;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.detail-card,
.note-card {
  display: grid;
  gap: 6px;
  padding: 14px;
}

.detail-card span,
.note-card span {
  color: #667085;
  font-size: 0.8rem;
}

.actions-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

@media (max-width: 768px) {
  .detail-grid {
    grid-template-columns: 1fr;
  }
}
</style>
