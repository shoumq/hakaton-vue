import { computed, reactive } from 'vue'

import { saveToStorage, loadFromStorage } from '@/shared/lib/storage'

const STORAGE_KEY = 'career-platform-favorites'

const state = reactive({
  ids: loadFromStorage<string[]>(STORAGE_KEY, []),
})

function persist() {
  saveToStorage(STORAGE_KEY, state.ids)
}

export function useFavorites() {
  function toggle(id: string) {
    if (state.ids.includes(id)) {
      state.ids = state.ids.filter((item) => item !== id)
    } else {
      state.ids = [...state.ids, id]
    }

    persist()
  }

  return {
    ids: computed(() => state.ids),
    has: (id: string) => state.ids.includes(id),
    toggle,
  }
}
