declare module 'toastify-js' {
  interface ToastifyOffsetValue {
    x?: number | string
    y?: number | string
  }

  interface ToastifyOptions {
    text?: string
    node?: HTMLElement
    duration?: number
    selector?: string | HTMLElement | ShadowRoot
    destination?: string
    newWindow?: boolean
    close?: boolean
    gravity?: 'top' | 'bottom'
    position?: 'left' | 'center' | 'right'
    backgroundColor?: string
    avatar?: string
    className?: string
    stopOnFocus?: boolean
    callback?: () => void
    onClick?: () => void
    offset?: ToastifyOffsetValue
    escapeMarkup?: boolean
    style?: Partial<CSSStyleDeclaration>
    ariaLive?: 'polite' | 'assertive' | 'off'
    oldestFirst?: boolean
  }

  interface ToastifyInstance {
    showToast(): void
    hideToast(): void
  }

  export default function Toastify(options?: ToastifyOptions): ToastifyInstance
}
