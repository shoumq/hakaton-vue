<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import type { Opportunity } from '@/entities/opportunity/model/types'
import OpportunityCard from '@/entities/opportunity/ui/OpportunityCard.vue'
import { useFavorites } from '@/features/favorites/model/favorites'
import { useOpportunityFilters } from '@/features/opportunity-filter/model/useOpportunityFilters'
import { fetchPublicCatalog, getApiErrorMessage } from '@/shared/api'
import { opportunityTypes, technologyTags, workFormats } from '@/shared/config/tags'
import { formatEmployment, formatOpportunityType, formatWorkFormat, pluralize } from '@/shared/lib/formatters'
import MapLibreOpportunityCollectionMap from '@/shared/ui/MapLibreOpportunityCollectionMap.vue'

const router = useRouter()
const activeView = ref<'map' | 'list'>('map')
const hoveredId = ref<string | null>(null)
const opportunities = ref<Opportunity[]>([])
const availableTechnologyTags = ref<string[]>([...technologyTags])
const isLoading = ref(true)
const errorMessage = ref('')

const favorites = useFavorites()
const { filters, filtered, reset } = useOpportunityFilters(() => opportunities.value)

const hoveredOpportunity = computed<Opportunity | null>(
  () => filtered.value.find((item) => item.id === hoveredId.value) ?? null,
)

const activeFilterCount = computed(() =>
  [filters.query.trim(), filters.technology !== 'all', filters.workFormat !== 'all', filters.opportunityType !== 'all', filters.salaryFrom !== null]
    .filter(Boolean)
    .length,
)

const mapPoints = computed(() =>
  filtered.value.map((opportunity) => ({
    id: opportunity.id,
    title: opportunity.title,
    companyName: opportunity.companyName,
    latitude: opportunity.location.latitude,
    longitude: opportunity.location.longitude,
    isFavorite: favorites.has(opportunity.id),
  })),
)

async function openOpportunity(id: string) {
  await router.push(`/opportunities/${id}`)
}

