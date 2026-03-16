<script setup lang="ts">
import { curatorModerationQueue, curatorProfile } from '@/entities/opportunity/model/mock'
</script>

<template>
  <main class="page-shell">
    <section class="dashboard">
      <div class="dashboard-hero">
        <div>
          <p class="eyebrow">Кабинет куратора</p>
          <h1>{{ curatorProfile.displayName }}</h1>
          <p class="hero-copy">
            Куратор модерирует карточки возможностей, подтверждает компании и управляет качеством данных
            на платформе.
          </p>
        </div>
        <div class="hero-panel">
          <strong>{{ curatorProfile.queueSize }} задач в очереди</strong>
          <span v-for="permission in curatorProfile.permissions" :key="permission">{{ permission }}</span>
        </div>
      </div>

      <section class="dashboard-grid">
        <article class="section-card">
          <h2>Администрирование кураторов</h2>
          <p>
            Только администратор может создавать новых кураторов. Для этого в кабинете предусмотрен отдельный
            сценарий выдачи роли и базовых прав на модерацию.
          </p>
        </article>

        <article class="section-card">
          <h2>Эффективная модерация</h2>
          <p>
            Очередь строится по приоритету и типу сущности: сначала верификация компаний, затем публикация
            возможностей, затем ревизия профилей. Это быстрее снижает риск недостоверного контента.
          </p>
        </article>
      </section>

      <section class="dashboard-section">
        <h2>Очередь модерации</h2>
        <div class="queue-list">
          <div v-for="item in curatorModerationQueue" :key="item.id" class="queue-card">
            <strong>{{ item.target }}</strong>
            <span>Сущность: {{ item.entity }}</span>
            <span>Приоритет: {{ item.priority }}</span>
            <p>{{ item.action }}</p>
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
.queue-list {
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
  grid-template-columns: minmax(0, 1fr) 380px;
  gap: 20px;
}

.hero-panel,
.queue-card {
  display: grid;
  gap: 8px;
  padding: 18px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface-strong);
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
.hero-panel span,
.queue-card span,
.queue-card p {
  margin: 0;
  color: var(--muted);
  line-height: 1.6;
}

.dashboard-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

@media (max-width: 900px) {
  .dashboard-hero,
  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}
</style>
