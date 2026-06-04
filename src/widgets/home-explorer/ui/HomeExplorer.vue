<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import type { Opportunity } from '@/entities/opportunity/model/types'
import OpportunityCard from '@/entities/opportunity/ui/OpportunityCard.vue'
import { useFavorites } from '@/features/favorites/model/favorites'
import { useOpportunityFilters } from '@/features/opportunity-filter/model/useOpportunityFilters'
import { fetchPublicCatalog, getApiErrorMessage } from '@/shared/api'
import { opportunityTypes, technologyTags, workFormats } from '@/shared/config/tags'
import LucideArrowRight from '~icons/lucide/arrow-right'
import { formatEmployment, formatMoneyRange, formatOpportunityType, formatWorkFormat, pluralize } from '@/shared/lib/formatters'
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

const typeColorMap: Record<string, string> = {
  vacancy: 'blue',
  internship: 'green',
  mentorship: 'purple',
  event: 'orange',
}

function typeColor(type: string) {
  return typeColorMap[type] ?? 'blue'
}

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
  <section class="he-root">

    <!-- Status -->
    <div v-if="errorMessage" class="he-status he-status--error">{{ errorMessage }}</div>
    <div v-else-if="isLoading" class="he-status">
      <span class="he-spinner"></span> Загружаем возможности…
    </div>

    <!-- MAP VIEW -->
    <section v-if="activeView === 'map'" class="he-map-shell">
      <MapLibreOpportunityCollectionMap
        class="he-map"
        :points="mapPoints"
        :active-id="hoveredId"
        @hover="hoveredId = $event"
        @select="openOpportunity"
      />

      <!-- Filter bar -->
      <div class="he-overlay he-filter-bar">
        <div class="he-filter-inner">
          <label class="he-filter-field he-filter-field--wide">
            <svg class="he-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input v-model="filters.query" type="text" placeholder="Поиск по названию, навыку, городу…" class="he-input he-input--search" />
          </label>
          <label class="he-filter-field">
            <select v-model="filters.technology" class="he-input">
              <option value="all">Все навыки</option>
              <option v-for="tag in availableTechnologyTags" :key="tag" :value="tag">{{ tag }}</option>
            </select>
          </label>
          <label class="he-filter-field">
            <select v-model="filters.workFormat" class="he-input">
              <option value="all">Все форматы</option>
              <option v-for="f in workFormats" :key="f" :value="f">{{ f }}</option>
            </select>
          </label>
          <label class="he-filter-field">
            <select v-model="filters.opportunityType" class="he-input">
              <option value="all">Все типы</option>
              <option v-for="t in opportunityTypes" :key="t" :value="t">{{ t }}</option>
            </select>
          </label>
          <label class="he-filter-field">
            <input v-model.number="filters.salaryFrom" type="number" min="0" step="10000" placeholder="Зарплата от…" class="he-input" />
          </label>
          <button v-if="activeFilterCount" class="he-reset-btn" type="button" @click="reset">
            ✕ Сбросить
          </button>
        </div>
      </div>

      <!-- Toolbar -->
      <div class="he-overlay he-toolbar">
        <span class="he-count-label">
          {{ filtered.length }} {{ pluralize(filtered.length, 'возможность', 'возможности', 'возможностей') }}
        </span>
        <div class="he-view-switch">
          <button type="button" class="he-view-btn he-view-btn--active" @click="activeView = 'map'">🗺 Карта</button>
          <button type="button" class="he-view-btn" @click="activeView = 'list'">☰ Лента</button>
        </div>
      </div>

      <!-- Hover card -->
      <aside class="he-overlay he-hover-card-wrap">
        <OpportunityCard v-if="hoveredOpportunity" :opportunity="hoveredOpportunity" compact />
        <div v-else class="he-hover-placeholder">
          <span>📍</span>
          <p>Наведите на маркер, чтобы увидеть карточку возможности</p>
        </div>
      </aside>

      <!-- Legend -->
      <div class="he-overlay he-legend">
        <span><i class="he-dot"></i> Стандартный</span>
        <span><i class="he-dot he-dot--fav"></i> В избранном</span>
      </div>
    </section>

    <!-- LIST VIEW -->
    <section v-else class="he-list-shell">
      <div class="he-list-layout">

        <!-- Sidebar -->
        <aside class="he-sidebar">
          <div class="he-sidebar-card">
            <p class="he-sidebar-kicker">Фильтры</p>
            <div class="he-sidebar-fields">
              <label class="he-sidebar-field">
                <span>Поиск</span>
                <div class="he-search-wrap">
                  <svg class="he-search-icon he-search-icon--inside" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                  <input v-model="filters.query" type="text" placeholder="Название, город, навык…" class="he-input he-input--icon" />
                </div>
              </label>
              <label class="he-sidebar-field">
                <span>Тип</span>
                <select v-model="filters.opportunityType" class="he-input">
                  <option value="all">Все типы</option>
                  <option v-for="t in opportunityTypes" :key="t" :value="t">{{ t }}</option>
                </select>
              </label>
              <label class="he-sidebar-field">
                <span>Формат</span>
                <select v-model="filters.workFormat" class="he-input">
                  <option value="all">Любой формат</option>
                  <option v-for="f in workFormats" :key="f" :value="f">{{ f }}</option>
                </select>
              </label>
              <label class="he-sidebar-field">
                <span>Навык / технология</span>
                <select v-model="filters.technology" class="he-input">
                  <option value="all">Все навыки</option>
                  <option v-for="tag in availableTechnologyTags" :key="tag" :value="tag">{{ tag }}</option>
                </select>
              </label>
              <label class="he-sidebar-field">
                <span>Зарплата от, ₽</span>
                <input v-model.number="filters.salaryFrom" type="number" min="0" step="10000" placeholder="100 000" class="he-input" />
              </label>
            </div>
            <button v-if="activeFilterCount" class="he-reset-btn he-reset-btn--full" type="button" @click="reset">
              ✕ Сбросить {{ activeFilterCount }} {{ pluralize(activeFilterCount, 'фильтр', 'фильтра', 'фильтров') }}
            </button>
          </div>

          <!-- Stats -->
          <div class="he-stats-card">
            <div class="he-stat">
              <span>Найдено</span>
              <strong>{{ filtered.length }}</strong>
            </div>
            <div class="he-stat">
              <span>Фильтров</span>
              <strong>{{ activeFilterCount }}</strong>
            </div>
            <div class="he-stat">
              <span>Избранное</span>
              <strong>{{ opportunities.filter((o) => favorites.has(o.id)).length }}</strong>
            </div>
          </div>

          <!-- View switch -->
          <div class="he-view-card">
            <button type="button" class="he-view-btn" @click="activeView = 'map'">🗺 Карта</button>
            <button type="button" class="he-view-btn he-view-btn--active" @click="activeView = 'list'">☰ Лента</button>
          </div>
        </aside>

        <!-- Feed -->
        <div class="he-feed">
          <div class="he-feed-header">
            <div>
              <p class="he-feed-kicker">Каталог</p>
              <h2 class="he-feed-title">Возможности</h2>
            </div>
            <span class="he-feed-count">{{ filtered.length }} {{ pluralize(filtered.length, 'позиция', 'позиции', 'позиций') }}</span>
          </div>

          <div v-if="!filtered.length" class="he-feed-empty">
            <span class="he-feed-empty-icon">🔍</span>
            <strong>Ничего не найдено</strong>
            <p>Попробуйте изменить или сбросить фильтры.</p>
            <button class="he-reset-btn" type="button" @click="reset">Сбросить фильтры</button>
          </div>

          <div v-else class="he-feed-list">
            <article
              v-for="opportunity in filtered"
              :key="opportunity.id"
              class="he-card"
            >
              <!-- Company avatar -->
              <RouterLink :to="`/opportunities/${opportunity.id}`" class="he-card-avatar">
                <img v-if="opportunity.companyAvatarUrl" :src="opportunity.companyAvatarUrl" :alt="opportunity.companyName" />
                <span v-else>{{ opportunity.companyName.slice(0,2).toUpperCase() }}</span>
              </RouterLink>

              <div class="he-card-body">
                <!-- Top chips -->
                <div class="he-card-chips">
                  <span class="he-chip" :class="`he-chip--${typeColor(opportunity.type)}`">{{ formatOpportunityType(opportunity.type) }}</span>
                  <span class="he-chip he-chip--grey">{{ formatWorkFormat(opportunity.workFormat) }}</span>
                  <span class="he-chip he-chip--grey">{{ formatEmployment(opportunity.employment) }}</span>
                </div>

                <!-- Company + title -->
                <p class="he-card-company">{{ opportunity.companyName }}</p>
                <h3 class="he-card-title">
                  <RouterLink :to="`/opportunities/${opportunity.id}`">{{ opportunity.title }}</RouterLink>
                </h3>
                <p class="he-card-summary">{{ opportunity.summary }}</p>

                <!-- Meta row -->
                <div class="he-card-meta">
                  <span v-if="opportunity.location.city !== 'Онлайн' || opportunity.workFormat !== 'remote'">📍 {{ opportunity.location.placementLabel }}</span>
                  <span v-if="formatMoneyRange(opportunity.salaryFrom, opportunity.salaryTo) !== '—'">💰 {{ formatMoneyRange(opportunity.salaryFrom, opportunity.salaryTo) }}</span>
                  <span v-for="tech in [...opportunity.technologies, ...opportunity.levels].slice(0,3)" :key="tech" class="he-meta-tag">{{ tech }}</span>
                </div>
              </div>

              <!-- Action -->
              <div class="he-card-action">
                <RouterLink :to="`/opportunities/${opportunity.id}`" class="he-apply-btn">
                  Подробнее <LucideArrowRight class="he-apply-icon" />
                </RouterLink>
              </div>
            </article>
          </div>
        </div>
      </div>
    </section>

  </section>
