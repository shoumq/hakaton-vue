<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import { StudentConnectionActions, useApplicantNetwork } from '@/features/contacts'
import { useSession } from '@/features/session/model/session'
import { RecommendationComposer } from '@/features/recommendations'
import LucideArrowRight from '~icons/lucide/arrow-right'
import { fetchPublicResumes, fetchStudentById, getApiErrorMessage } from '@/shared/api'
import type { PublicResumeDto, StudentProfileDto } from '@/shared/api'
import { ensureChatWithUser } from '@/shared/lib/chat'
import { getStudentProfilePreview } from '@/shared/lib/profile-preview'
import { formatDate } from '@/shared/lib/formatters'
import { showErrorToast, showSuccessToast } from '@/shared/lib/toast'

const route = useRoute()
const session = useSession()
const network = useApplicantNetwork()

const profileId = computed(() => String(route.params.id || ''))
const preview = computed(() => getStudentProfilePreview(profileId.value))
const profile = ref<StudentProfileDto | null>(null)
const isLoading = ref(true)
const profileError = ref('')
const resumes = ref<PublicResumeDto[]>([])
const resumesLoading = ref(false)
const resumesError = ref('')
const chatLoading = ref(false)
const contactModalOpen = ref(false)
const recommendationOpen = ref(false)
const requestMessage = ref('')

const fullName = computed(() => {
  const current = profile.value

  if (!current) {
    return preview.value?.displayName || 'Соискатель'
  }

  const firstName = current.first_name?.trim() ?? ''
  const lastName = current.last_name?.trim() ?? ''
  const displayName = current.display_name?.trim() ?? ''

  return [firstName, lastName].filter(Boolean).join(' ') || displayName || preview.value?.displayName || 'Соискатель'
})

const profileSummary = computed(() => {
  const current = profile.value
  const parts = [
    current?.university_name?.trim() ?? '',
    current?.faculty?.trim() ?? '',
    current?.specialization?.trim() ?? '',
  ].filter(Boolean)

  return parts.join(' • ') || preview.value?.headline || 'Публичная карточка кандидата на платформе.'
})

const aboutText = computed(
  () =>
    profile.value?.about?.trim() ||
    preview.value?.about ||
    'Пользователь пока не добавил подробное описание профиля.',
)

const privacyLabel = computed(() => {
  const visibility = profile.value?.profile_visibility ?? 'authorized_only'

  if (visibility === 'public_inside_platform' || visibility === 'public') {
    return 'Публичный внутри платформы'
  }

  if (visibility === 'private') {
    return 'Приватный'
  }

  if (visibility === 'contacts_only') {
    return 'Только контактам'
  }

  return 'Только авторизованным'
})

const educationFields = computed(() => {
  if (!profile.value && !preview.value) return []
  return [
    { label: 'Университет', value: profile.value?.university_name || null },
    { label: 'Факультет', value: profile.value?.faculty || null },
    { label: 'Специализация', value: profile.value?.specialization || null },
    { label: 'Курс', value: profile.value?.study_year ? `${profile.value.study_year} курс` : null },
    { label: 'Год выпуска', value: profile.value?.graduation_year ? `${profile.value.graduation_year}` : null },
    { label: 'Обновлён', value: profile.value?.updated_at ? formatDate(profile.value.updated_at) : null },
  ].filter((f) => f.value)
})

const socialLinks = computed(() => {
  const p = profile.value
  if (!p) return []
  return [
    { label: 'Telegram', value: p.telegram, href: p.telegram ? `https://t.me/${p.telegram.replace('@', '')}` : null },
    { label: 'GitHub', value: p.github_url, href: p.github_url },
    { label: 'LinkedIn', value: p.linkedin_url, href: p.linkedin_url },
    { label: 'Сайт', value: p.website_url, href: p.website_url },
  ].filter((l) => l.value)
})

const initials = computed(() =>
  (fullName.value || 'ST')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase(),
)

const relation = computed(() => network.getRelationForUserId(profileId.value))
const requestItem = computed(() => network.getRequestForUserId(profileId.value))
const contactLoading = computed(() => {
  const sending = network.sendingByUserId.value[profileId.value]
  const updating = requestItem.value ? network.updatingByRequestId.value[requestItem.value.id] : false
  return Boolean(sending || updating)
})
const recommendationDisabled = computed(() => !session.isAuthenticated.value)
const canConnect = computed(() => session.role.value === 'student')

