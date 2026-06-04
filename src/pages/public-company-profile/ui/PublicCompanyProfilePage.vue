<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import LucideArrowRight from '~icons/lucide/arrow-right'
import type { Opportunity } from '@/entities/opportunity/model/types'
import OpportunityCard from '@/entities/opportunity/ui/OpportunityCard.vue'
import { fetchCompanyById, fetchPublicCatalog, getApiErrorMessage } from '@/shared/api'
import type { EmployerCompanyDto } from '@/shared/api'
import { getCompanyProfilePreview } from '@/shared/lib/profile-preview'

const route = useRoute()

const profileId = computed(() => String(route.params.id || ''))
const preview = computed(() => getCompanyProfilePreview(profileId.value))
const company = ref<EmployerCompanyDto | null>(null)
const opportunities = ref<Opportunity[]>([])
const opportunitiesError = ref('')
const profileError = ref('')
const isLoading = ref(true)

const companyHighlights = computed(() => {
  if (!company.value && !preview.value) return []
  return [
    { label: 'Индустрия', value: company.value?.industry || 'Не указана' },
    { label: 'Размер', value: company.value?.company_size || 'Не указан' },
    { label: 'Год основания', value: company.value?.founded_year ? String(company.value.founded_year) : 'Не указан' },
    { label: 'ИНН', value: company.value?.inn || 'Не указан' },
    { label: 'Юр. название', value: company.value?.legal_name || 'Не указано' },
    { label: 'Статус', value: company.value?.status || 'Не указан' },
  ].filter((h) => h.value && h.value !== 'Не указан' && h.value !== 'Не указана' && h.value !== 'Не указано')
})

const visibleProfileError = computed(() => (preview.value ? '' : profileError.value))

const initials = computed(() =>
  (company.value?.brand_name || company.value?.legal_name || preview.value?.companyName || 'CO')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase(),
)

const companyName = computed(
  () => company.value?.brand_name || company.value?.legal_name || preview.value?.companyName || 'Компания',
)

const companyDescription = computed(
  () => company.value?.description || preview.value?.description || '',
)

const companyAvatarUrl = computed(
  () => company.value?.avatar_url || preview.value?.avatarUrl || '',
)

const companyWebsite = computed(
  () => company.value?.website_url || preview.value?.website || '',
)

const companyContacts = computed(
  () => preview.value?.contacts || [],
)

const companyOpportunities = computed(() => {
  if (!company.value && !preview.value) return []
  const normalizedId = (company.value?.id || preview.value?.id || '').trim().toLowerCase()
  const normalizedName = companyName.value.trim().toLowerCase()
  return opportunities.value.filter((item) => {
    const byId = Boolean(normalizedId) && item.companyId?.trim().toLowerCase() === normalizedId
    const byName = Boolean(normalizedName) && item.companyName?.trim().toLowerCase() === normalizedName
    return byId || byName
  })
})

