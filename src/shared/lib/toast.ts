import Toastify from 'toastify-js'

type ToastTone = 'success' | 'error' | 'info'

interface ToastOptions {
  duration?: number
}

const toneStyles: Record<ToastTone, string> = {
  success: 'linear-gradient(135deg, #1f9d67 0%, #157347 100%)',
  error: 'linear-gradient(135deg, #d65a4b 0%, #b42318 100%)',
  info: 'linear-gradient(135deg, #3560df 0%, #17338f 100%)',
}

function showToast(message: string, tone: ToastTone, options: ToastOptions = {}) {
  Toastify({
    text: message,
    duration: options.duration ?? 3500,
    close: true,
    gravity: 'top',
    position: 'right',
    stopOnFocus: true,
    oldestFirst: false,
    className: `app-toast app-toast--${tone}`,
    style: {
      background: toneStyles[tone],
    },
  }).showToast()
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