function openContactModal() {
  requestMessage.value = ''
  contactModalOpen.value = true
}

function closeContactModal() {
  contactModalOpen.value = false
  requestMessage.value = ''
}

async function handleSubmitContactRequest() {
  try {
    await network.sendRequest(profileId.value, requestMessage.value)
    showSuccessToast('Запрос в контакты отправлен.')
    closeContactModal()
  } catch (error) {
    showErrorToast(error instanceof Error ? error.message : 'Не удалось отправить запрос в контакты.')
  }
}

async function handleAcceptRequest() {
  if (!requestItem.value) {
    return
  }

  try {
    await network.acceptRequest(requestItem.value.id)
    showSuccessToast('Запрос в контакты принят.')
  } catch (error) {
    showErrorToast(error instanceof Error ? error.message : 'Не удалось принять запрос.')
  }
}

async function handleRejectRequest() {
  if (!requestItem.value) {
    return
  }

  try {
    await network.rejectRequest(requestItem.value.id)
    showSuccessToast('Запрос отклонён.')
  } catch (error) {
    showErrorToast(error instanceof Error ? error.message : 'Не удалось отклонить запрос.')
  }
}

async function handleCancelRequest() {
  if (!requestItem.value) {
    return
  }

  try {
    await network.cancelRequest(requestItem.value.id)
    showSuccessToast('Запрос отменён.')
  } catch (error) {
    showErrorToast(error instanceof Error ? error.message : 'Не удалось отменить запрос.')
  }
}

async function handleOpenChat() {
  chatLoading.value = true

  try {
    const chat = await ensureChatWithUser({ participantUserId: profileId.value })
    window.location.assign(`/chats/${chat.id}`)
  } catch (error) {
    showErrorToast(error instanceof Error ? error.message : 'Не удалось открыть чат.')
  } finally {
    chatLoading.value = false
  }
}

async function loadProfile() {
  if (!profileId.value) {
    profile.value = null
    profileError.value = 'Некорректный идентификатор профиля.'
    isLoading.value = false
    return
  }

  isLoading.value = true
  profileError.value = ''

  try {
    profile.value = await fetchStudentById(profileId.value)
  } catch (error) {
    profile.value = null
    profileError.value = getApiErrorMessage(error, 'Не удалось загрузить профиль студента.')
  } finally {
    isLoading.value = false
  }

  // Load resumes — use user_id from loaded profile if available
  const targetUserId = profile.value?.user_id || profileId.value
  resumesLoading.value = true
  resumesError.value = ''
  try {
    resumes.value = await fetchPublicResumes(targetUserId)
  } catch (e) {
    resumesError.value = getApiErrorMessage(e, 'Не удалось загрузить резюме.')
    resumes.value = []
  } finally {
    resumesLoading.value = false
  }
}

async function loadPage() {
  await session.restoreSession()

  if (session.currentUser.value?.id) {
    try {
      await network.loadNetwork(session.currentUser.value.id)
    } catch {
      // The page can still render even if the contact network failed to load.
    }
  }

  await loadProfile()
}

onMounted(loadPage)
watch(profileId, loadProfile)
</script>

