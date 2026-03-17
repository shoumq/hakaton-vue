import { computed, reactive } from 'vue'

import type { PlatformUser, UserRole } from '@/entities/user/model/types'
import {
  fetchCurrentUser,
  getPlatformUserFromCurrentUser,
  getRoleFromCurrentUser,
  login as loginRequest,
  loginCurator,
  register as registerRequest,
  setApiAuthToken,
} from '@/shared/api'
import { getApiErrorMessage } from '@/shared/api/base'
import { loadFromStorage, saveToStorage } from '@/shared/lib/storage'

interface SessionState {
  currentUser: PlatformUser | null
  token: string | null
  expiresAt: string | null
  initialized: boolean
  loading: boolean
}

const STORAGE_KEY = 'career-platform-session'

const initialSession = loadFromStorage<{ token: string | null; expiresAt: string | null }>(STORAGE_KEY, {
  token: null,
  expiresAt: null,
})

const state = reactive<SessionState>({
  currentUser: null,
  token: initialSession.token,
  expiresAt: initialSession.expiresAt,
  initialized: false,
  loading: false,
})

if (state.token) {
  setApiAuthToken(state.token)
}

function persist() {
  saveToStorage(STORAGE_KEY, {
    token: state.token,
    expiresAt: state.expiresAt,
  })
}

function setSession(user: PlatformUser | null, token: string | null, expiresAt: string | null) {
  state.currentUser = user
  state.token = token
  state.expiresAt = expiresAt
  setApiAuthToken(token)
  persist()
}

export function useSession() {
  const role = computed<UserRole>(() => state.currentUser?.role ?? 'guest')

  async function restoreSession() {
    if (state.initialized) {
      return
    }

    if (!state.token) {
      state.initialized = true
      return
    }

    try {
      const payload = await fetchCurrentUser()

      state.currentUser = getPlatformUserFromCurrentUser(payload)
    } catch {
      setSession(null, null, null)
    } finally {
      state.initialized = true
    }
  }

  async function login(email: string, password: string, entrypoint: 'user' | 'curator' = 'user') {
    state.loading = true

    try {
      const payload =
        entrypoint === 'curator'
          ? await loginCurator(email.trim(), password)
          : await loginRequest(email.trim(), password)

      setSession(payload.user, payload.token, payload.expiresAt)

      return { ok: true as const, user: payload.user }
    } catch (error) {
      return {
        ok: false as const,
        message: getApiErrorMessage(error, 'Не удалось выполнить вход.'),
      }
    } finally {
      state.loading = false
      state.initialized = true
    }
  }

  async function register(payload: {
    email: string
    password: string
    display_name: string
    role: 'student' | 'employer'
    company_name?: string
  }) {
    state.loading = true

    try {
      const result = await registerRequest(payload)
      setSession(result.user, result.token, result.expiresAt)

      return { ok: true as const, user: result.user }
    } catch (error) {
      return {
        ok: false as const,
        message: getApiErrorMessage(error, 'Не удалось завершить регистрацию.'),
      }
    } finally {
      state.loading = false
      state.initialized = true
    }
  }

  function logout() {
    state.initialized = true
    setSession(null, null, null)
  }

  function patchCurrentUser(patch: Partial<PlatformUser>) {
    if (!state.currentUser) {
      return
    }

    state.currentUser = {
      ...state.currentUser,
      ...patch,
    }
  }

  return {
    currentUser: computed(() => state.currentUser),
    token: computed(() => state.token),
    role,
    initialized: computed(() => state.initialized),
    isLoading: computed(() => state.loading),
    isAuthenticated: computed(() => Boolean(state.currentUser)),
    restoreSession,
    login,
    register,
    logout,
    patchCurrentUser,
    refreshCurrentUser: async () => {
      const payload = await fetchCurrentUser()
      state.currentUser = getPlatformUserFromCurrentUser(payload)

      return {
        role: getRoleFromCurrentUser(payload),
        payload,
      }
    },
  }
}