</template>

<style scoped>
/* ── Root ── */
.he-root {
  display: grid;
  gap: 12px;
  max-width: 100%;
}

/* ── Status ── */
.he-status {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 13px 18px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--surface);
  font-size: 0.88rem;
  color: var(--muted);
  max-width: 1240px;
  margin: 0 auto;
  width: 100%;
}
.he-status--error { border-color: var(--border-red); background: var(--surface-red); color: #991b1b; }

.he-spinner {
  width: 15px; height: 15px;
  border: 2px solid var(--border);
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin .7s linear infinite;
  flex-shrink: 0;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── MAP VIEW ── */
.he-map-shell {
  position: relative;
  height: calc(100vh - 140px);
  min-height: 500px;
  border-radius: 18px;
  overflow: hidden;
  border: 1px solid var(--border);
  box-shadow: 0 4px 20px rgba(15,23,42,.06);
}

.he-map {
  position: absolute;
  inset: 0;
  display: block;
}

.he-overlay {
  position: absolute;
  z-index: 2;
}

/* Filter bar */
.he-filter-bar {
  top: 14px;
  left: 14px;
  right: 14px;
}

.he-filter-inner {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 12px 14px;
  border-radius: 14px;
  background: var(--surface);
  backdrop-filter: blur(12px);
  border: 1px solid var(--border);
  box-shadow: 0 8px 24px rgba(15,23,42,.1);
  flex-wrap: wrap;
}

.he-filter-field { display: grid; gap: 0; flex: 1; min-width: 130px; position: relative; }
.he-filter-field--wide { flex: 2; min-width: 220px; }

.he-search-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  width: 14px; height: 14px;
  color: #94a3b8;
  pointer-events: none;
}

/* Inputs */
.he-input {
  min-height: 36px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: var(--surface-strong);
  font: inherit;
  font-size: 0.84rem;
  color: var(--text);
  outline: none;
  transition: border-color .15s, box-shadow .15s, background .15s;
  width: 100%;
  box-sizing: border-box;
}
.he-input::placeholder { color: #94a3b8; }
.he-input:focus { border-color: #3b82f6; background: var(--surface); box-shadow: 0 0 0 3px rgba(59,130,246,.1); }
.he-input--search { padding-left: 32px; }
.he-input--icon { padding-left: 32px; }

/* Reset */
.he-reset-btn {
  height: 36px;
  padding: 0 14px;
  border-radius: 9px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--muted);
  font: inherit;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: all .15s;
}
.he-reset-btn:hover { border-color: var(--border-red); background: var(--surface-red); color: #dc2626; }
.he-reset-btn--full { width: 100%; height: 34px; }

/* Toolbar */
.he-toolbar {
  top: calc(14px + 36px + 24px + 14px);
  left: 14px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 14px;
  border-radius: 10px;
  background: var(--surface);
  backdrop-filter: blur(10px);
  border: 1px solid var(--border);
  box-shadow: 0 4px 12px rgba(15,23,42,.08);
}

.he-count-label {
  font-size: 0.82rem;
  color: var(--muted);
  font-weight: 500;
}

/* View switch */
.he-view-switch,
.he-view-card {
  display: flex;
  gap: 4px;
}

.he-view-card {
  padding: 5px;
  border: 1px solid var(--border);
  border-radius: 11px;
  background: var(--surface-strong);
}

.he-view-btn {
  height: 30px;
  padding: 0 12px;
  border-radius: 7px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--muted);
  font: inherit;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all .15s;
  white-space: nowrap;
}
.he-view-btn:hover { background: var(--surface-muted); }
.he-view-btn--active {
  background: #2563eb;
  color: #fff;
  border-color: #2563eb;
}

/* Hover card */
.he-hover-card-wrap {
  right: 14px;
  top: 14px;
  width: min(340px, calc(100% - 28px));
}

.he-hover-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  text-align: center;
  padding: 28px 20px;
  border-radius: 14px;
  background: var(--surface);
  backdrop-filter: blur(10px);
  border: 1px solid var(--border);
  box-shadow: 0 8px 24px rgba(15,23,42,.08);
}
.he-hover-placeholder span { font-size: 1.6rem; }
.he-hover-placeholder p { margin: 0; font-size: 0.82rem; color: var(--muted); max-width: 22ch; }

/* Legend */
.he-legend {
  left: 14px;
  bottom: 14px;
  display: flex;
  gap: 12px;
  padding: 8px 12px;
  border-radius: 9px;
  background: var(--surface);
  backdrop-filter: blur(8px);
  border: 1px solid var(--border);
  font-size: 0.78rem;
  color: var(--muted);
}
.he-legend span { display: flex; align-items: center; gap: 6px; }
.he-dot { width: 10px; height: 10px; border-radius: 50%; background: #2563eb; display: block; }
.he-dot--fav { background: #16a34a; }

/* ── LIST VIEW ── */
.he-list-shell {
  max-width: 1240px;
  width: 100%;
  margin: 0 auto;
}

.he-list-layout {
  display: grid;
  grid-template-columns: 260px minmax(0,1fr);
  gap: 20px;
  align-items: start;
}

/* Sidebar */
.he-sidebar {
  position: sticky;
  top: 20px;
  display: grid;
  gap: 12px;
}

.he-sidebar-card {
  padding: 16px 18px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--surface);
  box-shadow: 0 2px 8px rgba(15,23,42,.04);
  display: grid;
  gap: 12px;
}

.he-sidebar-kicker {
  margin: 0;
  font: 700 0.65rem/1 var(--font-mono, monospace);
  text-transform: uppercase;
  letter-spacing: .1em;
  color: #3b82f6;
}

.he-sidebar-fields { display: grid; gap: 10px; }

.he-sidebar-field { display: grid; gap: 5px; }
.he-sidebar-field > span { font-size: 0.75rem; font-weight: 600; color: var(--muted); }

.he-search-wrap { position: relative; }
.he-search-icon--inside { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); width: 13px; height: 13px; color: #94a3b8; pointer-events: none; z-index: 1; }

/* Stats card */
.he-stats-card {
  display: grid;
  grid-template-columns: repeat(3,1fr);
  gap: 6px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--surface);
  box-shadow: 0 2px 8px rgba(15,23,42,.04);
}

.he-stat {
  display: grid;
  gap: 2px;
  text-align: center;
  padding: 8px 4px;
  border-radius: 9px;
  background: var(--surface-strong);
}
.he-stat span { font-size: 0.68rem; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; color: #94a3b8; }
.he-stat strong { font-size: 1.1rem; font-weight: 800; color: var(--text); font-family: var(--font-heading); }

/* Feed */
.he-feed { display: grid; gap: 14px; }

.he-feed-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 22px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--surface);
  box-shadow: 0 2px 8px rgba(15,23,42,.04);
}