<template>
  <main class="page-shell">
    <div class="sp-root">

      <!-- Loading / error states -->
      <div v-if="isLoading" class="sp-status">
        <div class="sp-spinner"></div>
        Загружаем профиль…
      </div>
      <div v-else-if="profileError && !profile" class="sp-error-card">
        <div class="sp-error-icon">🔒</div>
        <strong>Профиль недоступен</strong>
        <p>{{ profileError }}</p>
        <RouterLink to="/contacts" class="sp-btn sp-btn-ghost">← Назад к контактам</RouterLink>
      </div>

      <template v-if="profile || (!isLoading && preview)">

        <!-- Hero -->
        <div class="sp-hero">
          <div class="sp-cover"></div>
          <div class="sp-hero-body">
            <div class="sp-avatar-ring">
              <img
                v-if="preview?.avatarUrl"
                :src="preview.avatarUrl"
                :alt="fullName"
                class="sp-avatar-img"
              />
              <span v-else class="sp-avatar-fallback">{{ initials }}</span>
            </div>
            <div class="sp-identity">
              <p class="sp-eyebrow">Профиль кандидата</p>
              <h1 class="sp-name">{{ fullName }}</h1>
              <p class="sp-headline">{{ profileSummary }}</p>
              <div class="sp-meta-chips">
                <span v-if="profile?.study_year" class="sp-chip">{{ profile.study_year }} курс</span>
                <span v-if="profile?.graduation_year" class="sp-chip">Выпуск {{ profile.graduation_year }}</span>
                <span v-if="profile?.show_resume" class="sp-chip sp-chip-green">Резюме</span>
                <span v-if="profile?.show_applications" class="sp-chip sp-chip-blue">Открыт к откликам</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Body -->
        <div class="sp-layout">

          <!-- Main column -->
          <div class="sp-main">

            <!-- About -->
            <section class="sp-card">
              <div class="sp-card-header">
                <h2>О кандидате</h2>
              </div>
              <p class="sp-about-text">{{ aboutText }}</p>
              <div v-if="preview?.coverLetter" class="sp-cover-letter">
                <p class="sp-cl-label">Сопроводительное письмо</p>
                <p>{{ preview.coverLetter }}</p>
              </div>
            </section>

            <!-- Resumes -->
            <section class="sp-card">
              <div class="sp-card-header">
                <h2>Резюме</h2>
                <span v-if="resumes.length" class="sp-resume-count">{{ resumes.length }}</span>
              </div>

              <div v-if="resumesLoading" class="sp-resume-loading">
                <span class="sp-mini-spinner"></span> Загружаем…
              </div>
              <div v-else-if="resumesError" class="sp-resume-error">{{ resumesError }}</div>
              <div v-else-if="!resumes.length" class="sp-resume-empty">
                Резюме не добавлено
              </div>
              <div v-else class="sp-resume-list">
                <RouterLink
                  v-for="r in resumes"
                  :key="r.id"
                  :to="`/profiles/students/${profileId}/resumes/${r.id}`"
                  class="sp-resume-row"
                >
                  <div class="sp-resume-icon">📄</div>
                  <div class="sp-resume-info">
                    <div class="sp-resume-title-row">
                      <strong>{{ r.title || 'Без названия' }}</strong>
                      <span v-if="r.is_primary" class="sp-resume-primary">⭐ Основное</span>
                    </div>
                    <span v-if="r.summary" class="sp-resume-summary">{{ r.summary }}</span>
                  </div>
                  <LucideArrowRight class="sp-resume-arrow" />
                </RouterLink>
              </div>
            </section>

            <!-- Education -->
            <section v-if="educationFields.length" class="sp-card">
              <div class="sp-card-header">
                <h2>Образование</h2>
              </div>
              <div class="sp-edu-grid">
                <div v-for="field in educationFields" :key="field.label" class="sp-edu-item">
                  <span class="sp-edu-label">{{ field.label }}</span>
                  <strong class="sp-edu-value">{{ field.value }}</strong>
                </div>
              </div>
            </section>

          </div>

          <!-- Sidebar -->
          <aside class="sp-sidebar">

            <!-- Actions -->
            <div class="sp-card sp-action-card">
              <div class="sp-card-header">
                <h3>Связаться</h3>
              </div>
              <StudentConnectionActions
                v-if="session.isAuthenticated.value"
                :relation="relation"
                :can-connect="canConnect"
                :contact-loading="contactLoading"
                :chat-loading="chatLoading"
                :recommendation-disabled="recommendationDisabled"
                @add="openContactModal"
                @accept="handleAcceptRequest"
                @reject="handleRejectRequest"
                @cancel="handleCancelRequest"
                @message="handleOpenChat"
                @recommend="recommendationOpen = true"
              />
              <RouterLink to="/contacts" class="sp-btn sp-btn-ghost sp-btn-full">← Назад к контактам</RouterLink>
            </div>

            <!-- Social links -->
            <div v-if="socialLinks.length" class="sp-card">
              <div class="sp-card-header">
                <h3>Ссылки</h3>
              </div>
              <div class="sp-links-list">
                <a
                  v-for="link in socialLinks"
                  :key="link.label"
                  :href="link.href ?? '#'"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="sp-link-row"
                >
                  <span class="sp-link-label">{{ link.label }}</span>
                  <span class="sp-link-value">{{ link.value }}</span>
                </a>
              </div>
            </div>

            <!-- Privacy -->
            <div class="sp-card sp-privacy-card">
              <span class="sp-privacy-dot"></span>
              <span class="sp-privacy-text">{{ privacyLabel }}</span>
            </div>

          </aside>
        </div>

      </template>
    </div>

    <!-- Connect modal -->
    <div v-if="contactModalOpen" class="sp-overlay" @click.self="closeContactModal">
      <div class="sp-modal">
        <div class="sp-modal-header">
          <div>
            <p class="sp-eyebrow">Нетворкинг</p>
            <h2>Добавить в контакты</h2>
            <p class="sp-modal-hint">Можно отправить запрос с коротким сопроводительным сообщением.</p>
          </div>
          <button type="button" class="sp-modal-close" @click="closeContactModal">✕</button>
        </div>
        <div class="sp-modal-body">
          <label class="sp-field">
            <span>Кому</span>
            <input :value="fullName" type="text" readonly />
          </label>
          <label class="sp-field">
            <span>Сообщение <em>(необязательно)</em></span>
            <textarea
              v-model="requestMessage"
              rows="4"
              placeholder="Коротко объясните, почему хотите добавить пользователя в контакты…"
            />
          </label>
          <div class="sp-modal-actions">
            <button class="sp-btn sp-btn-primary" type="button" :disabled="contactLoading" @click="handleSubmitContactRequest">
              {{ contactLoading ? 'Отправляем…' : 'Отправить запрос' }}
            </button>
            <button class="sp-btn sp-btn-ghost" type="button" @click="closeContactModal">Отмена</button>
          </div>
        </div>
      </div>
    </div>

    <RecommendationComposer
      :open="recommendationOpen"
      :to-user-id="profileId"
      :target-label="fullName"
      @close="recommendationOpen = false"
      @submitted="recommendationOpen = false"
    />
  </main>
