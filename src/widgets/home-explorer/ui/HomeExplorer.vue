<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import type { Opportunity } from '@/entities/opportunity/model/types'
import OpportunityCard from '@/entities/opportunity/ui/OpportunityCard.vue'
import { useFavorites } from '@/features/favorites/model/favorites'
import { useOpportunityFilters } from '@/features/opportunity-filter/model/useOpportunityFilters'
import { fetchPublicCatalog, getApiErrorMessage } from '@/shared/api'
import { opportunityTypes, technologyTags, workFormats } from '@/shared/config/tags'
import { pluralize } from '@/shared/lib/formatters'
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
      <div class="list-topbar">
        <div class="filter-panel compact">
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

        <div class="toolbar-card">
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
      </div>

      <div class="feed-panel">
        <OpportunityCard v-for="opportunity in filtered" :key="opportunity.id" :opportunity="opportunity" />
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
.ghost-button,
.view-button {
  min-height: 38px;
  padding: 0 12px;
  border: 1px solid #d7dee7;
  border-radius: 8px;
  background: #fff;
  font-size: 0.9rem;
}

.ghost-button,
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
  gap: 14px;
}

.list-topbar {
  display: grid;
  gap: 12px;
  padding: 12px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
  backdrop-filter: none;
}

.feed-panel {
  display: grid;
  gap: 14px;
  padding: 14px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
  backdrop-filter: none;
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
}
</style>
