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
    <div v-if="!items.length" class="crl-empty">
      <strong>{{ emptyTitle }}</strong>
      <p>{{ emptyText }}</p>
    </div>

    <article v-for="item in items" :key="item.id" class="crl-card" :class="`crl-card--${item.direction}`">
      <div class="crl-topline">
        <span class="crl-direction-pill" :class="`crl-direction-pill--${item.direction}`">
          {{ item.direction === 'incoming' ? '↓ Входящий' : '↑ Исходящий' }}
        </span>
        <ConnectionStatusBadge :status="item.status" />
      </div>
      <div class="crl-person">
        <div class="crl-avatar">
          <img v-if="item.avatarUrl" :src="item.avatarUrl" :alt="item.displayName" class="crl-avatar-img" />
          <span v-else class="crl-avatar-fallback">{{ item.displayName.slice(0, 2).toUpperCase() }}</span>
        </div>
        <div class="crl-copy">
          <strong>{{ item.displayName }}</strong>
          <span v-if="item.headline">{{ item.headline }}</span>
          <p v-if="item.message" class="crl-message">«{{ item.message }}»</p>
        </div>
      </div>
      <div class="crl-actions">
        <slot name="actions" :item="item" />
      </div>
    </article>
  </div>
</template>

<style scoped>
.requests-list {
  display: grid;
  gap: 8px;
}

.crl-empty {
  padding: 20px;
  border: 1.5px dashed #e2e8f0;
  border-radius: 12px;
  display: grid;
  gap: 4px;
  color: var(--muted);
}

.crl-empty strong {
  font-size: 0.88rem;
  color: var(--text);
}

.crl-empty p {
  margin: 0;
  font-size: 0.8rem;
  color: var(--border-strong);
}

.crl-card {
  display: grid;
  gap: 8px;
  padding: 12px 14px;
  border: 1px solid #f1f5f9;
  border-left-width: 3px;
  border-radius: 12px;
  background: var(--surface-strong);
  transition: border-color 0.15s, background 0.15s;
}

.crl-card:hover { background: var(--surface); }

.crl-card--incoming {
  border-left-color: #2563eb;
}

.crl-card--outgoing {
  border-left-color: var(--border-strong);
}

.crl-topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.crl-direction-pill {
  display: inline-flex;
  align-items: center;
  height: 18px;
  padding: 0 8px;
  border-radius: 5px;
  font-size: 0.67rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.crl-direction-pill--incoming {
  background: #eff6ff;
  color: #1d4ed8;
}

.crl-direction-pill--outgoing {
  background: var(--surface-strong);
  color: var(--muted);
}

.crl-person {
  display: flex;
  gap: 10px;
  align-items: center;
}

.crl-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
}

.crl-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.crl-avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
  color: #fff;
  font-size: 0.68rem;
  font-weight: 700;
}

.crl-copy {
  display: grid;
  gap: 1px;
  flex: 1;
  min-width: 0;
}

.crl-copy strong {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.crl-copy span {
  font-size: 0.76rem;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.crl-message {
  margin: 0;
  font-size: 0.76rem;
  color: #7c8ea6;
  font-style: italic;
}

.crl-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  align-items: center;
}
</style>

<style scoped>
:global(.dark) .crl-card--incoming { border-left-color: var(--accent); }
:global(.dark) .crl-direction-pill--incoming { background: #0f1e38; color: #60a5fa; }
:global(.dark) .crl-copy strong { color: var(--text); }
:global(.dark) .crl-copy span, :global(.dark) .crl-message { color: var(--muted); }
</style>
