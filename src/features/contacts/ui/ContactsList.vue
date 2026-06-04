<script setup lang="ts">
import { RouterLink } from 'vue-router'
import type { ContactPersonCard } from '@/features/contacts/model/network'

defineProps<{
  items: ContactPersonCard[]
  emptyTitle: string
  emptyText: string
  getItemLink?: (item: ContactPersonCard) => string
}>()
</script>

<template>
  <div class="contacts-list">
    <div v-if="!items.length" class="cl-empty">
      <strong>{{ emptyTitle }}</strong>
      <p>{{ emptyText }}</p>
    </div>

    <component
      :is="getItemLink ? RouterLink : 'article'"
      v-for="item in items"
      :key="item.id"
      class="cl-card"
      v-bind="getItemLink ? { to: getItemLink(item) } : {}"
    >
      <div class="cl-avatar">
        <img v-if="item.avatarUrl" :src="item.avatarUrl" :alt="item.displayName" class="cl-avatar-img" />
        <span v-else class="cl-avatar-fallback">{{ item.displayName.slice(0, 2).toUpperCase() }}</span>
      </div>
      <div class="cl-copy">
        <strong>{{ item.displayName }}</strong>
        <span v-if="item.headline">{{ item.headline }}</span>
        <p v-if="item.message">{{ item.message }}</p>
      </div>
      <div v-if="$slots.actions" class="cl-actions">
        <slot name="actions" :item="item" />
      </div>
    </component>
  </div>
</template>

<style scoped>
.contacts-list {
  display: grid;
  gap: 8px;
}

.cl-empty {
  padding: 20px;
  border: 1.5px dashed #e2e8f0;
  border-radius: 12px;
  display: grid;
  gap: 4px;
  color: var(--muted);
}

.cl-empty strong {
  font-size: 0.88rem;
  color: var(--text);
}

.cl-empty p {
  margin: 0;
  font-size: 0.8rem;
  color: var(--border-strong);
}

.cl-card {
  display: grid;
  grid-template-columns: 36px minmax(0,1fr);
  grid-template-rows: auto auto;
  gap: 0 10px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface-strong);
  text-decoration: none;
  color: inherit;
  transition: border-color 0.15s, background 0.15s;
}

.cl-card:hover {
  border-color: var(--border);
  background: var(--surface);
}

.cl-avatar {
  grid-row: 1 / 3;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  align-self: center;
}

.cl-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cl-avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
  color: #fff;
  font-size: 0.72rem;
  font-weight: 700;
}

.cl-copy {
  display: grid;
  gap: 1px;
  min-width: 0;
  align-self: center;
}

.cl-copy strong {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cl-copy span,
.cl-copy p {
  margin: 0;
  font-size: 0.76rem;
  color: var(--muted);
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cl-actions {
  grid-column: 2;
  display: flex;
  gap: 6px;
  align-items: center;
  margin-top: 6px;
}
</style>

<style scoped>
:global(.dark) .cl-card { background: var(--surface-strong); border-color: var(--border); }
:global(.dark) .cl-card:hover { background: var(--surface); border-color: var(--border-strong); }
:global(.dark) .cl-copy strong { color: var(--text); }
:global(.dark) .cl-copy span { color: var(--muted); }
</style>
