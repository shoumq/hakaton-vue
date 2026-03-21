import { computed, reactive } from 'vue'

import {
  createContactRequest,
  fetchContactRequests,
  fetchContacts,
  getApiErrorMessage,
  updateContactRequest,
} from '@/shared/api'
import type { ContactDto, ContactRequestStatus } from '@/shared/api'

export type ApplicantConnectionRelation =
  | 'self'
  | 'none'
  | 'contact'
  | 'incoming_pending'
  | 'outgoing_pending'
  | 'rejected'
  | 'cancelled'

export interface ContactPersonCard {
  id: string
  userId: string
  displayName: string
  avatarUrl?: string
  headline?: string
  message?: string
  createdAt?: string
}

export interface ContactRequestCard extends ContactPersonCard {
  status: ContactRequestStatus
  direction: 'incoming' | 'outgoing'
}

interface ContactSummaryCandidate {
  userId?: string
  displayName?: string
  avatarUrl?: string
  headline?: string
}

interface NetworkState {
  currentUserId: string
  initialized: boolean
  isLoading: boolean
  errorMessage: string
  contacts: ContactPersonCard[]
  requests: ContactRequestCard[]
  sendingByUserId: Record<string, boolean>
  updatingByRequestId: Record<string, boolean>
}

const state = reactive<NetworkState>({
  currentUserId: '',
  initialized: false,
  isLoading: false,
  errorMessage: '',
  contacts: [],
  requests: [],
  sendingByUserId: {},
  updatingByRequestId: {},
})

function asRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function readString(source: Record<string, unknown> | null, keys: string[]) {
  if (!source) {
    return ''
  }

  for (const key of keys) {
    const value = source[key]

    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return ''
}

function readBoolean(source: Record<string, unknown> | null, keys: string[]) {
  if (!source) {
    return undefined
  }

  for (const key of keys) {
    const value = source[key]

    if (typeof value === 'boolean') {
      return value
    }
  }

  return undefined
}

function readObject(source: Record<string, unknown> | null, keys: string[]) {
  if (!source) {
    return null
  }

  for (const key of keys) {
    const nested = asRecord(source[key])

    if (nested) {
      return nested
    }
  }

  return null
}

function buildHeadline(source: Record<string, unknown> | null) {
  if (!source) {
    return ''
  }

  const explicitTitle = readString(source, ['title'])

  if (explicitTitle) {
    return explicitTitle
  }

  return [readString(source, ['university_name']), readString(source, ['faculty']), readString(source, ['specialization'])]
    .filter(Boolean)
    .join(' • ')
}

function normalizeSummary(source: Record<string, unknown> | null): ContactSummaryCandidate | null {
  if (!source) {
    return null
  }

  const userId = readString(source, ['user_id', 'id'])
  const displayName = readString(source, ['display_name'])
  const avatarUrl = readString(source, ['avatar_url'])
  const headline = buildHeadline(source)

  if (!userId && !displayName && !avatarUrl && !headline) {
    return null
  }

  return {
    userId,
    displayName,
    avatarUrl,
    headline,
  }
}

function sortByRecent<T extends { createdAt?: string }>(items: T[]) {
  return [...items].sort((left, right) => {
    return new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime()
  })
}

function normalizeContact(rawItem: ContactDto): ContactPersonCard {
  const raw = rawItem as unknown as Record<string, unknown>
  const counterpart =
    normalizeSummary(readObject(raw, ['contact_user', 'user', 'requester', 'receiver'])) ?? {}

  const userId =
    readString(raw, ['user_id', 'contact_user_id', 'other_user_id', 'participant_user_id']) ||
    counterpart.userId ||
    rawItem.id
  const displayName =
    readString(raw, ['display_name', 'contact_display_name', 'name']) ||
    counterpart.displayName ||
    userId ||
    'Контакт'

  return {
    id: String(rawItem.id || userId),
    userId,
    displayName,
    avatarUrl: readString(raw, ['avatar_url']) || counterpart.avatarUrl,
    headline: readString(raw, ['title']) || counterpart.headline,
    message: readString(raw, ['message']),
    createdAt: readString(raw, ['created_at', 'updated_at']),
  }
}

function normalizeRequest(rawItem: ContactDto, currentUserId: string): ContactRequestCard {
  const raw = rawItem as unknown as Record<string, unknown>
  const requester = normalizeSummary(readObject(raw, ['requester'])) ?? null
  const receiver = normalizeSummary(readObject(raw, ['receiver'])) ?? null
  const fallbackSummary =
    normalizeSummary(readObject(raw, ['contact_user', 'user'])) ?? requester ?? receiver ?? {}

  const requesterUserId =
    readString(raw, ['requester_user_id', 'from_user_id']) || requester?.userId || ''
  const receiverUserId =
    readString(raw, ['receiver_user_id', 'to_user_id']) || receiver?.userId || ''
  const explicitDirection = readString(raw, ['direction'])
  const incomingFlag = readBoolean(raw, ['is_incoming'])

  const direction: 'incoming' | 'outgoing' =
    explicitDirection === 'incoming' || explicitDirection === 'outgoing'
      ? explicitDirection
      : incomingFlag === true
        ? 'incoming'
        : incomingFlag === false
          ? 'outgoing'
          : requesterUserId && currentUserId && requesterUserId === currentUserId
            ? 'outgoing'
            : receiverUserId && currentUserId && receiverUserId === currentUserId
              ? 'incoming'
              : 'outgoing'

  const counterpart = direction === 'incoming' ? requester ?? fallbackSummary : receiver ?? fallbackSummary
  const userId =
    (direction === 'incoming' ? requesterUserId : receiverUserId) ||
    counterpart.userId ||
    readString(raw, ['user_id']) ||
    String(rawItem.id)
  const displayName =
    counterpart.displayName ||
    readString(raw, ['display_name', 'name']) ||
    userId ||
    'Пользователь'
  const statusValue = readString(raw, ['status'])
  const status: ContactRequestStatus =
    statusValue === 'accepted' ||
    statusValue === 'rejected' ||
    statusValue === 'cancelled' ||
    statusValue === 'pending'
      ? statusValue
      : 'pending'

  return {
    id: String(rawItem.id || userId),
    userId,
    displayName,
    avatarUrl: counterpart.avatarUrl || readString(raw, ['avatar_url']),
    headline: counterpart.headline || readString(raw, ['title']),
    message: readString(raw, ['message']),
    createdAt: readString(raw, ['created_at', 'updated_at']),
    status,
    direction,
  }
}

function replaceRequestItem(item: ContactRequestCard) {
  const next = state.requests.filter((request) => request.id !== item.id)
  next.unshift(item)
  state.requests = sortByRecent(next)
}

function upsertContactItem(item: ContactPersonCard) {
  if (!item.userId) {
    return
  }

  const next = state.contacts.filter((contact) => contact.userId !== item.userId)
  next.unshift(item)
  state.contacts = sortByRecent(next)
}

function removeTemporaryRequest(tempId: string) {
  state.requests = state.requests.filter((request) => request.id !== tempId)
}

function setSending(userId: string, value: boolean) {
  if (value) {
    state.sendingByUserId[userId] = true
    return
  }

  delete state.sendingByUserId[userId]
}

function setUpdating(requestId: string, value: boolean) {
  if (value) {
    state.updatingByRequestId[requestId] = true
    return
  }

  delete state.updatingByRequestId[requestId]
}

async function loadNetwork(currentUserId: string, force = false) {
  if (!currentUserId) {
    state.currentUserId = ''
    state.initialized = false
    state.contacts = []
    state.requests = []
    return
  }

  if (!force && state.initialized && state.currentUserId === currentUserId) {
    return
  }

  state.currentUserId = currentUserId
  state.isLoading = true
  state.errorMessage = ''

  try {
    const [contactsRaw, requestsRaw] = await Promise.all([fetchContacts(), fetchContactRequests()])

    state.contacts = sortByRecent(contactsRaw.map((item) => normalizeContact(item)))
    state.requests = sortByRecent(requestsRaw.map((item) => normalizeRequest(item, currentUserId)))
    state.initialized = true
  } catch (error) {
    state.errorMessage = getApiErrorMessage(error, 'Не удалось загрузить сеть контактов.')
    throw error
  } finally {
    state.isLoading = false
  }
}

function getRequestForUserId(userId: string) {
  return state.requests.find((request) => request.userId === userId) ?? null
}

function getRelationForUserId(userId: string): ApplicantConnectionRelation {
  if (!userId) {
    return 'none'
  }

  if (state.currentUserId && userId === state.currentUserId) {
    return 'self'
  }

  if (state.contacts.some((contact) => contact.userId === userId)) {
    return 'contact'
  }

  const request = getRequestForUserId(userId)

  if (!request) {
    return 'none'
  }

  if (request.status === 'accepted') {
    return 'contact'
  }

  if (request.status === 'rejected') {
    return 'rejected'
  }

  if (request.status === 'cancelled') {
    return 'cancelled'
  }

  return request.direction === 'incoming' ? 'incoming_pending' : 'outgoing_pending'
}

async function sendRequest(toUserId: string, message?: string) {
  const normalizedUserId = toUserId.trim()

  if (!normalizedUserId) {
    throw new Error('Укажите `to_user_id` для отправки запроса.')
  }

  if (normalizedUserId === state.currentUserId) {
    throw new Error('Нельзя отправить запрос самому себе.')
  }

  const relation = getRelationForUserId(normalizedUserId)

  if (relation === 'contact' || relation === 'outgoing_pending') {
    return
  }

  const tempId = `temp-request-${Date.now()}`
  const previousRequests = [...state.requests]
  const optimisticItem: ContactRequestCard = {
    id: tempId,
    userId: normalizedUserId,
    displayName: normalizedUserId,
    message: message?.trim() || '',
    status: 'pending',
    direction: 'outgoing',
    createdAt: new Date().toISOString(),
  }

  setSending(normalizedUserId, true)
  state.requests = sortByRecent([optimisticItem, ...state.requests])

  try {
    const created = await createContactRequest({
      to_user_id: normalizedUserId,
      message: message?.trim() || undefined,
    })

    removeTemporaryRequest(tempId)
    replaceRequestItem(normalizeRequest(created, state.currentUserId))
  } catch (error) {
    state.requests = previousRequests
    throw error
  } finally {
    setSending(normalizedUserId, false)
  }
}

async function changeRequestStatus(requestId: string, status: ContactRequestStatus) {
  const existing = state.requests.find((request) => request.id === requestId)

  if (!existing) {
    throw new Error('Запрос в контакты не найден.')
  }

  const previousRequests = [...state.requests]
  const previousContacts = [...state.contacts]

  setUpdating(requestId, true)
  replaceRequestItem({
    ...existing,
    status,
  })

  if (status === 'accepted') {
    upsertContactItem({
      id: existing.id,
      userId: existing.userId,
      displayName: existing.displayName,
      avatarUrl: existing.avatarUrl,
      headline: existing.headline,
      message: existing.message,
      createdAt: existing.createdAt,
    })
  }

  try {
    const updated = await updateContactRequest(requestId, { status })
    const normalized = normalizeRequest(updated, state.currentUserId)

    replaceRequestItem(normalized)

    if (normalized.status === 'accepted') {
      upsertContactItem({
        id: normalized.id,
        userId: normalized.userId,
        displayName: normalized.displayName,
        avatarUrl: normalized.avatarUrl,
        headline: normalized.headline,
        message: normalized.message,
        createdAt: normalized.createdAt,
      })
    }
  } catch (error) {
    state.requests = previousRequests
    state.contacts = previousContacts
    throw error
  } finally {
    setUpdating(requestId, false)
  }
}

export function useApplicantNetwork() {
  return {
    contacts: computed(() => state.contacts),
    requests: computed(() => state.requests),
    isLoading: computed(() => state.isLoading),
    errorMessage: computed(() => state.errorMessage),
    sendingByUserId: computed(() => state.sendingByUserId),
    updatingByRequestId: computed(() => state.updatingByRequestId),
    loadNetwork,
    reloadNetwork: async () => loadNetwork(state.currentUserId, true),
    getRelationForUserId,
    getRequestForUserId,
    sendRequest,
    acceptRequest: async (requestId: string) => changeRequestStatus(requestId, 'accepted'),
    rejectRequest: async (requestId: string) => changeRequestStatus(requestId, 'rejected'),
    cancelRequest: async (requestId: string) => changeRequestStatus(requestId, 'cancelled'),
  }
}
