<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import type { Opportunity } from '@/entities/opportunity/model/types'
import { useFavorites } from '@/features/favorites/model/favorites'
import { formatDate, formatMoneyRange } from '@/shared/lib/formatters'

const props = defineProps<{
  opportunity: Opportunity
  compact?: boolean
}>()

const favorites = useFavorites()
const isFavorite = computed(() => favorites.has(props.opportunity.id))

const typeLabels = {
  internship: 'Стажировка',
  vacancy: 'Вакансия',
  mentorship: 'Менторская программа',
  event: 'Карьерное мероприятие',
} as const

const formatLabels = {
  office: 'Офис',
  hybrid: 'Гибрид',
  remote: 'Удалённо',
} as const
</script>

<template>
  <article class="opportunity-card" :class="{ compact }">
    <div class="card-topline">
      <div class="badge-row">
        <span class="pill">{{ typeLabels[opportunity.type] }}</span>
        <span class="pill muted">{{ formatLabels[opportunity.workFormat] }}</span>
      </div>
      <button class="favorite-button" type="button" @click="favorites.toggle(opportunity.id)">
        {{ isFavorite ? 'В избранном' : 'В избранное' }}
      </button>
    </div>

    <div class="card-main">
      <div>
        <p class="company">{{ opportunity.companyName }}</p>
        <h3>
          <RouterLink :to="`/opportunities/${opportunity.id}`" class="title-link">
            {{ opportunity.title }}
          </RouterLink>
        </h3>
      </div>
      <p class="summary">{{ opportunity.summary }}</p>
    </div>

    <dl class="meta-grid">
      <div>
        <dt>Локация</dt>
        <dd>{{ opportunity.location.placementLabel }}</dd>
      </div>
      <div>
        <dt>Доход</dt>
        <dd>{{ formatMoneyRange(opportunity.salaryFrom, opportunity.salaryTo) }}</dd>
      </div>
      <div>
        <dt>Публикация</dt>
        <dd>{{ formatDate(opportunity.publishedAt) }}</dd>
      </div>
      <div>
        <dt>Срок</dt>
        <dd>{{ formatDate(opportunity.expiresAt) }}</dd>
      </div>
    </dl>

    <div class="tag-row">
      <span v-for="tag in opportunity.technologies" :key="tag" class="tag">{{ tag }}</span>
      <span v-for="level in opportunity.levels" :key="level" class="tag subtle">{{ level }}</span>
    </div>
  </article>
</template>

<style scoped>
.opportunity-card {
  display: grid;
  gap: 14px;
  padding: 16px;
  border: 1px solid #d7dee7;
  border-radius: 12px;
  background: var(--surface);
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
}

.opportunity-card.compact {
  gap: 12px;
  padding: 14px;
}

.card-topline,
.badge-row,
.tag-row,
.meta-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.card-topline {
  align-items: center;
  justify-content: space-between;
}

.favorite-button {
  border: 1px solid #d1dae5;
  border-radius: 8px;
  padding: 7px 10px;
  color: var(--accent-strong);
  background: var(--surface);
  cursor: pointer;
  font-size: 0.86rem;
}

.company {
  margin: 0 0 8px;
  color: var(--accent-strong);
  font: 700 0.78rem/1 var(--font-mono);
  letter-spacing: 0.04em;
}

h3 {
  margin: 0;
  font-size: 1rem;
  line-height: 1.25;
}

.summary {
  margin: 0;
  color: var(--muted);
  line-height: 1.5;
  font-size: 0.92rem;
}

.title-link {
  color: inherit;
  text-decoration: none;
}

.title-link:hover {
  color: var(--accent-strong);
}

.pill,
.tag {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 9px;
  border-radius: 999px;
  border: 1px solid #d9e1ea;
  font-size: 0.74rem;
}

.pill {
  background: var(--surface-strong);
}

.pill.muted,
.tag.subtle {
  color: var(--muted);
}

.tag {
  background: var(--surface-strong);
}

.meta-grid {
  margin: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.meta-grid div {
  padding: 10px 12px;
  border: 1px solid #e4eaf1;
  border-radius: 10px;
  background: var(--surface-strong);
}

dt {
  margin-bottom: 4px;
  color: var(--muted);
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

dd {
  margin: 0;
  line-height: 1.35;
  font-size: 0.9rem;
}

@media (max-width: 680px) {
  .meta-grid {
    grid-template-columns: 1fr;
  }
}
</style>
