<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { loadMapLibre } from '@/shared/lib/maplibre'
import type { MapLibreMapLike, MapLibreMarkerLike } from '@/shared/lib/maplibre'

const props = defineProps<{
  latitude: number
  longitude: number
  label: string
  selectable?: boolean
}>()

const emit = defineEmits<{
  select: [payload: { latitude: number; longitude: number }]
}>()

const container = ref<HTMLElement | null>(null)
const loadError = ref('')
let map: MapLibreMapLike | null = null
let marker: MapLibreMarkerLike | null = null
let isMapClickBound = false

async function renderMap() {
  if (!container.value) {
    return
  }

  try {
    const maplibregl = await loadMapLibre()
    const center: [number, number] = [props.longitude, props.latitude]

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
          layers: [
            {
              id: 'osm',
              type: 'raster',
              source: 'osm',
            },
          ],
        },
        center,
        zoom: 12,
      })

      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
      map.on('load', () => {
        map?.resize()
      })

      marker = new maplibregl.Marker({ color: '#0a66c2' })
        .setLngLat(center)
        .setPopup(new maplibregl.Popup({ offset: 16 }))
        .addTo(map)

      if (props.selectable && !isMapClickBound) {
        map.on('click', (event) => {
          if (!event?.lngLat) {
            return
          }

          emit('select', {
            latitude: event.lngLat.lat,
            longitude: event.lngLat.lng,
          })
        })
        isMapClickBound = true
      }
    }

    marker?.setLngLat(center)
    map.flyTo({ center, zoom: 12 })
    map.resize()
    loadError.value = ''
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : 'Не удалось загрузить карту.'
  }
}

onMounted(async () => {
  await renderMap()
})

watch(
  () => [props.latitude, props.longitude, props.label] as const,
  async () => {
    await renderMap()
  },
)

onBeforeUnmount(() => {
  marker?.remove()
  marker = null
  map?.remove()
  map = null
})
</script>

<template>
  <div class="map-wrapper">
    <div ref="container" class="map-canvas"></div>
    <p v-if="selectable" class="map-hint">Кликните по карте, чтобы выбрать точку.</p>
    <p v-if="loadError" class="map-error">{{ loadError }}</p>
  </div>
</template>

<style scoped>
.map-wrapper {
  position: relative;
}

.map-canvas {
  min-height: 320px;
  border: 1px solid #d7dee7;
  border-radius: 12px;
  overflow: hidden;
}

.map-error {
  margin: 10px 0 0;
  color: var(--danger);
  font-size: 0.88rem;
}

.map-hint {
  margin: 10px 0 0;
  color: #5f6b7a;
  font-size: 0.88rem;
}
</style>