.he-feed-kicker {
  margin: 0 0 4px;
  font: 700 0.65rem/1 var(--font-mono, monospace);
  text-transform: uppercase;
  letter-spacing: .1em;
  color: #3b82f6;
}

.he-feed-title {
  margin: 0;
  font-family: var(--font-heading);
  font-size: 1.4rem;
  color: var(--text);
}

.he-feed-count {
  font-size: 0.84rem;
  color: var(--muted);
  font-weight: 500;
  white-space: nowrap;
}

/* Empty */
.he-feed-empty {
  display: grid;
  gap: 8px;
  justify-items: center;
  text-align: center;
  padding: 48px 24px;
  border: 1.5px dashed var(--border);
  border-radius: 16px;
  background: var(--surface-strong);
}
.he-feed-empty-icon { font-size: 2rem; }
.he-feed-empty strong { font-size: 0.95rem; color: var(--text); }
.he-feed-empty p { margin: 0; font-size: 0.84rem; color: #94a3b8; }

/* Feed list */
.he-feed-list { display: grid; gap: 10px; }

/* Feed card */
.he-card {
  display: grid;
  grid-template-columns: 56px minmax(0,1fr) auto;
  gap: 16px;
  align-items: start;
  padding: 18px 20px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--surface);
  box-shadow: 0 2px 8px rgba(15,23,42,.04);
  transition: border-color .15s, box-shadow .15s, transform .15s;
}
.he-card:hover {
  border-color: var(--accent-soft);
  box-shadow: 0 6px 20px rgba(59,130,246,.1);
  transform: translateY(-1px);
}

