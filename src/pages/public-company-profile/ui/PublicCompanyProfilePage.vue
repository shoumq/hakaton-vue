<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

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

const companyHighlights = computed(() => {
  if (!company.value && !preview.value) {
    return []
  }

  return [
    { label: 'Компания', value: company.value?.brand_name || company.value?.legal_name || preview.value?.companyName || 'Не указана' },
    { label: 'Сайт', value: company.value?.website_url || preview.value?.website || 'Не указан' },
    { label: 'Индустрия', value: company.value?.industry || preview.value?.industry || 'Не указана' },
    { label: 'Контакты', value: preview.value?.contacts?.length ? preview.value.contacts.join(', ') : 'Не указаны' },
  ]
})

const visibleProfileError = computed(() => (preview.value ? '' : profileError.value))

const initials = computed(() =>
  (company.value?.brand_name || company.value?.legal_name || preview.value?.companyName || 'CO')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase(),
)

const companyName = computed(
  () => company.value?.brand_name || company.value?.legal_name || preview.value?.companyName || 'Компания',
)

const companyDescription = computed(
  () => company.value?.description || preview.value?.description || 'Описание компании пока не добавлено.',
)

const companyAvatarUrl = computed(
  () => company.value?.avatar_url || preview.value?.avatarUrl || '',
)

const companyOpportunities = computed(() => {
  if (!company.value && !preview.value) {
    return []
  }

  const normalizedId = (company.value?.id || preview.value?.id || '').trim().toLowerCase()
  const normalizedName = companyName.value.trim().toLowerCase()

  return opportunities.value.filter((item) => {
    const byId = Boolean(normalizedId) && item.companyId?.trim().toLowerCase() === normalizedId
    const byName = Boolean(normalizedName) && item.companyName?.trim().toLowerCase() === normalizedName
    return byId || byName
  })
})

onMounted(async () => {
  try {
    company.value = await fetchCompanyById(profileId.value)
  } catch (error) {
    profileError.value = getApiErrorMessage(error, 'Не удалось загрузить профиль компании.')
  }

  try {
    const catalog = await fetchPublicCatalog()
    opportunities.value = catalog.opportunities
  } catch (error) {
    opportunitiesError.value = getApiErrorMessage(error, 'Не удалось загрузить возможности компании.')
  }
})
</script>

<template>
  <main class="page-shell">
    <section class="dashboard">
      <template v-if="company || preview">
        <div class="dashboard-hero">
          <div class="hero-copy-block">
            <p class="eyebrow">Company Profile</p>
            <h1>{{ companyName }}</h1>
            <p class="hero-copy">
              {{ companyDescription }}
            </p>
          </div>

          <div class="verification-card">
            <div class="avatar-shell large">
              <img
                v-if="companyAvatarUrl"
                :src="companyAvatarUrl"
                :alt="companyName"
                class="avatar-image"
              />
              <div v-else class="company-avatar-art">
                <span class="avatar-fallback">{{ initials }}</span>
              </div>
            </div>
            <strong>Профиль компании</strong>
            <div class="hero-side-actions">
              <RouterLink to="/chats" class="primary-button">Открыть чаты</RouterLink>
              <RouterLink to="/" class="ghost-button">На главную</RouterLink>
            </div>
          </div>
        </div>

        <section class="dashboard-grid single-column">
          <p v-if="visibleProfileError" class="section-copy error-copy">{{ visibleProfileError }}</p>
          <article class="section-card">
            <div class="section-title">
              <h2>Профиль компании</h2>
              <p>Карточка оформлена в том же визуальном стиле, что и кабинет работодателя.</p>
            </div>
            <div class="editor-grid profile-summary-grid">
              <div v-for="item in companyHighlights" :key="item.label" class="summary-card">
                <span>{{ item.label }}</span>
                <strong>{{ item.value }}</strong>
              </div>
            </div>
          </article>

          <article class="section-card">
            <div class="section-title">
              <h2>Открытые возможности компании</h2>
              <p>Здесь собраны вакансии и другие возможности, доступные в публичном каталоге.</p>
            </div>
            <p v-if="opportunitiesError" class="section-copy error-copy">{{ opportunitiesError }}</p>
            <p v-else-if="!companyOpportunities.length" class="section-copy">
              Пока не найдено открытых возможностей для этой компании.
            </p>
            <div v-else class="opportunities-list">
              <OpportunityCard
                v-for="opportunity in companyOpportunities"
                :key="opportunity.id"
                :opportunity="opportunity"
                compact
              />
            </div>
          </article>
        </section>
      </template>

      <article v-else class="section-card">
        <div class="section-title">
          <h2>Профиль недоступен</h2>
          <p>Для этой компании ещё нет сохраненных данных на клиенте. Сначала откройте её из вакансии или чата.</p>
        </div>
        <div class="summary-actions">
          <RouterLink to="/" class="ghost-button">На главную</RouterLink>
        </div>
      </article>
    </section>
  </main>