</template>

<style scoped>
/* ── Root ── */
.sp-root {
  display: grid;
  gap: 20px;
  max-width: 1100px;
  margin: 0 auto;
}

/* ── Status / error ── */
.sp-status {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 24px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--surface);
  color: var(--muted);
  font-size: 0.9rem;
}

.sp-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid #e2e8f0;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  flex-shrink: 0;
}

@keyframes spin { to { transform: rotate(360deg); } }

.sp-error-card {
  display: grid;
  gap: 10px;
  justify-items: center;
  text-align: center;
  padding: 48px 32px;
  border: 1.5px dashed #e2e8f0;
  border-radius: 20px;
  background: var(--surface-strong);
}

.sp-error-icon { font-size: 2.5rem; }

.sp-error-card strong {
  font-size: 1.1rem;
  color: var(--text);
}

.sp-error-card p {
  margin: 0;
  color: var(--muted);
  font-size: 0.9rem;
}

/* ── Hero ── */
.sp-hero {
  border-radius: 20px;
  border: 1px solid var(--border);
  background: var(--surface);
  box-shadow: 0 4px 24px rgba(15,23,42,0.06);
  /* No overflow:hidden — avatar needs to straddle cover boundary */
}

.sp-cover {
  height: 130px;
  border-radius: 19px 19px 0 0;
  background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 55%, #60a5fa 100%);
}

.sp-hero-body {
  display: flex;
  gap: 20px;
  align-items: flex-start;
  padding: 0 28px 24px;
}

.sp-avatar-ring {
  width: 92px;
  height: 92px;
  border-radius: 50%;
  border: 4px solid #fff;
  overflow: hidden;
  flex-shrink: 0;
  box-shadow: 0 4px 16px rgba(15,23,42,0.15);
  background: var(--surface);
  margin-top: -46px; /* half of avatar height to straddle cover */
}

.sp-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.sp-avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
  color: #fff;
  font-size: 1.4rem;
  font-weight: 800;
}

.sp-identity {
  padding-top: 10px; /* push text clear of cover boundary */
  display: grid;
  gap: 5px;
  flex: 1;
  min-width: 0;
}

.sp-eyebrow {
  margin: 0;
  font: 700 0.68rem/1 var(--font-mono, monospace);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #3b82f6;
}

.sp-name {
  margin: 0;
  font-family: var(--font-heading);
  font-size: clamp(1.5rem, 3vw, 2rem);
  color: var(--text);
  line-height: 1.15;
}

.sp-headline {
  margin: 0;
  font-size: 0.9rem;
  color: var(--muted);
  line-height: 1.5;
}

.sp-meta-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}

.sp-chip {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 10px;
  border-radius: 6px;
  background: var(--surface-muted);
  color: var(--muted);
  font-size: 0.72rem;
  font-weight: 600;
}

.sp-chip-green { background: var(--chip-green); color: var(--success); }
.sp-chip-blue  { background: var(--chip-blue); color: var(--chip-blue-text); }

