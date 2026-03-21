<script setup lang="ts">
import type { ContactRequestCard } from '@/features/contacts/model/network'
import ConnectionStatusBadge from '@/features/contacts/ui/ConnectionStatusBadge.vue'

defineProps<{
  items: ContactRequestCard[]
  emptyTitle: string
  emptyText: string
}>()
</script>

<template>
  <div class="requests-list">
    <article v-if="!items.length" class="network-card empty-card">
      <strong>{{ emptyTitle }}</strong>
      <p>{{ emptyText }}</p>
    </article>

    <article v-for="item in items" :key="item.id" class="network-card">
      <div class="card-topline">
        <span class="direction-label">{{ item.direction === 'incoming' ? 'Входящий' : 'Исходящий' }}</span>
        <ConnectionStatusBadge :status="item.status" />
      </div>

      <div class="card-head">
        <div class="avatar-shell">
          <img v-if="item.avatarUrl" :src="item.avatarUrl" :alt="item.displayName" class="avatar-image" />
          <span v-else class="avatar-fallback">{{ item.displayName.slice(0, 2).toUpperCase() }}</span>
        </div>
        <div class="card-copy">
          <strong>{{ item.displayName }}</strong>
          <span>{{ item.headline || item.userId }}</span>
          <p v-if="item.message">{{ item.message }}</p>
        </div>
      </div>

      <div class="card-actions">
        <slot name="actions" :item="item" />
      </div>
    </article>
  </div>
</template>

<style scoped>
.requests-list {
  display: grid;
  gap: 12px;
}

.network-card {
  display: grid;
  gap: 12px;
  padding: 14px;
  border: 1px solid rgba(18, 38, 63, 0.08);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.9);
}

.empty-card p {
  margin: 0;
  color: #5f6b7a;
}

.card-topline,
.card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
}

.direction-label {
  color: #627087;
  font-size: 0.76rem;
  font-weight: 700;
  text-transform: uppercase;
}

.card-head {
  display: flex;
  gap: 12px;
  align-items: start;
}

.avatar-shell {
  width: 48px;
  height: 48px;
  display: grid;
  place-items: center;
  overflow: hidden;
  border: 1px solid #d7dee7;
  border-radius: 50%;
  background: #eef3f8;
}

.avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-fallback {
  color: #24456b;
  font-size: 0.82rem;
  font-weight: 700;
}

.card-copy {
  display: grid;
  gap: 4px;
}

.card-copy strong {
  color: #162033;
}

.card-copy span,
.card-copy p {
  margin: 0;
  color: #5f6b7a;
  line-height: 1.45;
}
</style>
