import axios from 'axios'

const baseURL = import.meta.env.VITE_API_BASE_URL ?? '/api'

const sharedHeaders = { 'Content-Type': 'application/json' }

/** Standard API client — 15 second timeout */
export const api = axios.create({
  baseURL,
  timeout: 15_000,
  headers: sharedHeaders,
})

/** Long-running AI/analytics client — 600 second timeout */
export const aiApi = axios.create({
  baseURL,
  timeout: 600_000,
  headers: sharedHeaders,
})

export function setApiAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`
    aiApi.defaults.headers.common.Authorization = `Bearer ${token}`
    return
  }
  delete api.defaults.headers.common.Authorization
  delete aiApi.defaults.headers.common.Authorization
}

export function getApiErrorMessage(error: unknown, fallback = 'Не удалось выполнить запрос.') {
  if (axios.isAxiosError(error)) {
    const payload = error.response?.data as { error?: string; message?: string } | undefined
    return payload?.error || payload?.message || fallback
  }
  if (error instanceof Error && error.message) {
    return error.message
  }
  return fallback
}