.he-card-avatar {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--border);
  background: linear-gradient(135deg, #dbeafe, #bfdbfe);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  font-weight: 800;
  color: var(--chip-blue-text);
  text-decoration: none;
  flex-shrink: 0;
}
.he-card-avatar img { width: 100%; height: 100%; object-fit: cover; }

/* Card body */
.he-card-body { display: grid; gap: 8px; min-width: 0; }

.he-card-chips { display: flex; flex-wrap: wrap; gap: 5px; }

.he-chip {
  height: 20px;
  padding: 0 8px;
  border-radius: 5px;
  font-size: 0.68rem;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
}
.he-chip--blue   { background: var(--chip-blue); color: var(--chip-blue-text); }
.he-chip--green  { background: var(--chip-green); color: var(--success); }
.he-chip--purple { background: var(--chip-purple); color: var(--chip-purple-text); }
.he-chip--orange { background: var(--chip-orange); color: var(--chip-orange-text); }
.he-chip--grey   { background: var(--surface-muted); color: var(--muted); }

.he-card-company {
  margin: 0;
  font-size: 0.75rem;
  font-weight: 700;
  color: #3b82f6;
  text-transform: uppercase;
  letter-spacing: .04em;
}

.he-card-title {
  margin: 0;
  font-family: var(--font-heading);
  font-size: 1.1rem;
  color: var(--text);
  line-height: 1.2;
}