onMounted(async () => {
  isLoading.value = true
  try {
    company.value = await fetchCompanyById(profileId.value)
  } catch (error) {
    profileError.value = getApiErrorMessage(error, 'Не удалось загрузить профиль компании.')
  }

  try {
    const catalog = await fetchPublicCatalog()
    opportunities.value = catalog.opportunities
  } catch (error) {
    opportunitiesError.value = getApiErrorMessage(error, 'Не удалось загрузить возможности.')
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <main class="page-shell">
    <div class="cp-root">

      <!-- Not found -->
      <template v-if="!company && !preview && !isLoading">
        <div class="cp-error-card">
          <div class="cp-error-icon">🏢</div>
          <strong>Профиль недоступен</strong>
          <p>Для этой компании ещё нет данных. Откройте её через вакансию или чат.</p>
          <RouterLink to="/" class="cp-btn cp-btn-ghost">← На главную</RouterLink>
        </div>
      </template>

      <template v-if="company || preview">

        <!-- Hero -->
        <header class="cp-hero">
          <div class="cp-cover"></div>
          <div class="cp-hero-body">
            <div class="cp-avatar">
              <img v-if="companyAvatarUrl" :src="companyAvatarUrl" :alt="companyName" />
              <span v-else>{{ initials }}</span>
            </div>
            <div class="cp-identity">
              <p class="cp-eyebrow">Профиль компании</p>
              <h1 class="cp-name">{{ companyName }}</h1>

              <div class="cp-links">
                <a v-if="companyWebsite" :href="companyWebsite" target="_blank" rel="noopener noreferrer" class="cp-site-link">
                  🌐 {{ companyWebsite.replace(/^https?:\/\//, '') }}
                </a>
                <span v-if="company?.industry" class="cp-chip">{{ company.industry }}</span>
                <span v-if="company?.company_size" class="cp-chip">{{ company.company_size }}</span>
                <span v-if="company?.founded_year" class="cp-chip">с {{ company.founded_year }}</span>
              </div>

              <div class="cp-actions">
                <RouterLink to="/chats" class="cp-btn cp-btn-white">Открыть чаты</RouterLink>
                <RouterLink to="/" class="cp-btn cp-btn-white">← Главная</RouterLink>
              </div>
            </div>
          </div>
        </header>

        <!-- Error -->
        <div v-if="visibleProfileError" class="cp-banner cp-banner--error">{{ visibleProfileError }}</div>

        <!-- Body -->
        <div class="cp-layout">

          <!-- Main column -->
          <div class="cp-main">

            <!-- About -->
            <section class="cp-card">
              <div class="cp-card-header">
                <p class="cp-kicker">О компании</p>
                <h2>Описание</h2>
              </div>
              <p v-if="companyDescription" class="cp-desc-text">{{ companyDescription }}</p>
              <p v-else class="cp-muted">Описание компании пока не добавлено.</p>
            </section>

            <!-- Contacts -->
            <section v-if="companyContacts.length" class="cp-card">
              <div class="cp-card-header">
                <p class="cp-kicker">Контакты</p>
                <h2>Как связаться</h2>
              </div>
              <div class="cp-contacts-list">
                <div v-for="(c, i) in companyContacts" :key="i" class="cp-contact-row">
                  <span class="cp-contact-icon">✉</span>
                  <span>{{ c }}</span>
                </div>
              </div>
            </section>

            <!-- Opportunities -->
            <section class="cp-card">
              <div class="cp-card-header">
                <div>
                  <p class="cp-kicker">Возможности</p>
                  <h2>Открытые позиции</h2>
                </div>
                <span v-if="companyOpportunities.length" class="cp-count">{{ companyOpportunities.length }}</span>
              </div>

              <div v-if="opportunitiesError" class="cp-banner cp-banner--error">{{ opportunitiesError }}</div>
              <div v-else-if="!companyOpportunities.length" class="cp-empty">
                <span>📋</span>
                <p>Открытых позиций для этой компании пока нет.</p>
              </div>
              <div v-else class="cp-opp-list">
                <OpportunityCard
                  v-for="opportunity in companyOpportunities"
                  :key="opportunity.id"
                  :opportunity="opportunity"
                  compact
                />
              </div>
            </section>

          </div>

          <!-- Sidebar -->
          <aside class="cp-sidebar">

            <!-- Details -->
            <div v-if="companyHighlights.length" class="cp-card">
              <div class="cp-card-header">
                <p class="cp-kicker">Реквизиты</p>
                <h2>Детали</h2>
              </div>
              <div class="cp-details-list">
                <div v-for="h in companyHighlights" :key="h.label" class="cp-detail-row">
                  <span>{{ h.label }}</span>
                  <strong>{{ h.value }}</strong>
                </div>
              </div>
            </div>

            <!-- Website card -->
            <div v-if="companyWebsite" class="cp-card cp-card--site">
              <p class="cp-kicker">Сайт</p>
              <a :href="companyWebsite" target="_blank" rel="noopener noreferrer" class="cp-site-card-link">
                <div class="cp-site-icon">🌐</div>
                <span>{{ companyWebsite.replace(/^https?:\/\//, '') }}</span>
                <LucideArrowRight class="cp-site-arrow" />
              </a>
            </div>

          </aside>
        </div>

      </template>

    </div>
  </main>
</template>

<style scoped>
/* ── Root ── */
.cp-root {
  display: grid;
  gap: 20px;
  max-width: 1060px;
  margin: 0 auto;
}

/* ── Error card ── */
.cp-error-card {
  display: grid;
  gap: 10px;
  justify-items: center;
  text-align: center;
  padding: 48px 32px;
  border: 1.5px dashed #e2e8f0;
  border-radius: 20px;
  background: var(--surface-strong);
}
.cp-error-icon { font-size: 2.5rem; }
.cp-error-card strong { font-size: 1.05rem; color: var(--text); }
.cp-error-card p { margin: 0; font-size: 0.88rem; color: var(--muted); }

/* ── Hero ── */
.cp-hero {
  border-radius: 20px;
  border: 1px solid rgba(18,38,63,.08);
  background: var(--surface);
  box-shadow: 0 4px 24px rgba(15,23,42,.06);
  overflow: hidden;
}

.cp-cover {
  height: 130px;
  background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 40%, #2563eb 70%, #60a5fa 100%);
}

.cp-hero-body {
  display: flex;
  gap: 22px;
  align-items: flex-start;
  padding: 0 30px 26px;
}

.cp-avatar {
  width: 86px;
  height: 86px;
  border-radius: 18px;
  border: 4px solid #fff;
  overflow: hidden;
  flex-shrink: 0;
  margin-top: -38px;
  box-shadow: 0 4px 18px rgba(15,23,42,.14);
  background: linear-gradient(135deg, #1e40af, #3b82f6);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 1.5rem;
  font-weight: 800;
  font-family: var(--font-heading);
}
.cp-avatar img { width: 100%; height: 100%; object-fit: cover; }

.cp-identity {
  display: grid;
  gap: 8px;
  flex: 1;
  min-width: 0;
  padding-top: 12px;
}

.cp-eyebrow {
  margin: 0;
  font: 700 0.65rem/1 var(--font-mono, monospace);
  text-transform: uppercase;
  letter-spacing: .1em;
  color: #3b82f6;
}

.cp-name {
  margin: 0;
  font-family: var(--font-heading);
  font-size: clamp(1.5rem, 3vw, 2.1rem);
  color: var(--text);
  line-height: 1.1;
}

.cp-links {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.cp-site-link {
  font-size: 0.83rem;
  color: #2563eb;
  text-decoration: none;
  font-weight: 500;
}
.cp-site-link:hover { text-decoration: underline; }

.cp-chip {
  height: 22px;
  padding: 0 10px;
  border-radius: 6px;
  background: var(--surface-muted);
  color: var(--muted);
  font-size: 0.72rem;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
}

.cp-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

/* ── Banner ── */
.cp-banner {
  padding: 12px 16px;
  border: 1px solid var(--border);
  border-radius: 12px;
  font-size: 0.87rem;
  color: var(--muted);
}
.cp-banner--error { border-color: #fca5a5; background: #fef2f2; color: #991b1b; }

/* ── Layout ── */
.cp-layout {
  display: grid;
  grid-template-columns: minmax(0,1fr) 280px;
  gap: 20px;
  align-items: start;
}

.cp-main { display: grid; gap: 16px; }
.cp-sidebar { display: grid; gap: 12px; }

/* ── Cards ── */
.cp-card {
  padding: 20px 22px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--surface);
  box-shadow: 0 2px 8px rgba(15,23,42,.04);
  display: grid;
  gap: 14px;
}

.cp-card--site {
  gap: 10px;
  padding: 16px 18px;
}

.cp-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.cp-card-header > div { display: grid; gap: 2px; }

.cp-kicker {
  margin: 0;
  font: 700 0.65rem/1 var(--font-mono, monospace);
  text-transform: uppercase;
  letter-spacing: .1em;
  color: #3b82f6;
}

.cp-card-header h2 {
  margin: 0;
  font-family: var(--font-heading);
  font-size: 1.05rem;
  color: var(--text);
}

.cp-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 7px;
  border-radius: 999px;
  background: var(--surface-muted);
  color: var(--muted);
  font-size: 0.73rem;
  font-weight: 700;
  flex-shrink: 0;
}

/* Description */
.cp-desc-text {
  margin: 0;
  font-size: 0.9rem;
  color: var(--text);
  line-height: 1.75;
  white-space: pre-wrap;
}

.cp-muted {
  margin: 0;
  font-size: 0.84rem;
  color: var(--border-strong);
  font-style: italic;
}

/* Contacts */
.cp-contacts-list { display: grid; gap: 6px; }
.cp-contact-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: 10px;
  background: var(--surface-strong);
  border: 1px solid #f1f5f9;
  font-size: 0.87rem;
  color: var(--text);
}
.cp-contact-icon { font-size: 0.85rem; flex-shrink: 0; }

/* Opportunities */
.cp-empty {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 20px;
  border: 1.5px dashed #e2e8f0;
  border-radius: 12px;
  font-size: 0.84rem;
  color: var(--border-strong);
}
.cp-empty span { font-size: 1.2rem; flex-shrink: 0; }
.cp-empty p { margin: 0; }
.cp-opp-list { display: grid; gap: 10px; }

/* Details list */
.cp-details-list { display: grid; gap: 6px; }
.cp-detail-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 9px;
  background: var(--surface-strong);
  border: 1px solid #f1f5f9;
}
.cp-detail-row span { font-size: 0.75rem; color: var(--border-strong); flex-shrink: 0; }
.cp-detail-row strong { font-size: 0.84rem; font-weight: 600; color: var(--text); text-align: right; }

/* Site card */
.cp-site-card-link {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface-strong);
  text-decoration: none;
  transition: background .15s, border-color .15s;
}
.cp-site-card-link:hover { background: #eff6ff; border-color: #bfdbfe; }
.cp-site-icon { font-size: 1.1rem; flex-shrink: 0; }
.cp-site-card-link span:nth-child(2) { flex: 1; font-size: 0.84rem; font-weight: 500; color: #2563eb; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cp-site-arrow { width: 15px; height: 15px; color: var(--border-strong); flex-shrink: 0; }

/* ── Buttons ── */
.cp-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 34px;
  padding: 0 16px;
  border-radius: 10px;
  border: 1px solid transparent;
  font: inherit;
  font-size: 0.84rem;
  font-weight: 500;
  cursor: pointer;
  text-decoration: none;
  transition: all .15s;
  white-space: nowrap;
}
.cp-btn-ghost {
  background: transparent;
  border-color: var(--border);
  color: var(--muted);
}
.cp-btn-ghost:hover { background: var(--surface-strong); border-color: var(--border-strong); }
.cp-btn-white {
  background: rgba(255,255,255,.15);
  border-color: rgba(255,255,255,.35);
  color: #fff;
}
.cp-btn-white:hover { background: rgba(255,255,255,.25); }

/* ── Responsive ── */
@media (max-width: 860px) {
  .cp-layout { grid-template-columns: 1fr; }
  .cp-sidebar { grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); }
}
@media (max-width: 600px) {
  .cp-hero-body { flex-direction: column; gap: 14px; padding: 0 18px 20px; }
  .cp-avatar { margin-top: -32px; width: 72px; height: 72px; border-radius: 14px; }
  .cp-identity { padding-top: 0; }
  .cp-sidebar { grid-template-columns: 1fr; }
}
</style>
