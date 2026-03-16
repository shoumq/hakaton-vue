<script setup lang="ts">
import { computed, ref } from 'vue'

import { opportunities } from '@/entities/opportunity/model/mock'
import type { Opportunity } from '@/entities/opportunity/model/types'
import OpportunityCard from '@/entities/opportunity/ui/OpportunityCard.vue'
import { useFavorites } from '@/features/favorites/model/favorites'
import { useOpportunityFilters } from '@/features/opportunity-filter/model/useOpportunityFilters'
import { opportunityTypes, technologyTags, workFormats } from '@/shared/config/tags'
import { pluralize } from '@/shared/lib/formatters'

const activeView = ref<'map' | 'list'>('map')
const hoveredId = ref<string | null>(null)

const favorites = useFavorites()
const { filters, filtered, reset } = useOpportunityFilters(opportunities)

const hoveredOpportunity = computed<Opportunity | null>(
  () => filtered.value.find((item) => item.id === hoveredId.value) ?? null,
)

const mapBounds = {
  minLat: 54,
  maxLat: 60.5,
  minLng: 29,
  maxLng: 83.5,
}

function markerPosition(opportunity: Opportunity) {
  const x =
    ((opportunity.location.longitude - mapBounds.minLng) / (mapBounds.maxLng - mapBounds.minLng)) * 100
  const y =
    100 - ((opportunity.location.latitude - mapBounds.minLat) / (mapBounds.maxLat - mapBounds.minLat)) * 100

  return {
    left: `${Math.max(6, Math.min(94, x))}%`,
    top: `${Math.max(8, Math.min(92, y))}%`,
  }
}
</script>

<template>
  <section class="explorer">
    <div class="hero-panel">
      <div>
        <p class="eyebrow">Интерактивная карьерная платформа</p>
        <h1>Поиск карьерных возможностей по карте, тегам, формату работы и уровню дохода.</h1>
        <p class="hero-text">
          На платформе собраны вакансии, стажировки, менторские программы и карьерные мероприятия.
          Для гостей доступен поиск, карта и локальное избранное в браузере, для ролей есть отдельные кабинеты.
        </p>
      </div>

      <div class="stats-grid">
        <article class="stat-card">
          <strong>{{ opportunities.length }}</strong>
          <span>возможностей в витрине</span>
        </article>
        <article class="stat-card">
          <strong>3 роли</strong>
          <span>соискатель, работодатель и куратор</span>
        </article>
        <article class="stat-card">
          <strong>{{ favorites.ids.value.length }}</strong>
          <span>элементов сохранено локально</span>
        </article>
      </div>
    </div>

    <div class="filter-panel">
      <label class="field">
        <span>Поиск</span>
        <input v-model="filters.query" type="text" placeholder="Например, Vue, Python, хакатон, Москва" />
      </label>

      <label class="field">
        <span>Навык</span>
        <select v-model="filters.technology">
          <option value="all">Все теги</option>
          <option v-for="tag in technologyTags" :key="tag" :value="tag">{{ tag }}</option>
        </select>
      </label>

      <label class="field">
        <span>Формат</span>
        <select v-model="filters.workFormat">
          <option value="all">Все форматы</option>
          <option v-for="format in workFormats" :key="format" :value="format">{{ format }}</option>
        </select>
      </label>

      <label class="field">
        <span>Тип</span>
        <select v-model="filters.opportunityType">
          <option value="all">Все типы</option>
          <option v-for="type in opportunityTypes" :key="type" :value="type">{{ type }}</option>
        </select>
      </label>

      <label class="field">
        <span>Зарплата от</span>
        <input v-model.number="filters.salaryFrom" type="number" min="0" step="10000" placeholder="120000" />
      </label>

      <button class="ghost-button" type="button" @click="reset">Сбросить</button>
    </div>

    <div class="toolbar">
      <p class="results-copy">
        Найдено {{ filtered.length }} {{ pluralize(filtered.length, 'возможность', 'возможности', 'возможностей') }}
      </p>

      <div class="view-switcher">
        <button
          type="button"
          class="view-button"
          :class="{ active: activeView === 'map' }"
          @click="activeView = 'map'"
        >
          Карта
        </button>
        <button
          type="button"
          class="view-button"
          :class="{ active: activeView === 'list' }"
          @click="activeView = 'list'"
        >
          Лента
        </button>
      </div>
    </div>

    <div class="content-grid">
      <section v-if="activeView === 'map'" class="map-panel">
        <div class="map-stage">
          <div class="map-surface">
            <div
              v-for="opportunity in filtered"
              :key="opportunity.id"
              class="marker"
              :class="{ favorite: favorites.has(opportunity.id), hovered: hoveredId === opportunity.id }"
              :style="markerPosition(opportunity)"
              @mouseenter="hoveredId = opportunity.id"
              @mouseleave="hoveredId = null"
            >
              <span class="marker-dot"></span>
            </div>
          </div>

          <div class="map-legend">
            <span><i class="legend-dot"></i> стандартный маркер</span>
            <span><i class="legend-dot favorite"></i> компания или возможность в избранном</span>
          </div>
        </div>

        <aside class="hover-card">
          <OpportunityCard
            v-if="hoveredOpportunity"
            :opportunity="hoveredOpportunity"
            compact
          />
          <div v-else class="hover-placeholder">
            Наведи на маркер, чтобы увидеть компактную карточку возможности.
          </div>
        </aside>
      </section>

      <section v-else class="feed-panel">
        <OpportunityCard v-for="opportunity in filtered" :key="opportunity.id" :opportunity="opportunity" />
      </section>

      <aside class="extra-panel">
        <article class="info-card">
          <p class="card-eyebrow">Дополнительная функция</p>
          <h2>Сохранение избранного без аккаунта</h2>
          <p>
            Даже неавторизованный пользователь может отмечать компании и возможности как избранные. Данные
            сохраняются в браузере, а на карте такие элементы подсвечиваются отдельным цветом.
          </p>
        </article>

        <article class="info-card">
          <p class="card-eyebrow">Верификация работодателя</p>
          <h2>Корпоративная почта + ИНН + ручная модерация</h2>
          <p>
            Это снижает риск фейковых карточек и даёт куратору понятную очередь проверки компаний перед публикацией.
          </p>
        </article>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.explorer,