.he-card-title a {
  color: inherit;
  text-decoration: none;
}
.he-card-title a:hover { color: #2563eb; }

.he-card-summary {
  margin: 0;
  font-size: 0.86rem;
  color: var(--muted);
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.he-card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.he-card-meta > span {
  font-size: 0.76rem;
  color: var(--muted);
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.he-meta-tag {
  height: 20px;
  padding: 0 8px;
  border-radius: 5px;
  border: 1px solid var(--border);
  background: var(--surface-strong);
  font-size: 0.72rem;
  color: var(--muted);
  display: inline-flex;
  align-items: center;
}

/* Apply button */
.he-card-action {
  display: flex;
  align-items: flex-start;
  padding-top: 2px;
}

.he-apply-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 16px;
  border-radius: 9px;
  background: #2563eb;
  color: #fff;
  font-size: 0.82rem;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
  transition: background .15s;
}
.he-apply-btn:hover { background: #1d4ed8; }
.he-apply-icon { width: 14px; height: 14px; flex-shrink: 0; }

/* ── Responsive ── */
@media (max-width: 1024px) {
  .he-list-layout { grid-template-columns: 1fr; }
  .he-sidebar { position: static; }
  .he-stats-card { display: none; }
}

@media (max-width: 760px) {
  .he-filter-inner {
    grid-template-columns: 1fr 1fr;
    display: grid;
  }
  .he-filter-field--wide { grid-column: 1 / -1; }
  .he-hover-card-wrap { display: none; }
  .he-card {
    grid-template-columns: 44px minmax(0,1fr);
    grid-template-rows: auto auto;
  }
  .he-card-action { grid-column: 2; }
}

@media (max-width: 540px) {
  .he-card { grid-template-columns: 1fr; }
  .he-card-avatar { width: 44px; height: 44px; border-radius: 10px; }
  .he-card-action { grid-column: 1; }
}
</style>

<style scoped>
:global(.dark) .he-filter-inner,
:global(.dark) .he-toolbar,
:global(.dark) .he-sidebar-card,
:global(.dark) .he-stats-card,
:global(.dark) .he-legend { background: var(--surface); border-color: var(--border); }

:global(.dark) .he-card { background: var(--surface); border-color: var(--border); }
:global(.dark) .he-card:hover { border-color: var(--accent); }
:global(.dark) .he-card-avatar { border-color: var(--border); background: var(--surface-muted); }

:global(.dark) .he-chip--blue   { background: #0f1e38; color: #60a5fa; }
:global(.dark) .he-chip--green  { background: #091a0d; color: #4ade80; }
:global(.dark) .he-chip--purple { background: #130e22; color: #a78bfa; }
:global(.dark) .he-chip--orange { background: #1c1000; color: #fb923c; }
:global(.dark) .he-chip--grey   { background: #263045; color: var(--muted); }

:global(.dark) .he-status--error { border-color: #7f1d1d; background: #1f0808; color: #fca5a5; }
:global(.dark) .he-reset-btn:hover { border-color: #7f1d1d; background: #1f0808; color: #fca5a5; }
:global(.dark) .he-feed-empty { border-color: var(--border); background: var(--surface-muted); }

:global(.dark) .he-view-card { background: var(--surface); border-color: var(--border); }
:global(.dark) .he-view-btn:hover { background: var(--surface-muted); }

:global(.dark) .he-hover-card { background: var(--surface); border-color: var(--border); }
:global(.dark) .he-hover-card-avatar { background: var(--surface-muted); border-color: var(--border); }
</style>
