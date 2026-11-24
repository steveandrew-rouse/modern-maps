export type PlaceHit = {
  name: string
  display_name: string
  kind: string
  country: string | null
  lat: number
  lng: number
}

export type NetworkLocation = {
  lat: number
  lng: number
  city: string | null
  region: string | null
  country: string | null
  accuracy: string
  provider: string
}

const API = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'

/** Free-text place search, proxied to OpenStreetMap's Nominatim by the backend. */
export async function searchPlaces(query: string): Promise<PlaceHit[]> {
  const response = await fetch(`${API}/api/v1/geocode?q=${encodeURIComponent(query)}`)
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.detail ?? `Place search failed (${response.status})`)
  }
  return (await response.json()) as PlaceHit[]
}

/** Approximate city-level position of this network, from its public IP address. */
export async function fetchNetworkLocation(): Promise<NetworkLocation> {
  const response = await fetch(`${API}/api/v1/locate`)
  if (!response.ok) throw new Error(`Location lookup failed (${response.status})`)
  return (await response.json()) as NetworkLocation
}
