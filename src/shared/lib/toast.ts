type ToastTone = 'success' | 'error' | 'info'

interface ToastOptions {
  duration?: number
}

const toneStyles: Record<ToastTone, string> = {
  success: 'linear-gradient(135deg, #1f9d67 0%, #157347 100%)',
  error: 'linear-gradient(135deg, #d65a4b 0%, #b42318 100%)',
  info: 'linear-gradient(135deg, #3560df 0%, #17338f 100%)',
}

const VIEWPORT_CLASS = 'app-toast-viewport'

function ensureViewport() {
  const existing = document.querySelector<HTMLElement>(`.${VIEWPORT_CLASS}`)

  if (existing) {
    return existing
  }

  const viewport = document.createElement('div')
  viewport.className = VIEWPORT_CLASS
  document.body.appendChild(viewport)
  return viewport
}

function showToast(message: string, tone: ToastTone, options: ToastOptions = {}) {
  if (typeof document === 'undefined') {
    return
  }

  const viewport = ensureViewport()
  const toast = document.createElement('div')
  toast.className = `app-toast app-toast--${tone}`
  toast.style.background = toneStyles[tone]

  const text = document.createElement('div')
  text.className = 'app-toast__text'
  text.textContent = message

  const close = document.createElement('button')
  close.className = 'app-toast__close'
  close.type = 'button'
  close.setAttribute('aria-label', 'Закрыть уведомление')
  close.textContent = '×'

  const removeToast = () => {
    toast.classList.add('app-toast--closing')
    window.setTimeout(() => toast.remove(), 180)
  }

  close.addEventListener('click', removeToast)

  toast.append(text, close)
  viewport.appendChild(toast)

  window.setTimeout(removeToast, options.duration ?? 3500)
}

export function showSuccessToast(message: string, options?: ToastOptions) {
  showToast(message, 'success', options)
}

export function showErrorToast(message: string, options?: ToastOptions) {
  showToast(message, 'error', options)
}

export function showInfoToast(message: string, options?: ToastOptions) {
  showToast(message, 'info', options)
}
