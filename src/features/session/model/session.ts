import { computed, reactive } from 'vue'

import { users } from '@/entities/user/model/mock'
import type { PlatformUser, UserRole } from '@/entities/user/model/types'
import { loadFromStorage, saveToStorage } from '@/shared/lib/storage'

interface SessionState {
  currentUser: PlatformUser | null
}

const STORAGE_KEY = 'career-platform-session'

const initialUserId = loadFromStorage<string | null>(STORAGE_KEY, null)

const state = reactive<SessionState>({
  currentUser: users.find((user) => user.id === initialUserId) ?? null,
})

function persist() {
  saveToStorage(STORAGE_KEY, state.currentUser?.id ?? null)
}

export function useSession() {
  const role = computed<UserRole>(() => state.currentUser?.role ?? 'guest')

  function login(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase()
    const user = users.find(
      (candidate) =>
        candidate.email.toLowerCase() === normalizedEmail && candidate.password === password,
    )

    if (!user) {
      return { ok: false as const, message: 'Неверный email или пароль.' }
    }

    state.currentUser = user
    persist()

    return { ok: true as const, user }
  }

  function logout() {
    state.currentUser = null
    persist()
  }

  return {
    currentUser: computed(() => state.currentUser),
    role,
    isAuthenticated: computed(() => Boolean(state.currentUser)),
    login,
    logout,
  }
}
