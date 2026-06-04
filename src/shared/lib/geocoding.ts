interface NominatimResult {
  display_name?: string
  address?: {
    road?: string
    house_number?: string
    suburb?: string
    city?: string
    town?: string
    village?: string
    state?: string
    country?: string
  }
}

export async function reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&accept-language=ru`
    const response = await fetch(url, {
      headers: { 'Accept-Language': 'ru' },
    })

    if (!response.ok) return null

    const data: NominatimResult = await response.json()
    const a = data.address

    if (!a) return data.display_name ?? null

    const parts = [
      a.country,
      a.state,
      a.city ?? a.town ?? a.village,
      a.suburb,
      a.road,
      a.house_number,
    ].filter(Boolean)

    return parts.length ? parts.join(', ') : (data.display_name ?? null)
  } catch {
    return null
  }
}
