export type TravelMode = 'walk' | 'bicycle' | 'moto' | 'car' | 'bus' | 'train'

export type TravelModeInfo = {
  id: TravelMode
  label: string
  icon: string
  detail: string
  /** OSRM profile used for the route, when one exists. */
  profile: 'foot' | 'bike' | 'driving' | null
  /** Multiplier applied to the routed duration for derived modes. */
  factor: number
  /** Fixed extra minutes: boarding, parking, waiting. */
  wait: number
}

export const TRAVEL_MODES: TravelModeInfo[] = [
  { id: 'walk', label: 'Walk', icon: '🚶', detail: 'Footpaths and crossings, about 5 km/h.', profile: 'foot', factor: 1, wait: 0 },
  { id: 'bicycle', label: 'Bicycle', icon: '🚲', detail: 'Cycle-friendly streets, about 15 km/h.', profile: 'bike', factor: 1, wait: 0 },
  { id: 'moto', label: 'Motorcycle', icon: '🏍', detail: 'Driving route, about 15% quicker than a car in traffic.', profile: 'driving', factor: 0.85, wait: 0 },
  { id: 'car', label: 'Car', icon: '🚗', detail: 'Driving route with one-way streets, about 24 km/h.', profile: 'driving', factor: 1, wait: 0 },
  { id: 'bus', label: 'Bus', icon: '🚌', detail: 'Driving route plus stops and waiting, about 15 km/h.', profile: 'driving', factor: 1.5, wait: 6 },
  { id: 'train', label: 'Train', icon: '🚆', detail: 'Straight-line rail estimate at 60 km/h, if a line serves the area.', profile: null, factor: 1, wait: 12 },
]

export type LineStringGeometry = { type: 'LineString'; coordinates: [number, number][] }

export type RouteResult = {
  mode: TravelMode
  distance: number
  duration: number
  geometry: LineStringGeometry | null
  estimate: boolean
}

const API = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'

async function osrmRoute(profile: string, from: [number, number], to: [number, number]): Promise<{ distance: number; duration: number; geometry: LineStringGeometry }> {
  const url = `${API}/api/v1/route?profile=${profile}&from=${from[0]},${from[1]}&to=${to[0]},${to[1]}`
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Routing failed (${response.status})`)
  const body = await response.json()
  return { distance: body.distance, duration: body.duration, geometry: body.geometry }
}

/** Distance in metres between two WGS84 points. */
export function straightLine(from: [number, number], to: [number, number]): number {
  const dx = (to[0] - from[0]) * 111320 * Math.cos((from[1] * Math.PI) / 180)
  const dy = (to[1] - from[1]) * 110540
  return Math.hypot(dx, dy)
}

export async function planRoute(mode: TravelMode, from: [number, number], to: [number, number]): Promise<RouteResult> {
  const info = TRAVEL_MODES.find((entry) => entry.id === mode) ?? TRAVEL_MODES[0]
  if (!info.profile) {
    const distance = straightLine(from, to) * 1.15
    return {
      mode,
      distance,
      duration: distance / (60_000 / 3600) + info.wait * 60,
      geometry: { type: 'LineString', coordinates: [from, to] },
      estimate: true,
    }
  }
  const route = await osrmRoute(info.profile, from, to)
  return {
    mode,
    distance: route.distance,
    duration: route.duration * info.factor + info.wait * 60,
    geometry: route.geometry,
    estimate: info.id === 'moto' || info.id === 'bus',
  }
}

export type AirportMovement = { callsign: string; other_airport: string | null; time: number | null; icao24: string | null }
export type AirportFlights = {
  icao: string
  window_minutes: number
  arrivals: AirportMovement[]
  departures: AirportMovement[]
  provider: string
  url: string
}

export async function fetchAirportFlights(icao: string): Promise<AirportFlights> {
  const response = await fetch(`${API}/api/v1/airport?icao=${encodeURIComponent(icao)}`)
  if (!response.ok) {
    const detail = await response.json().catch(() => null)
    throw new Error(detail?.detail ?? `Airport data failed (${response.status})`)
  }
  return (await response.json()) as AirportFlights
}
