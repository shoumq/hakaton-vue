export interface MapLibreMarkerLike {
  remove(): void
  setLngLat(coords: [number, number]): MapLibreMarkerLike
  setPopup(popup: MapLibrePopupLike): MapLibreMarkerLike
  addTo(map: MapLibreMapLike): MapLibreMarkerLike
  getElement(): HTMLElement
}

export interface MapLibrePopupLike {}

export interface MapLibreLngLatLike {
  lat: number
  lng: number
}

export interface MapLibreMapLike {
  remove(): void
  resize(): void
  flyTo(options: { center: [number, number]; zoom?: number }): void
  fitBounds(bounds: [[number, number], [number, number]], options?: Record<string, unknown>): void
  addControl(control: unknown, position?: string): void
  on(event: 'load' | 'click', listener: (event?: { lngLat: MapLibreLngLatLike }) => void): void
}

export interface MapLibreApi {
  Map: new (options: Record<string, unknown>) => MapLibreMapLike
  Marker: new (options?: Record<string, unknown>) => MapLibreMarkerLike
  Popup: new (options?: Record<string, unknown>) => MapLibrePopupLike
  NavigationControl: new (options?: Record<string, unknown>) => unknown
}

declare global {
  interface Window {
    maplibregl?: MapLibreApi
    __maplibrePromise?: Promise<MapLibreApi>
  }
}

const MAPLIBRE_VERSION = '5.20.0'
const MAPLIBRE_JS = `https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.js`
const MAPLIBRE_CSS = `https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.css`

function ensureCss() {
  const existing = document.querySelector(`link[data-maplibre-css="${MAPLIBRE_VERSION}"]`)

  if (existing) {
    return
  }

  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = MAPLIBRE_CSS
  link.dataset.maplibreCss = MAPLIBRE_VERSION
  document.head.appendChild(link)
}

export function loadMapLibre() {
  if (window.maplibregl) {
    return Promise.resolve(window.maplibregl)
  }

  if (window.__maplibrePromise) {
    return window.__maplibrePromise
  }

  ensureCss()

  window.__maplibrePromise = new Promise<MapLibreApi>((resolve, reject) => {
    const existing = document.querySelector(`script[data-maplibre-js="${MAPLIBRE_VERSION}"]`) as
      | HTMLScriptElement
      | null

    if (existing) {
      existing.addEventListener('load', () => {
        if (window.maplibregl) {
          resolve(window.maplibregl)
        }
      })
      existing.addEventListener('error', () => reject(new Error('MapLibre script failed to load.')))
      return
    }

    const script = document.createElement('script')
    script.src = MAPLIBRE_JS
    script.async = true
    script.dataset.maplibreJs = MAPLIBRE_VERSION
    script.onload = () => {
      if (window.maplibregl) {
        resolve(window.maplibregl)
        return
      }

      reject(new Error('MapLibre is not available on window.'))
    }
    script.onerror = () => reject(new Error('MapLibre script failed to load.'))
    document.head.appendChild(script)
  })

  return window.__maplibrePromise
}
