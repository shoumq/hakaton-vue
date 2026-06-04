import type { PublicCatalog } from '@/shared/api'

const TTL_MS = 5 * 60 * 1000 // 5 minutes

let cached: PublicCatalog | null = null
let cachedAt = 0
let inflight: Promise<PublicCatalog> | null = null

export async function getCatalog(fetcher: () => Promise<PublicCatalog>): Promise<PublicCatalog> {
  if (cached && Date.now() - cachedAt < TTL_MS) return cached
  if (inflight) return inflight

  inflight = fetcher().then((data) => {
    cached = data
    cachedAt = Date.now()
    inflight = null
    return data
  }).catch((err) => {
    inflight = null
    throw err
  })

  return inflight
}

export function invalidateCatalog() {
  cached = null
  cachedAt = 0
  inflight = null
}