onMounted(async () => {
  isLoading.value = true
  errorMessage.value = ''

  try {
    const catalog = await fetchPublicCatalog()
    opportunities.value = catalog.opportunities
    const apiTechnologyTags = catalog.tags
      .filter((tag) => tag.tag_type === 'technology')
      .map((tag) => tag.name)
      .sort((left, right) => left.localeCompare(right))

    availableTechnologyTags.value = apiTechnologyTags.length ? apiTechnologyTags : [...technologyTags]
  } catch (error) {
    errorMessage.value = getApiErrorMessage(error, 'Не удалось загрузить витрину возможностей.')
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <section class="explorer">
    <p v-if="errorMessage" class="status-banner error">{{ errorMessage }}</p>
    <p v-else-if="isLoading" class="status-banner">Загружаем витрину возможностей...</p>

    <section v-if="activeView === 'map'" class="map-shell">
      <MapLibreOpportunityCollectionMap
        class="map-surface"
        :points="mapPoints"
        :active-id="hoveredId"
        @hover="hoveredId = $event"
        @select="openOpportunity"
      />

      <div class="map-overlay filters-overlay">
        <div class="filter-panel">
          <label class="field">
            <span>Поиск</span>
            <input v-model="filters.query" type="text" placeholder="Vue, Python, хакатон, Москва" />
          </label>

          <label class="field">
            <span>Навык</span>
            <select v-model="filters.technology">
              <option value="all">Все теги</option>
              <option v-for="tag in availableTechnologyTags" :key="tag" :value="tag">{{ tag }}</option>
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
      </div>

      <div class="map-overlay toolbar-overlay">
        <div class="toolbar-card">
          <p class="results-copy">
            Найдено {{ filtered.length }} {{ pluralize(filtered.length, 'возможность', 'возможности', 'возможностей') }}
          </p>

          <div class="view-switcher">
            <button
              type="button"
              class="view-button active"
              @click="activeView = 'map'"
            >
              Карта
            </button>
            <button
              type="button"
              class="view-button"
              @click="activeView = 'list'"
            >
              Лента
            </button>
          </div>
        </div>
      </div>

      <aside class="map-overlay details-overlay">
        <OpportunityCard
          v-if="hoveredOpportunity"
          :opportunity="hoveredOpportunity"
          compact
        />
        <div v-else class="hover-placeholder">
          Наведи на маркер, чтобы увидеть карточку возможности.
        </div>
      </aside>

      <div class="map-overlay legend-overlay">
        <div class="map-legend">
          <span><i class="legend-dot"></i> стандартный маркер</span>
          <span><i class="legend-dot favorite"></i> в избранном</span>
        </div>
      </div>
    </section>

    <section v-else class="list-shell">
      <div class="list-layout">
        <aside class="list-sidebar">
          <div class="feed-filters feed-card">
            <label class="field">
              <span>Поиск</span>
              <input v-model="filters.query" type="text" placeholder="Vue, Python, хакатон, Москва" />
            </label>

            <label class="field">
              <span>Навык</span>
              <select v-model="filters.technology">
                <option value="all">Все теги</option>
                <option v-for="tag in availableTechnologyTags" :key="tag" :value="tag">{{ tag }}</option>
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

          <div class="feed-card stats-card">
            <div class="stat-row">
              <span>Найдено</span>
              <strong>{{ filtered.length }}</strong>
            </div>
            <div class="stat-row">
              <span>Активных фильтров</span>
              <strong>{{ activeFilterCount }}</strong>
            </div>
            <div class="stat-row">
              <span>Избранное</span>
              <strong>{{ opportunities.filter((item) => favorites.has(item.id)).length }}</strong>
            </div>
          </div>

          <div class="toolbar-card feed-card">
            <p class="results-copy">
              Найдено {{ filtered.length }} {{ pluralize(filtered.length, 'возможность', 'возможности', 'возможностей') }}
            </p>

            <div class="view-switcher">
              <button
                type="button"
                class="view-button"
                @click="activeView = 'map'"
              >
                Карта
              </button>
              <button
                type="button"
                class="view-button active"
                @click="activeView = 'list'"
              >
                Лента
              </button>
            </div>
          </div>
        </aside>

        <section class="feed-container">
          <div class="feed-header feed-card">
            <div>
              <p class="feed-label">Лента</p>
              <h2>Подходящие возможности</h2>
            </div>
          </div>

          <div class="feed-panel">
            <article v-for="opportunity in filtered" :key="opportunity.id" class="feed-item">
              <div class="feed-item-main">
                <div class="feed-item-topline">
                  <div class="badge-row">
                    <span class="pill">{{ formatOpportunityType(opportunity.type) + " | "}} </span>
                    <span class="pill muted">{{ formatWorkFormat(opportunity.workFormat) + " | "}}</span>
                    <span class="pill subtle">{{ formatEmployment(opportunity.employment) }}</span>
                  </div>
                </div>

                <div class="feed-copy">
                  <p class="feed-company">{{ opportunity.companyName }}</p>
                  <h3>
                    <RouterLink :to="`/opportunities/${opportunity.id}`" class="feed-title">
                      {{ opportunity.title }}
                    </RouterLink>
                  </h3>
                  <p class="feed-summary">{{ opportunity.summary }}</p>
                </div>

                <div class="feed-meta">
                  <span>{{ opportunity.location.placementLabel }}</span>
                  <span>{{ opportunity.salaryFrom || opportunity.salaryTo ? 'Доход указан' : 'Доход не указан' }}</span>
                  <span>{{ opportunity.technologies.slice(0, 3).join(' • ') || 'Теги появятся позже' }}</span>
                </div>

                <div class="feed-actions">
                  <RouterLink :to="`/opportunities/${opportunity.id}`" class="primary-button">Откликнуться</RouterLink>
                </div>
              </div>

              <div class="feed-item-side">
                <div class="company-avatar">
                  <img
                    v-if="opportunity.companyAvatarUrl"
                    :src="opportunity.companyAvatarUrl"
                    :alt="opportunity.companyName"
                    class="company-avatar-image"
                  />
                  <span v-else class="company-avatar-fallback">
                    {{ opportunity.companyName.slice(0, 2).toUpperCase() }}
                  </span>
                </div>
              </div>
            </article>
          </div>
        </section>
      </div>
    </section>
  </section>
</template>

<style scoped>
.explorer {
  max-width: 100%;
  margin: 0 auto;
  display: grid;
  gap: 12px;
}

.status-banner {
  margin: 0;
  padding: 12px 14px;
  border: 1px solid #d7dee7;
  border-radius: 12px;
  background: var(--surface);
  font-size: 0.9rem;
}

.status-banner.error {
  color: var(--danger);
}

.map-shell {
  position: relative;
  height: calc(100vh - 140px);
  min-height: calc(100vh - 140px);
  border: 1px solid #d7dee7;
  border-radius: 16px;
  overflow: hidden;
  background: #dfe7ef;
}

.map-surface {
  position: absolute;
  inset: 0;
  display: block;
}

.map-overlay {
  position: absolute;
  z-index: 2;
}

.filters-overlay {
  top: 16px;
  left: 16px;
  right: 16px;
}

.toolbar-overlay {
  top: 136px;
  left: 16px;
}

.details-overlay {
  right: 16px;
  top: 208px;
  width: min(360px, calc(100% - 32px));
}

.legend-overlay {
  left: 16px;
  bottom: 16px;
}

.filter-panel,
.toolbar-card,
.map-legend,
.hover-placeholder,
.list-topbar,
.feed-panel {
  border: 1px solid #d7dee7;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
  backdrop-filter: blur(10px);
}

.filter-panel {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 10px;
  padding: 12px;
}

.filter-panel.compact {
  background: #fff;
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
  backdrop-filter: none;
}

.toolbar-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 12px;
}

.results-copy {
  margin: 0;
  color: var(--muted);
  line-height: 1.4;
  font-size: 0.9rem;
}

.field {
  display: grid;
  gap: 6px;
}

.field span {
  font-size: 0.78rem;
  color: var(--muted);
}

.field input,
.field select,
.view-button {
  min-height: 38px;
  padding: 0 12px;
  border: 1px solid #d7dee7;
  border-radius: 8px;
  background: #fff;
  font-size: 0.9rem;
}

.view-button {
  cursor: pointer;
}

.view-switcher {
  display: grid;
  grid-auto-flow: column;
  gap: 8px;
}

.view-button.active {
  color: #fff;
  border-color: var(--accent);
  background: var(--accent);
}

.hover-placeholder {
  display: grid;
  place-items: center;
  min-height: 180px;
  padding: 20px;
  color: var(--muted);
  text-align: center;
}

.map-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 10px 12px;
  color: var(--muted);
  font-size: 0.86rem;
}

.map-legend span {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.legend-dot {
  width: 12px;
  height: 12px;
  border-radius: 999px;
  background: var(--accent);
}

.legend-dot.favorite {
  background: #12756e;
}

.list-shell {
  display: grid;
  max-width: 1240px;
  width: 100%;
  margin: 0 auto;
}

.list-layout {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 20px;
  align-items: start;
}

.list-sidebar {
  position: sticky;
  top: 20px;
  display: grid;
  gap: 14px;
}

.feed-filters {
  display: grid;
  gap: 12px;
  padding: 14px;
}

.feed-container {
  display: grid;
  gap: 14px;
}

.feed-card,
.feed-panel {
  border: 1px solid #d7dee7;
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.05);
}

.feed-header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 20px;
}

