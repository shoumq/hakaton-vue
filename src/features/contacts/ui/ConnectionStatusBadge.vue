<script setup lang="ts">
defineProps<{
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled'
}>()

const labels = {
  pending: 'pending',
  accepted: 'accepted',
  rejected: 'rejected',
  cancelled: 'cancelled',
} as const
</script>

<template>
  <span class="status-badge" :class="`status-${status}`">{{ labels[status] }}</span>
</template>

<style scoped>
.status-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 26px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 0.76rem;
  font-weight: 700;
  text-transform: capitalize;
}

.status-pending {
  background: rgba(41, 82, 204, 0.08);
  color: #1e3fa0;
}

.status-accepted {
  background: rgba(25, 135, 84, 0.12);
  color: #198754;
}

.status-rejected {
  background: rgba(196, 69, 54, 0.12);
  color: #c44536;
}

.status-cancelled {
  background: rgba(95, 107, 122, 0.16);
  color: #5f6b7a;
}
</style>