/* ── Body layout ── */
.sp-layout {
  display: grid;
  grid-template-columns: minmax(0,1fr) 300px;
  gap: 20px;
  align-items: start;
}

/* ── Cards ── */
.sp-card {
  padding: 20px 22px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--surface);
  box-shadow: 0 2px 10px rgba(15,23,42,0.04);
}

.sp-main {
  display: grid;
  gap: 16px;
}

.sp-sidebar {
  display: grid;
  gap: 12px;
}

.sp-card-header {
  margin-bottom: 14px;
}

.sp-card-header h2,
.sp-card-header h3 {
  margin: 0;
  font-family: var(--font-heading);
  font-size: 1rem;
  color: var(--text);
}

/* ── About ── */
.sp-about-text {
  margin: 0;
  color: var(--muted);
  font-size: 0.92rem;
  line-height: 1.7;
}

.sp-cover-letter {
  margin-top: 16px;
  padding: 14px 16px;
  border-left: 3px solid #3b82f6;
  border-radius: 0 10px 10px 0;
  background: var(--surface-blue);
}

.sp-cl-label {
  margin: 0 0 6px;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #3b82f6;
}

.sp-cover-letter p {
  margin: 0;
  color: var(--muted);
  font-size: 0.9rem;
  line-height: 1.6;
}

/* ── Resumes ── */
.sp-resume-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px; height: 22px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--surface-muted);
  color: var(--muted);
  font-size: 0.73rem;
  font-weight: 700;
}

.sp-resume-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.84rem;
  color: var(--border-strong);
  padding: 8px 0;
}

.sp-mini-spinner {
  display: inline-block;
  width: 13px; height: 13px;
  border: 2px solid #e2e8f0;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: sp-spin .7s linear infinite;
}
@keyframes sp-spin { to { transform: rotate(360deg); } }

.sp-resume-empty,
.sp-resume-error {
  padding: 14px;
  border: 1.5px dashed #e2e8f0;
  border-radius: 10px;
  font-size: 0.84rem;
  color: var(--border-strong);
  text-align: center;
}

.sp-resume-error {
  border-color: var(--border-red);
  background: var(--surface-red);
  color: #991b1b;
}

.sp-resume-list { display: grid; gap: 8px; }

.sp-resume-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid #f1f5f9;
  border-radius: 12px;
  background: var(--surface-strong);
  text-decoration: none;
  transition: border-color 0.15s, background 0.15s, transform 0.1s;
}
.sp-resume-row:hover {
  border-color: #bfdbfe;
  background: var(--surface);
  transform: translateX(2px);
}
.sp-resume-row { gap: 12px; }

.sp-resume-icon { font-size: 1.3rem; flex-shrink: 0; line-height: 1; }

.sp-resume-info { display: grid; gap: 3px; flex: 1; min-width: 0; }

.sp-resume-title-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

.sp-resume-title-row strong {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text);
}

.sp-resume-primary {
  height: 18px; padding: 0 8px;
  border-radius: 5px;
  background: #fef3c7; color: #92400e;
  font-size: 0.67rem; font-weight: 700;
  display: inline-flex; align-items: center;
}

.sp-resume-summary {
  font-size: 0.79rem;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sp-resume-arrow {
  width: 15px;
  height: 15px;
  color: var(--border-strong);
  flex-shrink: 0;
}

/* ── Education grid ── */
.sp-edu-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.sp-edu-item {
  display: grid;
  gap: 3px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--surface-strong);
  border: 1px solid #f1f5f9;
}

.sp-edu-label {
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--border-strong);
}

.sp-edu-value {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text);
  line-height: 1.3;
}

/* ── Action card ── */
.sp-action-card {
  border-color: var(--border-blue);
  background: var(--surface-blue);
}

/* Make StudentConnectionActions buttons full-width inside sidebar */
.sp-action-card :deep(.action-row) {
  display: grid;
  gap: 8px;
  margin-bottom: 10px;
}

.sp-action-card :deep(.primary-button),
.sp-action-card :deep(.ghost-button) {
  width: 100%;
  justify-content: center;
  min-height: 38px;
  border-radius: 10px;
  font-size: 0.875rem;
}

/* ── Links ── */
.sp-links-list {
  display: grid;
  gap: 6px;
}

.sp-link-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--surface-strong);
  text-decoration: none;
  transition: background 0.15s;
}

.sp-link-row:hover { background: var(--surface-muted); }

