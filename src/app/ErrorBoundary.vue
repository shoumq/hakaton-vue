<script setup lang="ts">
import { onErrorCaptured, ref } from 'vue'

const error = ref<Error | null>(null)

onErrorCaptured((err) => {
  error.value = err instanceof Error ? err : new Error(String(err))
  return false // stop propagation
})

function retry() {
  error.value = null
}
</script>

<template>
  <div v-if="error" class="eb-root">
    <div class="eb-card">
      <div class="eb-icon">⚠️</div>
      <h2 class="eb-title">Что-то пошло не так</h2>
      <p class="eb-message">{{ error.message }}</p>
      <div class="eb-actions">
        <button class="eb-btn" type="button" @click="retry">Попробовать снова</button>
        <a href="/" class="eb-link">На главную</a>
      </div>
    </div>
  </div>
  <slot v-else />
</template>

<style scoped>
.eb-root {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--bg);
}

.eb-card {
  display: grid;
  gap: 12px;
  justify-items: center;
  text-align: center;
  max-width: 420px;
  padding: 40px 32px;
  border: 1px solid var(--border);
  border-radius: 20px;
  background: var(--surface);
  box-shadow: var(--shadow);
}

.eb-icon { font-size: 2.4rem; }

.eb-title {
  margin: 0;
  font-family: var(--font-heading);
  font-size: 1.2rem;
  color: var(--text);
}

.eb-message {
  margin: 0;
  font-size: 0.86rem;
  color: var(--muted);
  line-height: 1.5;
  word-break: break-word;
}

.eb-actions {
  display: flex;
  gap: 10px;
  margin-top: 6px;
}

.eb-btn {
  height: 38px;
  padding: 0 20px;
  border-radius: 10px;
  border: none;
  background: var(--accent);
  color: #fff;
  font: inherit;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}
.eb-btn:hover { background: var(--accent-strong); }

.eb-link {
  display: inline-flex;
  align-items: center;
  height: 38px;
  padding: 0 20px;
  border-radius: 10px;
  border: 1px solid var(--border);
  color: var(--muted);
  font-size: 0.875rem;
  text-decoration: none;
  transition: border-color 0.15s;
}
.eb-link:hover { border-color: var(--border-strong); }
</style>
