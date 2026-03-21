import { createMyChat, fetchMyChats } from '@/shared/api'
import type {
  ChatConversationDto,
  ChatMessageDto,
  NotificationDto,
} from '@/shared/api'

export type ConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'

export interface ChatSocketOptions {
  token: string
  conversationId: string
  apiBaseHttp?: string
  wsBase?: string
  onMessage?: (message: ChatMessageDto) => void
  onStateChange?: (state: ConnectionState) => void
  onError?: (error: Event | Error) => void
  reconnect?: boolean
}

export async function startChatFromNotification(notification: NotificationDto): Promise<ChatConversationDto> {
  if (!notification.employer_user_id) {
    throw new Error('В уведомлении нет employer_user_id для создания чата.')
  }

  return createMyChat({
    participant_user_id: notification.employer_user_id,
    opportunity_id: notification.related_entity_id || undefined,
  })
}

export async function ensureChatWithUser(params: {
  participantUserId: string
  opportunityId?: string
  existingChats?: ChatConversationDto[]
}) {
  const chats = params.existingChats ?? (await fetchMyChats())
  const directMatch = chats.find((chat) => {
    if (chat.participant_user_id !== params.participantUserId) {
      return false
    }

    if (!params.opportunityId) {
      return true
    }

    return chat.opportunity_id === params.opportunityId || !chat.opportunity_id
  })

  if (directMatch) {
    return directMatch
  }

  return createMyChat({
    participant_user_id: params.participantUserId,
    opportunity_id: params.opportunityId,
  })
}

function stripTrailingSlashes(value: string) {
  return value.replace(/\/+$/, '')
}

export function normalizeHttpBase(apiBaseHttp?: string) {
  const fromArg = apiBaseHttp?.trim()

  if (fromArg) {
    return stripTrailingSlashes(fromArg)
  }

  const fromEnv = import.meta.env.VITE_API_BASE_URL?.trim()

  if (fromEnv && fromEnv.startsWith('http')) {
    return stripTrailingSlashes(fromEnv)
  }

  return 'http://localhost:8081'
}

export function buildChatWsUrl(
  token: string,
  conversationId: string,
  opts?: { apiBaseHttp?: string; wsBase?: string },
) {
  if (opts?.wsBase) {
    const base = stripTrailingSlashes(opts.wsBase)
    const normalizedBase = base.endsWith('/api') ? base : `${base}/api`
    const url = `${normalizedBase}/ws/chat?token=${encodeURIComponent(token)}&conversation_id=${encodeURIComponent(conversationId)}`

    if (import.meta.env.DEV) {
      console.debug('[chat-ws] connecting to', url)
    }

    return url
  }

  const httpBase = normalizeHttpBase(opts?.apiBaseHttp)
  const url = new URL(httpBase)
  const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  const basePath = stripTrailingSlashes(url.pathname || '')
  const apiPath = basePath.endsWith('/api') ? basePath : `${basePath}/api`
  const wsUrl = `${protocol}//${url.host}${apiPath}/ws/chat?token=${encodeURIComponent(token)}&conversation_id=${encodeURIComponent(conversationId)}`

  if (import.meta.env.DEV) {
    console.debug('[chat-ws] connecting to', wsUrl)
  }

  return wsUrl
}

function isLikelyViteHmrPayload(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return false
  }

  const candidate = payload as Record<string, unknown>

  return candidate.type === 'connected' || candidate.type === 'ping'
}

function normalizeSocketMessage(payload: unknown, conversationId: string): ChatMessageDto | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  if (isLikelyViteHmrPayload(payload)) {
    throw new Error('WebSocket подключён к Vite HMR, а не к backend chat endpoint.')
  }

  const candidate = payload as Record<string, unknown>

  if (candidate.type === 'error') {
    throw new Error(typeof candidate.error === 'string' ? candidate.error : 'WebSocket error')
  }

  const messageCandidate =
    typeof candidate.body === 'string'
      ? candidate
      : candidate.message && typeof candidate.message === 'object'
        ? (candidate.message as Record<string, unknown>)
        : null

  if (!messageCandidate || typeof messageCandidate.body !== 'string') {
    return null
  }

  return {
    id: String(messageCandidate.id || `${Date.now()}`),
    conversation_id:
      typeof messageCandidate.conversation_id === 'string'
        ? messageCandidate.conversation_id
        : conversationId,
    sender_user_id:
      typeof messageCandidate.sender_user_id === 'string'
        ? messageCandidate.sender_user_id
        : undefined,
    sender_name:
      typeof messageCandidate.sender_name === 'string'
        ? messageCandidate.sender_name
        : undefined,
    sender_avatar_url:
      typeof messageCandidate.sender_avatar_url === 'string'
        ? messageCandidate.sender_avatar_url
        : undefined,
    body: messageCandidate.body,
    created_at:
      typeof messageCandidate.created_at === 'string'
        ? messageCandidate.created_at
        : new Date().toISOString(),
  }
}

export class ChatSocketClient {
  private readonly options: ChatSocketOptions
  private socket: WebSocket | null = null
  private manuallyClosed = false
  private reconnectAttempts = 0
  private reconnectTimer: number | null = null
  private readonly maxReconnectDelay = 5000

  constructor(options: ChatSocketOptions) {
    this.options = options
  }

  connect() {
    this.clearReconnectTimer()
    this.manuallyClosed = false
    this.setState(this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting')

    const url = buildChatWsUrl(this.options.token, this.options.conversationId, {
      apiBaseHttp: this.options.apiBaseHttp,
      wsBase: this.options.wsBase,
    })

    this.socket = new WebSocket(url)

    this.socket.onopen = () => {
      this.reconnectAttempts = 0
      this.setState('connected')
    }

    this.socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data)
        const message = normalizeSocketMessage(payload, this.options.conversationId)

        if (message) {
          this.options.onMessage?.(message)
        }
      } catch (error) {
        this.options.onError?.(error as Error)
      }
    }

    this.socket.onerror = (event) => {
      this.options.onError?.(event)
    }

    this.socket.onclose = () => {
      this.socket = null

      if (this.manuallyClosed) {
        this.setState('disconnected')
        return
      }

      if (this.options.reconnect === false) {
        this.setState('disconnected')
        return
      }

      this.setState('reconnecting')
      this.scheduleReconnect()
    }
  }

  send(body: string) {
    const trimmed = body.trim()

    if (!trimmed) {
      return false
    }

    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return false
    }

    this.socket.send(JSON.stringify({ body }))
    return true
  }

  close() {
    this.manuallyClosed = true
    this.clearReconnectTimer()
    this.socket?.close()
    this.socket = null
    this.setState('disconnected')
  }

  private scheduleReconnect() {
    this.reconnectAttempts += 1
    const delay = Math.min(1000 * this.reconnectAttempts, this.maxReconnectDelay)

    this.reconnectTimer = window.setTimeout(() => {
      if (!this.manuallyClosed) {
        this.connect()
      }
    }, delay)
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private setState(state: ConnectionState) {
    this.options.onStateChange?.(state)
  }
}