.sp-link-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--border-strong);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  flex-shrink: 0;
}

.sp-link-value {
  font-size: 0.82rem;
  color: #2563eb;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 160px;
}

/* ── Privacy ── */
.sp-privacy-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: var(--surface-strong);
  border-color: var(--border);
}

.sp-privacy-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #22c55e;
  flex-shrink: 0;
}

.sp-privacy-text {
  font-size: 0.8rem;
  color: var(--muted);
}

/* ── Buttons ── */
.sp-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 38px;
  padding: 0 18px;
  border-radius: 10px;
  border: 1px solid transparent;
  font: inherit;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  text-decoration: none;
  transition: background 0.15s, border-color 0.15s;
  white-space: nowrap;
}

.sp-btn:disabled { opacity: 0.55; pointer-events: none; }

.sp-btn-primary {
  background: #2563eb;
  border-color: #2563eb;
  color: #fff;
}
.sp-btn-primary:hover { background: #1d4ed8; border-color: var(--chip-blue-text); }

.sp-btn-ghost {
  background: transparent;
  border-color: var(--border);
  color: var(--muted);
}
.sp-btn-ghost:hover { background: var(--surface-strong); border-color: var(--border-strong); }

.sp-btn-full { width: 100%; }

/* ── Modal overlay ── */
.sp-overlay {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(15,23,42,0.45);
  backdrop-filter: blur(6px);
}

.sp-modal {
  width: min(560px, 100%);
  border: 1px solid var(--border);
  border-radius: 20px;
  background: var(--surface);
  box-shadow: 0 24px 60px rgba(15,23,42,0.2);
  overflow: hidden;
}

.sp-modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 20px 24px 16px;
  border-bottom: 1px solid #f1f5f9;
}

.sp-modal-header h2 {
  margin: 4px 0 0;
  font-family: var(--font-heading);
  font-size: 1.1rem;
  color: var(--text);
}

.sp-modal-hint {
  margin: 6px 0 0;
  font-size: 0.84rem;
  color: var(--muted);
  line-height: 1.5;
}

.sp-modal-close {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface-strong);
  color: var(--muted);
  font-size: 0.85rem;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s;
}
.sp-modal-close:hover { background: var(--surface-muted); }

.sp-modal-body {
  display: grid;
  gap: 14px;
  padding: 20px 24px;
}

.sp-modal-actions {
  display: flex;
  gap: 8px;
  padding-top: 4px;
}

/* ── Form fields ── */
.sp-field {
  display: grid;
  gap: 6px;
}

.sp-field span {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--muted);
}

.sp-field em {
  font-weight: 400;
  color: var(--border-strong);
}

.sp-field input,
.sp-field textarea {
  min-height: 40px;
  padding: 10px 13px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface-strong);
  font: inherit;
  font-size: 0.88rem;
  color: var(--text);
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.sp-field input:focus,
.sp-field textarea:focus {
  border-color: #3b82f6;
  background: var(--surface);
  box-shadow: 0 0 0 3px rgba(59,130,246,0.12);
}

.sp-field textarea { min-height: 110px; resize: vertical; }

/* ── Responsive ── */
@media (max-width: 860px) {
  .sp-layout { grid-template-columns: 1fr; }
  .sp-sidebar { grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
}

@media (max-width: 640px) {
  .sp-hero-body { flex-direction: column; gap: 12px; padding: 0 18px 20px; }
  .sp-avatar-ring { width: 72px; height: 72px; margin-top: -36px; }
  .sp-identity { padding-top: 0; }
  .sp-edu-grid { grid-template-columns: 1fr; }
  .sp-sidebar { grid-template-columns: 1fr; }
  .sp-modal-header, .sp-modal-body { padding: 16px 18px; }
}

:global(.dark) .sp-avatar-wrap { border-color: var(--surface); }
:global(.dark) .sp-chip-green { background: #091a0d; color: #4ade80; }
:global(.dark) .sp-chip-blue  { background: #0f1e38; color: #60a5fa; }
:global(.dark) .sp-action-card { background: #0a1020; border-color: var(--accent-soft); }
:global(.dark) .sp-status--error { border-color: #7f1d1d; background: #1f0808; color: #fca5a5; }
:global(.dark) .sp-resume-row-link { background: var(--surface-strong); border-color: var(--border); }
:global(.dark) .sp-resume-row-link:hover { background: var(--surface); border-color: var(--accent); }
</style>
