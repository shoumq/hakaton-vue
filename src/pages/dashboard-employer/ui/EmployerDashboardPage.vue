<script setup lang="ts">
import { computed } from 'vue'

import OpportunityCard from '@/entities/opportunity/ui/OpportunityCard.vue'
import {
  employerCandidates,
  employerOpportunityIds,
  employerProfile,
  opportunities,
} from '@/entities/opportunity/model/mock'

const employerOpportunities = computed(() =>
  employerOpportunityIds
    .map((id) => opportunities.find((opportunity) => opportunity.id === id))
    .filter(Boolean),
)
</script>

<template>
  <main class="page-shell">
    <section class="dashboard">
      <div class="dashboard-hero">
        <div>
          <p class="eyebrow">Кабинет работодателя</p>
          <h1>{{ employerProfile.companyName }}</h1>
          <p class="hero-copy">{{ employerProfile.description }}</p>
        </div>
        <div class="verification-card">
          <strong>Статус: {{ employerProfile.verification.status }}</strong>
          <p>{{ employerProfile.verification.method }}</p>
          <p>{{ employerProfile.verification.details }}</p>
        </div>
      </div>

      <section class="dashboard-grid">
        <article class="section-card">
          <h2>Профиль компании</h2>
          <p>{{ employerProfile.industry }}</p>
          <p>{{ employerProfile.website }}</p>
          <p>{{ employerProfile.socials.join(' · ') }}</p>
        </article>

        <article class="section-card">
          <h2>Новая возможность</h2>
          <p>
            Форма создания дублирует карточку возможности: название, описание, тип, формат, адрес или город,
            сроки, контакты и теги.
          </p>
          <div class="pseudo-form">
            <span>Название позиции</span>
            <span>Тип, формат, адрес</span>
            <span>Теги технологий и уровня</span>
          </div>
        </article>
      </section>

      <section class="dashboard-section">
        <h2>Активные, закрытые и запланированные возможности</h2>
        <div class="card-list">
          <OpportunityCard
            v-for="opportunity in employerOpportunities"
            :key="opportunity?.id"
            :opportunity="opportunity!"
            compact
          />
        </div>
      </section>

      <section class="dashboard-section">
        <h2>Отклики соискателей</h2>
        <div class="candidate-list">
          <div v-for="candidate in employerCandidates" :key="candidate.id" class="candidate-card">
            <strong>{{ candidate.name }}</strong>
            <span>{{ candidate.targetTitle }}</span>
            <span>Статус: {{ candidate.status }}</span>
            <p>{{ candidate.note }}</p>
          </div>
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
.candidate-list {
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
  grid-template-columns: minmax(0, 1fr) 360px;
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
  margin: 0 0 10px;
  font-family: var(--font-heading);
}

h1 {
  font-size: clamp(1.8rem, 4vw, 2.4rem);
}

.hero-copy,
.section-card p,
.verification-card p,
.candidate-card p,
.candidate-card span {
  margin: 0;
  color: var(--muted);
  line-height: 1.6;
}

.dashboard-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.verification-card,
.candidate-card,
.pseudo-form {
  display: grid;
  gap: 8px;
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
