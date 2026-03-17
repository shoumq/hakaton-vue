<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { loadMapLibre } from '@/shared/lib/maplibre'
import type { MapLibreMapLike, MapLibreMarkerLike } from '@/shared/lib/maplibre'

interface MapPoint {
  id: string
  title: string
  companyName: string
  latitude: number
  longitude: number
  isFavorite?: boolean
}

const props = defineProps<{
  points: MapPoint[]
  activeId?: string | null
}>()

const emit = defineEmits<{
  hover: [id: string | null]
  select: [id: string]
}>()

const container = ref<HTMLElement | null>(null)
const loadError = ref('')
let map: MapLibreMapLike | null = null
let markers = new Map<string, MapLibreMarkerLike>()
let resizeObserver: ResizeObserver | null = null

function makeMarkerElement(point: MapPoint) {
  const element = document.createElement('button')
  element.type = 'button'
  element.className = 'opportunity-marker'
  if (point.isFavorite) element.classList.add('favorite')
  if (props.activeId === point.id) element.classList.add('active')
  element.innerHTML = '<span class="opportunity-marker__dot"></span>'
  element.addEventListener('mouseenter', () => emit('hover', point.id))
  element.addEventListener('mouseleave', () => emit('hover', null))
  element.addEventListener('click', () => emit('select', point.id))
  return element
}

function syncMarkerClasses() {
  for (const [id, marker] of markers) {
    marker.getElement().classList.toggle('active', props.activeId === id)
  }
}

function clearMarkers() {
  for (const marker of markers.values()) marker.remove()
  markers.clear()
}

async function renderMap() {
  if (!container.value) return

  try {
    const maplibregl = await loadMapLibre()

    if (!map) {
      map = new maplibregl.Map({
        container: container.value,
        style: {
          version: 8,
          sources: {
            osm: {
              type: 'raster',
              tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
              tileSize: 256,
              attribution: '© OpenStreetMap contributors',
            },
          },
          layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
        },
        center: [37.618423, 55.751244],
        zoom: 4,
      })

      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    }

    clearMarkers()

    for (const point of props.points) {
      const marker = new maplibregl.Marker({
        element: makeMarkerElement(point),
        anchor: 'center',
      })
        .setLngLat([point.longitude, point.latitude])
        .setPopup(new maplibregl.Popup({ offset: 14 }))
        .addTo(map)

      markers.set(point.id, marker)
    }

    if (props.points.length === 1) {
      map.flyTo({
        center: [props.points[0].longitude, props.points[0].latitude],
        zoom: 11,
      })
    } else if (props.points.length > 1) {
      const lngs = props.points.map((point) => point.longitude)
      const lats = props.points.map((point) => point.latitude)
      map.fitBounds(
        [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        { padding: 48, maxZoom: 11 },
      )
    }

    syncMarkerClasses()
    map.resize()
    loadError.value = ''
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : 'Не удалось загрузить карту.'
  }
}

onMounted(async () => {
  await renderMap()

  if (container.value) {
    resizeObserver = new ResizeObserver(() => {
      map?.resize()
    })
    resizeObserver.observe(container.value)
  }
})

watch(
  () => props.points,
  async () => {
    await renderMap()
  },
  { deep: true },
)

watch(
  () => props.activeId,
  () => {
    syncMarkerClasses()
  },
)

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  clearMarkers()
  map?.remove()
  map = null
})
</script>

<template>
  <div class="map-wrapper">
    <div ref="container" class="map-canvas"></div>
    <p v-if="loadError" class="map-error">{{ loadError }}</p>
  </div>
</template>

<style scoped>
.map-wrapper {
  position: absolute;
  inset: 0;
}

.map-canvas {
  width: 100%;
  height: 100%;
  border: 1px solid #d7dee7;
  border-radius: 12px;
  overflow: hidden;
}

.map-error {
  position: absolute;
  top: 16px;
  left: 16px;
  margin: 0;
  color: var(--danger);
  font-size: 0.88rem;
}

:deep(.opportunity-marker) {
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  display: grid;
  place-items: center;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 6px 16px rgba(30, 39, 46, 0.16);
  cursor: pointer;
}

:deep(.opportunity-marker__dot) {
  width: 12px;
  height: 12px;
  border-radius: 999px;
  background: #0a66c2;
}

:deep(.opportunity-marker.favorite .opportunity-marker__dot) {
  background: #12756e;
}

:deep(.opportunity-marker.active) {
  transform: scale(1.12);
}
</style>