.hero-panel,
.filter-panel,
.content-grid,
.toolbar,
.stats-grid,
.view-switcher,
.map-panel {
  display: grid;
  gap: 20px;
}

.explorer {
  max-width: 1380px;
  margin: 0 auto;
}

.hero-panel,
.filter-panel,
.map-panel,
.feed-panel,
.extra-panel,
.info-card {
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  box-shadow: var(--shadow-soft);
}

.hero-panel {
  grid-template-columns: minmax(0, 1.2fr) minmax(280px, 0.8fr);
  padding: 24px;
}

.eyebrow,
.card-eyebrow {
  margin: 0 0 10px;
  color: var(--accent-strong);
  font: 700 0.82rem/1 var(--font-mono);
  letter-spacing: 0.04em;
}

h1,
h2 {
  margin: 0 0 14px;
  font-family: var(--font-heading);
}

h1 {
  font-size: clamp(1.9rem, 4vw, 2.8rem);
  line-height: 1.15;
}

h2 {
  font-size: 1.35rem;
}

.hero-text,
.info-card p,
.results-copy {
  margin: 0;
  color: var(--muted);
  line-height: 1.65;
}

.stats-grid {
  grid-template-columns: repeat(1, minmax(0, 1fr));
}

.stat-card {
  display: grid;
  gap: 6px;
  padding: 18px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface-strong);
}

.stat-card strong {
  font-size: 1.5rem;
  font-family: var(--font-heading);
}

.filter-panel {
  grid-template-columns: repeat(6, minmax(0, 1fr));
  padding: 20px;
}

.field {
  display: grid;
  gap: 8px;
}

.field span {
  font-size: 0.88rem;
  color: var(--muted);
}

.field input,
.field select,
.ghost-button,
.view-button {
  min-height: 46px;
  padding: 0 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
}

.ghost-button,
.view-button {
  cursor: pointer;
}

.toolbar {
  grid-template-columns: 1fr auto;
  align-items: center;
}

.view-switcher {
  grid-auto-flow: column;
}

.view-button.active {
  color: #fff;
  border-color: var(--accent);
  background: var(--accent);
}

.content-grid {
  grid-template-columns: minmax(0, 1.3fr) 320px;
  align-items: start;
}

.map-panel {
  padding: 20px;
}

.map-stage {
  display: grid;
  gap: 14px;
}

.map-surface {
  position: relative;
  min-height: 520px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: linear-gradient(180deg, #f8fafc 0%, #eef2f6 100%);
  overflow: hidden;
}

.map-surface::before,
.map-surface::after {
  content: '';
  position: absolute;
  inset: 0;
}

.map-surface::before {
  background:
    linear-gradient(rgba(148, 163, 184, 0.18) 1px, transparent 1px),
    linear-gradient(90deg, rgba(148, 163, 184, 0.18) 1px, transparent 1px);
  background-size: 64px 64px;
}

.map-surface::after {
  background:
    radial-gradient(circle at 20% 75%, rgba(148, 163, 184, 0.18), transparent 16%),
    radial-gradient(circle at 50% 55%, rgba(148, 163, 184, 0.12), transparent 20%),
    radial-gradient(circle at 78% 25%, rgba(148, 163, 184, 0.14), transparent 16%);
}

.marker {
  position: absolute;
  z-index: 1;
  width: 22px;
  height: 22px;
  transform: translate(-50%, -50%);
  cursor: pointer;
}

.marker-dot {
  display: block;
  width: 100%;
  height: 100%;
  border: 3px solid #fff;
  border-radius: 999px;
  background: #5b6b7f;
  box-shadow: 0 6px 14px rgba(15, 23, 42, 0.18);
}

.marker.favorite .marker-dot {
  background: var(--accent);
}

.marker.hovered {
  z-index: 2;
  transform: translate(-50%, -50%) scale(1.2);
}

.map-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
  color: var(--muted);
  font-size: 0.92rem;
}

.legend-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  margin-right: 8px;
  border-radius: 999px;
  background: #315074;
}

.legend-dot.favorite {
  background: var(--accent);
}

.hover-card {
  min-height: 100%;
}

.hover-placeholder {
  display: grid;
  place-items: center;
  min-height: 220px;
  padding: 20px;
  border-radius: 10px;
  border: 1px dashed var(--border);
  color: var(--muted);
  background: var(--surface-strong);
  text-align: center;
}

.feed-panel,
.extra-panel {
  display: grid;
  gap: 16px;
  padding: 20px;
}

.info-card {
  padding: 20px;
}

@media (max-width: 1180px) {
  .content-grid {
    grid-template-columns: 1fr;
  }

  .filter-panel {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 840px) {
  .hero-panel,
  .toolbar,
  .map-panel {
    grid-template-columns: 1fr;
  }

  .filter-panel {
    grid-template-columns: 1fr;
  }

  .map-surface {
    min-height: 380px;
  }
}
</style>
