export type CityBuilding = {
  ring: [number, number][]
  height: number | null
  levels: number | null
  class: string
  name: string | null
}

export type CityRoad = {
  line: [number, number][]
  class: string
  name: string | null
  oneway: boolean
}

export type CityModel = {
  centre: [number, number]
  buildings: CityBuilding[]
  roads: CityRoad[]
  water: { ring: [number, number][] }[]
  attribution: string
  truncated: boolean
}

const API = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'

/** Half-width of the city patch in metres — about a 0.85 km square of detail. */
export const CITY_RADIUS_M = 300

export function bboxFor(lat: number, lng: number, radius = CITY_RADIUS_M) {
  const dLat = radius / 111320
  const dLng = radius / (111320 * Math.cos((lat * Math.PI) / 180))
  return { south: lat - dLat, north: lat + dLat, west: lng - dLng, east: lng + dLng }
}

export async function fetchCityModel(lat: number, lng: number, signal: AbortSignal): Promise<CityModel> {
  const { south, north, west, east } = bboxFor(lat, lng)
  const params = new URLSearchParams({
    south: south.toFixed(6), north: north.toFixed(6),
    west: west.toFixed(6), east: east.toFixed(6),
  })
  const response = await fetch(`${API}/api/v1/city-model?${params}`, { signal })
  if (!response.ok) {
    const detail = await response.json().catch(() => null)
    throw new Error(detail?.detail ?? `City model failed (${response.status})`)
  }
  return (await response.json()) as CityModel
}

/** Height in metres from OSM tags; null when the building is unmapped. */
export function taggedHeight(building: CityBuilding): number | null {
  if (building.height && building.height > 0) return building.height
  if (building.levels && building.levels > 0) return building.levels * 3.2
  return null
}

/** Stable pseudo-random 0..1 from a string, so estimates never flicker. */
export function hashUnit(seed: string): number {
  let hash = 2166136261
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return ((hash >>> 0) % 1000) / 1000
}

/** Depth ramp for the flood scenario, shallow cyan to deep indigo (metres). */
export function floodColour(depth: number): string {
  const stops: [number, string][] = [
    [0, '#8fe9ff'], [0.3, '#4fc3ff'], [0.8, '#2f7df0'], [1.5, '#2a49c9'], [3, '#4a2a9e'],
  ]
  if (depth <= 0) return stops[0][1]
  for (let index = 1; index < stops.length; index += 1) {
    if (depth <= stops[index][0]) {
      const [a, colourA] = stops[index - 1]
      const [b, colourB] = stops[index]
      const t = (depth - a) / (b - a)
      const mix = (offset: number) => {
        const ca = parseInt(colourA.slice(1 + offset, 3 + offset), 16)
        const cb = parseInt(colourB.slice(1 + offset, 3 + offset), 16)
        return Math.round(ca + (cb - ca) * t).toString(16).padStart(2, '0')
      }
      return `#${mix(0)}${mix(2)}${mix(4)}`
    }
  }
  return stops[stops.length - 1][1]
}

export const SECTOR_COLOURS: Record<string, string> = {
  residential: '#c8a97a', house: '#d9c3a0', apartments: '#c8a97a', terrace: '#d0b183', dormitory: '#c8a97a',
  commercial: '#6fa8ff', office: '#7fb2ff', retail: '#ffb347', shop: '#ffb347', supermarket: '#ffb347',
  industrial: '#a98ad6', warehouse: '#9a7bcc', factory: '#a98ad6',
  government: '#9fb2c4', civic: '#9fb2c4', public: '#9fb2c4',
  school: '#7ce7a4', university: '#8fd8f2', college: '#8fd8f2', kindergarten: '#7ce7a4',
  hospital: '#ff8a8a', clinic: '#ffa3a3',
  religious: '#ffd166', church: '#ffd166', mosque: '#ffd166', temple: '#ffd166',
}