.feed-label {
  margin: 0 0 6px;
  color: #2952cc;
  font: 700 0.72rem/1 var(--font-mono);
  text-transform: uppercase;
}

.feed-header h2 {
  margin: 0;
  color: #162033;
  font-size: 1.55rem;
}

.stats-card {
  display: grid;
  gap: 10px;
  padding: 14px;
}

.stat-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid #e6ebf2;
  border-radius: 12px;
  background: #fbfcfe;
}

.stat-row span {
  color: #627087;
  font-size: 0.84rem;
}

.stat-row strong {
  color: #162033;
  font-size: 0.98rem;
}

.feed-panel {
  display: grid;
  gap: 16px;
  padding: 16px;
}

.feed-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 112px;
  gap: 20px;
  padding: 22px 24px;
  border: 1px solid #dde5ef;
  border-radius: 20px;
  background: linear-gradient(180deg, #ffffff 0%, #fbfcfe 100%);
}

.feed-item-main,
.feed-copy {
  display: grid;
  gap: 12px;
}

.feed-item-topline,
.feed-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.feed-company {
  margin: 0;
  color: #1e3fa0;
  font: 700 0.82rem/1 var(--font-mono);
  text-transform: uppercase;
}

.feed-title {
  color: #162033;
  text-decoration: none;
}

.feed-title:hover {
  color: #2147b7;
}

.feed-copy h3 {
  margin: 0;
  font-size: 1.65rem;
  line-height: 1.08;
}

.feed-summary {
  margin: 0;
  max-width: 68ch;
  color: #5c6778;
  font-size: 1rem;
  line-height: 1.55;
}

.feed-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  color: #4c5b70;
  font-size: 0.92rem;
}

.feed-meta span {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0 12px;
  border-radius: 999px;
  background: #f3f6fa;
}

.feed-item-side {
  display: grid;
  align-content: center;
  justify-items: center;
}

.company-avatar {
  display: grid;
  place-items: center;
  width: 90px;
  height: 90px;
  overflow: hidden;
  border-radius: 50%;
  background: linear-gradient(135deg, #e8efff, #c8d8ff);
}

.company-avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.company-avatar-fallback {
  color: #2147b7;
  font: 700 1rem/1 var(--font-heading);
}

.favorite-button {
  border: 1px solid #d1dae5;
  border-radius: 10px;
  padding: 8px 12px;
  color: var(--accent-strong);
  background: var(--surface);
  cursor: pointer;
  font-size: 0.86rem;
}

@media (max-width: 1100px) {
  .filter-panel {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .toolbar-overlay {
    top: 184px;
  }

  .details-overlay {
    top: auto;
    right: 16px;
    left: 16px;
    bottom: 68px;
    width: auto;
  }

  .list-layout {
    grid-template-columns: 1fr;
  }

  .list-sidebar {
    position: static;
  }
}

@media (max-width: 720px) {
  .map-shell {
    height: calc(100vh - 120px);
    min-height: calc(100vh - 120px);
  }

  .filters-overlay,
  .toolbar-overlay,
  .details-overlay,
  .legend-overlay {
    left: 12px;
    right: 12px;
  }

  .filter-panel {
    grid-template-columns: 1fr;
  }

  .toolbar-overlay {
    top: 312px;
  }

  .toolbar-card {
    flex-direction: column;
    align-items: flex-start;
  }

  .details-overlay {
    bottom: 60px;
  }

  .feed-header,
  .feed-item {
    grid-template-columns: 1fr;
  }

  .feed-header {
    align-items: flex-start;
  }

  .feed-item {
    padding: 18px;
  }

  .feed-item-topline,
  .feed-actions {
    flex-direction: column;
    align-items: flex-start;
  }

  .feed-item-side {
    justify-items: flex-start;
  }

  .feed-copy h3 {
    font-size: 1.3rem;
  }
}
</style>