</template>

<style scoped>
.dashboard,
.dashboard-grid {
  display: grid;
  gap: 16px;
}

.dashboard {
  max-width: 1240px;
  margin: 0 auto;
}

.dashboard-hero,
.section-card {
  padding: 24px;
  border: 1px solid rgba(18, 38, 63, 0.08);
  border-radius: 18px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(246, 248, 251, 0.94));
  box-shadow: 0 22px 52px rgba(15, 23, 42, 0.06);
}

.dashboard-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 20px;
  background:
    radial-gradient(circle at top left, rgba(27, 84, 255, 0.08), transparent 32%),
    linear-gradient(180deg, #ffffff, #f5f8fc);
}

.dashboard-grid.single-column {
  grid-template-columns: 1fr;
}

.hero-copy-block {
  display: grid;
  gap: 14px;
  align-content: start;
}

.hero-side-actions {
  display: grid;
  gap: 10px;
}

.hero-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.metric-chip {
  min-width: 180px;
  padding: 14px 16px;
  border: 1px solid rgba(18, 38, 63, 0.08);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.84);
  backdrop-filter: blur(10px);
}

.metric-chip span {
  display: block;
  margin-bottom: 4px;
  color: var(--muted);
  font-size: 0.75rem;
  text-transform: uppercase;
}

.metric-chip strong {
  font-size: 0.98rem;
}

.eyebrow {
  margin: 0;
  color: #2952cc;
  font: 700 0.72rem/1 var(--font-mono);
  text-transform: uppercase;
}

h1,
h2 {
  margin: 0;
  font-family: var(--font-heading);
}

h1 {
  font-size: clamp(1.9rem, 4vw, 3rem);
  line-height: 1;
}

.hero-copy,
.section-card p,
.verification-card p {
  margin: 0;
  color: #5c6778;
  line-height: 1.6;
  font-size: 0.95rem;
}

.section-title {
  display: grid;
  gap: 6px;
  margin-bottom: 16px;
}

.section-title p {
  max-width: 42ch;
}

.verification-card,
.editor-grid {
  display: grid;
  gap: 12px;
  padding: 18px;
  border: 1px solid rgba(18, 38, 63, 0.08);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(10px);
}

.avatar-shell {
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 999px;
  background: var(--surface);
  border: 1px solid var(--border);
}

.avatar-shell.large {
  width: 104px;
  height: 104px;
  box-shadow: inset 0 0 0 1px rgba(18, 38, 63, 0.05);
}

.avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-fallback {
  font: 700 1.1rem/1 var(--font-mono);
  color: #fff;
}

.company-avatar-art {
  display: grid;
  place-items: center;
  width: calc(100% - 12px);
  height: calc(100% - 12px);
  border-radius: 999px;
  background:
    radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.34), transparent 34%),
    linear-gradient(135deg, #0f2c7a 0%, #1f56e0 62%, #49b3ff 100%);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.24),
    0 14px 28px rgba(31, 86, 224, 0.2);
}

.editor-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.profile-summary-grid {
  margin-top: 2px;
}

.summary-card {
  display: grid;
  gap: 6px;
  padding: 12px 14px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.92);
}

.summary-card span {
  color: #627087;
  font-size: 0.8rem;
}

.summary-card strong {
  color: #162033;
  font-size: 0.94rem;
  line-height: 1.35;
}

.summary-actions {
  display: flex;
  padding-top: 4px;
}

.section-copy {
  margin: 0;
  color: #5c6778;
  line-height: 1.6;
  font-size: 0.95rem;
}

.error-copy {
  color: var(--danger);
}

.opportunities-list {
  display: grid;
  gap: 14px;
}

@media (max-width: 1100px) {
  .dashboard-hero {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .dashboard-hero,
  .section-card {
    padding: 18px;
  }

  .editor-grid {
    grid-template-columns: 1fr;
  }
}
</style>
