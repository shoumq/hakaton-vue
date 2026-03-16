<script setup lang="ts">
import { computed } from 'vue'

import OpportunityCard from '@/entities/opportunity/ui/OpportunityCard.vue'
import {
  applicantApplications,
  applicantContacts,
  applicantProfile,
  applicantSavedOpportunityIds,
  opportunities,
} from '@/entities/opportunity/model/mock'
import { formatDate } from '@/shared/lib/formatters'

const applicationCards = computed(() =>
  applicantApplications
    .map((item) => ({
      ...item,
      opportunity: opportunities.find((opportunity) => opportunity.id === item.opportunityId),
    }))
    .filter((item) => item.opportunity),
)

const savedCards = computed(() =>
  applicantSavedOpportunityIds
    .map((id) => opportunities.find((opportunity) => opportunity.id === id))
    .filter(Boolean),
)
</script>

<template>
  <main class="page-shell">
    <section class="dashboard">
      <div class="dashboard-hero">
        <div>
          <p class="eyebrow">Кабинет соискателя</p>
          <h1>{{ applicantProfile.fullName }}</h1>
          <p class="hero-copy">
            {{ applicantProfile.university }}, выпуск {{ applicantProfile.graduationYear }}.
            Карьерные интересы: {{ applicantProfile.careerInterests.join(', ') }}.
          </p>
        </div>
        <div class="hero-panel">
          <p><strong>Приватность:</strong> {{ applicantProfile.privacy }}</p>
          <p><strong>Портфолио:</strong> {{ applicantProfile.portfolioLinks.join(' · ') }}</p>
        </div>
      </div>

      <section class="dashboard-grid">
        <article class="section-card">
          <h2>Резюме и профиль</h2>
          <p class="section-copy">
            Навыки: {{ applicantProfile.skills.join(', ') }}. Профиль можно открыть всем авторизованным
            пользователям для нетворкинга или скрыть отклики от других соискателей.
          </p>
        </article>

        <article class="section-card">
          <h2>Профессиональные контакты</h2>
          <div class="stack-list">
            <div v-for="contact in applicantContacts" :key="contact.id" class="line-item">
              <strong>{{ contact.name }}</strong>
              <span>{{ contact.title }}</span>
              <span>Рекомендует: {{ contact.recommendedOpportunityId }}</span>
            </div>
          </div>
        </article>
      </section>

      <section class="dashboard-section">
        <h2>История откликов</h2>
        <div class="stack-list">
          <div v-for="item in applicationCards" :key="item.opportunityId" class="line-item">
            <strong>{{ item.opportunity?.title }}</strong>
            <span>Статус: {{ item.status }}</span>
            <span>Обновлено: {{ formatDate(item.updatedAt) }}</span>
          </div>
        </div>
      </section>

      <section class="dashboard-section">
        <h2>Избранное и запланированные отклики</h2>
        <div class="card-list">
          <OpportunityCard
            v-for="opportunity in savedCards"
            :key="opportunity?.id"
            :opportunity="opportunity!"
            compact
          />
        </div>
      </section>
    </section>
  </main>
</template>

<style scoped>
.dashboard,
.dashboard-grid,
.dashboard-section,
.card-list,
.stack-list {
  display: grid;
  gap: 20px;
}

.dashboard {
  max-width: 1280px;
  margin: 0 auto;
}

.dashboard-hero,
.section-card,
.dashboard-section {
  padding: 24px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
}

.dashboard-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 20px;
}

.eyebrow {
  margin: 0 0 10px;
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
  font-size: clamp(1.8rem, 4vw, 2.4rem);
}

.hero-copy,
.section-copy,
.line-item span,
.hero-panel p {
  margin: 0;
  color: var(--muted);
  line-height: 1.65;
}

.dashboard-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.hero-panel,
.line-item {
  display: grid;
  gap: 6px;
  padding: 18px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface-strong);
}

@media (max-width: 900px) {
  .dashboard-hero,
  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}
</style>
