/**
 * Major Indian dams, curated from public reference data (dam register entries and
 * operator pages). Coordinates are rounded to about a kilometre — enough to land
 * the marker on the dam, not a survey. `height_m` is the published maximum height
 * of the dam structure, not the reservoir depth.
 */
export type Dam = {
  id: string
  name: string
  river: string
  state: string
  lat: number
  lng: number
  height_m: number
  type: string
  year: number
}

export const DAMS: Dam[] = [
  { id: 'tehri', name: 'Tehri Dam', river: 'Bhagirathi', state: 'Uttarakhand', lat: 30.377, lng: 78.48, height_m: 260.5, type: 'rock-fill embankment', year: 2006 },
  { id: 'bhakra', name: 'Bhakra Dam', river: 'Sutlej', state: 'Himachal Pradesh', lat: 31.4104, lng: 76.4338, height_m: 226, type: 'concrete gravity', year: 1963 },
  { id: 'idukki', name: 'Idukki Arch Dam', river: 'Periyar', state: 'Kerala', lat: 9.8425, lng: 76.9766, height_m: 168.9, type: 'double-curvature arch', year: 1976 },
  { id: 'sardar-sarovar', name: 'Sardar Sarovar Dam', river: 'Narmada', state: 'Gujarat', lat: 21.8306, lng: 73.7478, height_m: 163, type: 'concrete gravity', year: 2017 },
  { id: 'nagarjuna-sagar', name: 'Nagarjuna Sagar Dam', river: 'Krishna', state: 'Telangana', lat: 16.5756, lng: 79.312, height_m: 124, type: 'masonry gravity', year: 1972 },
  { id: 'koyna', name: 'Koyna Dam', river: 'Koyna', state: 'Maharashtra', lat: 17.4, lng: 73.75, height_m: 103, type: 'rubble concrete gravity', year: 1964 },
  { id: 'rihand', name: 'Rihand Dam', river: 'Rihand', state: 'Uttar Pradesh', lat: 24.203, lng: 83.015, height_m: 91.4, type: 'concrete gravity', year: 1962 },
  { id: 'ukai', name: 'Ukai Dam', river: 'Tapi', state: 'Gujarat', lat: 21.2333, lng: 73.5833, height_m: 80.8, type: 'earth and masonry', year: 1972 },
  { id: 'hirakud', name: 'Hirakud Dam', river: 'Mahanadi', state: 'Odisha', lat: 21.5294, lng: 83.8722, height_m: 61, type: 'composite earth and concrete', year: 1957 },
  { id: 'mettur', name: 'Mettur Dam', river: 'Kaveri', state: 'Tamil Nadu', lat: 11.7937, lng: 77.8008, height_m: 36.6, type: 'masonry gravity', year: 1934 },
]

export const DAM_BY_ID = new Map(DAMS.map((dam) => [dam.id, dam]))

export function damsGeoJSON() {
  return {
    type: 'FeatureCollection' as const,
    features: DAMS.map((dam) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [dam.lng, dam.lat] },
      properties: { id: dam.id, name: dam.name, height: dam.height_m },
    })),
  }
}
