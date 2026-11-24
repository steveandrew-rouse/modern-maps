import { useCallback, useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { Map as MapLibreMap, StyleSpecification } from 'maplibre-gl'
import { ArrowLeft, Building2, Compass, Layers3, MapPin, Move3d } from 'lucide-react'
import CityScene, { type BuildingInfo, type CityControls } from './CityScene'
import { fetchCityModel, taggedHeight, type CityModel } from './citymodel'
import {
  TRAVEL_MODES, fetchAirportFlights, planRoute,
  type AirportFlights, type RouteResult, type TravelMode,
} from './places'

export type CityTarget = { name: string; lat: number; lng: number; kind?: string }

const SECTORS: { label: string; colour: string; classes: string[] }[] = [
  { label: 'Residential', colour: '#c8a97a', classes: ['residential', 'house', 'apartments', 'terrace', 'dormitory'] },
  { label: 'Commercial', colour: '#6fa8ff', classes: ['commercial', 'office', 'retail', 'shop'] },
  { label: 'Industrial', colour: '#a98ad6', classes: ['industrial', 'warehouse', 'factory'] },
  { label: 'Civic', colour: '#9fb2c4', classes: ['government', 'civic', 'public'] },
  { label: 'Education', colour: '#7ce7a4', classes: ['school', 'university', 'college', 'kindergarten'] },
  { label: 'Health', colour: '#ff8a8a', classes: ['hospital', 'clinic'] },
  { label: 'Religious', colour: '#ffd166', classes: ['religious', 'place_of_worship', 'church', 'mosque', 'temple'] },
  { label: 'Unmapped', colour: '#b9b4aa', classes: [] },
]

const POI_COLOUR = [
  'match', ['get', 'class'],
  'restaurant', '#ff9f6e', 'cafe', '#ffb17a', 'fast_food', '#ff9f6e', 'bar', '#ff8fbf',
  'shop', '#7fd6ff', 'supermarket', '#7fd6ff', 'marketplace', '#7fd6ff',
  'hospital', '#ff8a8a', 'clinic', '#ffa3a3', 'pharmacy', '#ff8a8a',
  'school', '#7ce7a4', 'college', '#7ce7a4', 'university', '#7ce7a4',
  'place_of_worship', '#ffd166', 'museum', '#d6b3ff', 'attraction', '#d6b3ff',
  'bus', '#b9a8ff', 'railway', '#b9a8ff', 'fuel', '#ffd2a1', 'park', '#8fe3a0',
  '#8ff0ff',
]

const LABEL_FONT = ['Noto Sans Regular']

function cityStyle(): StyleSpecification {
  return {
    version: 8,
    sources: {
      openmaptiles: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' },
    },
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': '#03090f' } },
      { id: 'water', type: 'fill', source: 'openmaptiles', 'source-layer': 'water', paint: { 'fill-color': '#052b3d' } },
      { id: 'waterway', type: 'line', source: 'openmaptiles', 'source-layer': 'waterway', paint: { 'line-color': '#0a4763', 'line-width': 1.4 } },
      {
        id: 'park', type: 'fill', source: 'openmaptiles', 'source-layer': 'landcover', minzoom: 12,
        filter: ['in', ['get', 'class'], ['literal', ['wood', 'grass', 'park']]],
        paint: { 'fill-color': '#06231c', 'fill-opacity': 0.85 },
      },
      {
        id: 'building', type: 'fill', source: 'openmaptiles', 'source-layer': 'building', minzoom: 13,
        paint: { 'fill-color': '#16303d', 'fill-outline-color': '#2a5a70' },
      },
      {
        id: 'building-3d', type: 'fill-extrusion', source: 'openmaptiles', 'source-layer': 'building', minzoom: 13,
        layout: { visibility: 'none' },
        paint: {
          'fill-extrusion-color': ['interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 8],
            0, '#0f2d3a', 20, '#1d5e73', 60, '#2e9fb8', 120, '#63e0f0'],
          'fill-extrusion-height': ['min', 320, ['max', 3, ['coalesce', ['get', 'render_height'], 9]]],
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 0.82,
          'fill-extrusion-vertical-gradient': true,
        },
      },
      {
        id: 'road-glow', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation', minzoom: 11,
        filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary']]],
        paint: { 'line-color': '#2fa8d8', 'line-width': 6, 'line-blur': 4, 'line-opacity': 0.35 },
      },
      {
        id: 'road-casing', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation', minzoom: 11,
        filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor']]],
        paint: {
          'line-color': '#040b10',
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1.4, 15, 5.4, 18, 18],
        },
      },
      {
        id: 'road-fill', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation', minzoom: 11,
        filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor']]],
        paint: {
          'line-color': ['match', ['get', 'class'],
            'motorway', '#d9a95f', 'trunk', '#cfa269', 'primary', '#7fb6c9',
            'secondary', '#5d8fa3', 'tertiary', '#456c7d', '#35535f'],
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.7, 15, 3.2, 18, 12],
        },
      },
      {
        id: 'street-label', type: 'symbol', source: 'openmaptiles', 'source-layer': 'transportation_name', minzoom: 14,
        layout: {
          'symbol-placement': 'line', 'text-field': ['coalesce', ['get', 'name'], ''],
          'text-size': 9, 'text-font': LABEL_FONT, 'text-letter-spacing': 0.08,
          'text-padding': 2, 'symbol-spacing': 320,
        },
        paint: { 'text-color': '#8fb3c4', 'text-halo-color': '#03090f', 'text-halo-width': 1.3 },
      },
      {
        id: 'place-suburb', type: 'symbol', source: 'openmaptiles', 'source-layer': 'place', minzoom: 11,
        filter: ['in', ['get', 'class'], ['literal', ['suburb', 'neighbourhood', 'quarter', 'village', 'hamlet']]],
        layout: {
          'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']],
          'text-size': ['interpolate', ['linear'], ['zoom'], 11, 10.5, 15, 13],
          'text-font': LABEL_FONT, 'text-letter-spacing': 0.14, 'text-transform': 'uppercase',
          'text-padding': 4,
        },
        paint: { 'text-color': '#7fe3ff', 'text-halo-color': '#021117', 'text-halo-width': 1.8 },
      },
      {
        id: 'place-label', type: 'symbol', source: 'openmaptiles', 'source-layer': 'place', minzoom: 9,
        filter: ['in', ['get', 'class'], ['literal', ['city', 'town']]],
        layout: {
          'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']],
          'text-size': ['interpolate', ['linear'], ['zoom'], 9, 11, 14, 17],
          'text-font': LABEL_FONT, 'text-letter-spacing': 0.12,
          'text-padding': 6,
        },
        paint: { 'text-color': '#eafaff', 'text-halo-color': '#021117', 'text-halo-width': 2 },
      },
      {
        id: 'airport-dot', type: 'circle', source: 'openmaptiles', 'source-layer': 'aerodrome_label', minzoom: 8,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 3, 13, 5],
          'circle-color': '#8ff0ff', 'circle-stroke-width': 1.4, 'circle-stroke-color': '#021117',
        },
      },
      {
        id: 'airport-label', type: 'symbol', source: 'openmaptiles', 'source-layer': 'aerodrome_label', minzoom: 8,
        layout: {
          'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name'], ['get', 'iata'], 'Airport'],
          'text-size': 9.5, 'text-font': LABEL_FONT, 'text-offset': [0, 1], 'text-anchor': 'top', 'text-padding': 2,
        },
        paint: { 'text-color': '#a9e7f7', 'text-halo-color': '#021117', 'text-halo-width': 1.2 },
      },
      {
        id: 'poi-dot', type: 'circle', source: 'openmaptiles', 'source-layer': 'poi', minzoom: 14,
        filter: ['has', 'name'],
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 14, 2, 18, 3.6],
          'circle-color': POI_COLOUR as never,
          'circle-stroke-width': 1,
          'circle-stroke-color': '#021117',
          'circle-opacity': 0.95,
        },
      },
      {
        id: 'poi-label', type: 'symbol', source: 'openmaptiles', 'source-layer': 'poi', minzoom: 15,
        filter: ['has', 'name'],
        layout: {
          'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']],
          'text-size': 9.5, 'text-font': LABEL_FONT,
          'text-offset': [0, 0.9], 'text-anchor': 'top', 'text-optional': true, 'text-padding': 1,
        },
        paint: { 'text-color': '#bfe6f2', 'text-halo-color': '#021117', 'text-halo-width': 1.2 },
      },
    ],
  }
}

type AirportTarget = { name: string; iata: string | null; icao: string | null; ele: number | null; lng: number; lat: number }

type Nearby = { name: string; kind: string; distance: number }
type Detail = {
  title: string
  kind: string
  lng: number
  lat: number
  rows: { label: string; value: string }[]
  nearby: Nearby[]
}

const metresBetween = (aLng: number, aLat: number, bLng: number, bLat: number) => {
  const dx = (bLng - aLng) * 111320 * Math.cos((aLat * Math.PI) / 180)
  const dy = (bLat - aLat) * 110540
  return Math.hypot(dx, dy)
}

function describeAt(map: MapLibreMap, lng: number, lat: number): Detail | null {
  const point = map.project([lng, lat])
  const layers = ['building', 'poi-label', 'place-label', 'place-suburb', 'street-label', 'road-fill', 'water']
    .filter((id) => map.getLayer(id))
  const features = map.queryRenderedFeatures([point.x, point.y], { layers })
  const feature = features[0]
  if (!feature) return null
  const properties = feature.properties ?? {}
  const rows: { label: string; value: string }[] = []
  let title = String(properties['name:latin'] ?? properties.name ?? '')
  let kind = ''

  if (feature.layer.id === 'building') {
    const height = Number(properties.render_height ?? 0)
    title = title || 'Building footprint'
    kind = 'building · OSM footprint'
    rows.push({ label: 'Height', value: height > 0 ? `${Math.round(height)} m (OSM render height)` : 'not tagged' })
    if (properties.render_min_height) rows.push({ label: 'Base', value: `${Math.round(Number(properties.render_min_height))} m` })
  } else if (feature.layer.id.startsWith('poi')) {
    kind = `poi · ${String(properties.class ?? 'place')}`
    title = title || String(properties.class ?? 'Point of interest')
    if (properties.subclass) rows.push({ label: 'Subtype', value: String(properties.subclass) })
  } else if (feature.layer.id.startsWith('place')) {
    kind = `place · ${String(properties.class ?? 'settlement')}`
    title = title || String(properties.class ?? 'Place')
    if (properties.capital) rows.push({ label: 'Admin capital', value: String(properties.capital) })
  } else if (feature.layer.id === 'street-label' || feature.layer.id === 'road-fill') {
    kind = `street · ${String(properties.class ?? 'road')}`
    title = title || String(properties.ref ?? 'Unnamed street')
    if (properties.oneway) rows.push({ label: 'One-way', value: String(properties.oneway) })
    if (properties.surface) rows.push({ label: 'Surface', value: String(properties.surface) })
  } else if (feature.layer.id === 'water') {
    title = title || 'Water body'
    kind = 'water'
  }

  rows.unshift({ label: 'Coordinates', value: `${lat.toFixed(5)}, ${lng.toFixed(5)}` })

  // Named features around the clicked point, straight from the loaded tiles.
  const seen = new Set<string>([title])
  const nearby: Nearby[] = []
  for (const sourceLayer of ['poi', 'place']) {
    const candidates = map.querySourceFeatures('openmaptiles', { sourceLayer })
    for (const candidate of candidates) {
      const name = String(candidate.properties['name:latin'] ?? candidate.properties.name ?? '')
      if (!name || seen.has(name)) continue
      const geometry = candidate.geometry as { type: string; coordinates?: unknown; [key: string]: unknown }
      const coords = extractPoint(geometry)
      if (!coords) continue
      const distance = metresBetween(lng, lat, coords[0], coords[1])
      if (distance > 2200) continue
      seen.add(name)
      nearby.push({ name, kind: String(candidate.properties.class ?? 'place'), distance })
    }
  }
  nearby.sort((a, b) => a.distance - b.distance)

  return { title, kind, lng, lat, rows, nearby: nearby.slice(0, 6) }
}

function extractPoint(geometry: { type: string; coordinates?: unknown }): [number, number] | null {
  if (geometry.type === 'Point') {
    const coords = geometry.coordinates as [number, number]
    return [coords[0], coords[1]]
  }
  const ring = geometry.coordinates as unknown
  if (Array.isArray(ring)) {
    const first = ring[0]
    if (Array.isArray(first) && typeof first[0] === 'number') return [first[0], first[1]]
    if (Array.isArray(first) && Array.isArray(first[0])) return [first[0][0], first[0][1]]
  }
  return null
}

export default function CityView({ city, onClose }: { city: CityTarget; onClose: () => void }) {
  const container = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const pad = useRef<CityControls>({ forward: 0, strafe: 0, turn: 0, lift: 0 })
  const actions = useRef<{
    travel: TravelMode | null
    airport: (feature: maplibregl.MapGeoJSONFeature) => void
    route: (lng: number, lat: number) => void
  }>({ travel: null, airport: () => {}, route: () => {} })
  const [mode, setMode] = useState<'2d' | '3d'>('2d')
  const [hud, setHud] = useState({ zoom: 14.6, bearing: 0, lat: city.lat, lng: city.lng })
  const [detail, setDetail] = useState<Detail | null>(null)
  const [panel, setPanel] = useState<'layers' | 'legend' | 'travel' | null>('layers')
  const [layers, setLayers] = useState({ buildings3d: false, labels: true, pois: true, streets: true })
  const [travel, setTravel] = useState<TravelMode | null>(null)
  const [route, setRoute] = useState<RouteResult | null>(null)
  const [routeBusy, setRouteBusy] = useState(false)
  const [routeError, setRouteError] = useState<string | null>(null)
  const [airport, setAirport] = useState<AirportTarget | null>(null)
  const [flights, setFlights] = useState<AirportFlights | null>(null)
  const [flightsError, setFlightsError] = useState<string | null>(null)

  const [model, setModel] = useState<CityModel | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [built, setBuilt] = useState(false)
  const [inspect, setInspect] = useState<{ x: number; y: number; info: BuildingInfo | null } | null>(null)

  // --- Augma-style 2D city map ------------------------------------------
  useEffect(() => {
    if (!container.current || mapRef.current) return
    const map = new maplibregl.Map({
      container: container.current,
      style: cityStyle(),
      center: [city.lng, city.lat],
      zoom: 13.2,
      pitch: 34,
      bearing: -14,
      maxZoom: 18.5,
      maxPitch: 80,
      attributionControl: false,
    })
    mapRef.current = map
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right')
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left')

    map.on('load', () => {
      map.resize()
      map.easeTo({ center: [city.lng, city.lat], zoom: 15.2, pitch: 48, bearing: -18, duration: 1800 })
      map.addSource('picked', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({
        id: 'picked-halo', type: 'circle', source: 'picked',
        paint: { 'circle-radius': 16, 'circle-color': '#8ff0ff', 'circle-opacity': 0.14 },
      })
      map.addLayer({
        id: 'picked-dot', type: 'circle', source: 'picked',
        paint: {
          'circle-radius': 4.5, 'circle-color': '#8ff0ff',
          'circle-stroke-width': 1.4, 'circle-stroke-color': '#021117',
        },
      })
      map.addSource('route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({
        id: 'route-halo', type: 'line', source: 'route',
        paint: { 'line-color': '#37d2ee', 'line-width': 11, 'line-opacity': 0.22, 'line-blur': 5 },
      })
      map.addLayer({
        id: 'route-line', type: 'line', source: 'route',
        paint: { 'line-color': '#7fe3ff', 'line-width': 3.4, 'line-dasharray': [2, 1.4] },
      })
      map.addSource('route-end', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({
        id: 'route-end', type: 'circle', source: 'route-end',
        paint: { 'circle-radius': 6, 'circle-color': '#ffd166', 'circle-stroke-width': 1.6, 'circle-stroke-color': '#021117' },
      })
    })

    map.on('click', (event) => {
      const lng = event.lngLat.lng
      const lat = event.lngLat.lat

      const airportLayers = ['airport-dot', 'airport-label'].filter((id) => map.getLayer(id))
      const airportFeature = airportLayers.length
        ? map.queryRenderedFeatures(event.point, { layers: airportLayers })[0]
        : undefined
      if (airportFeature) {
        actions.current.airport(airportFeature)
        return
      }

      const picked = map.getSource('picked') as maplibregl.GeoJSONSource | undefined
      picked?.setData({
        type: 'FeatureCollection',
        features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [lng, lat] } }],
      })

      if (actions.current.travel) {
        actions.current.route(lng, lat)
        return
      }

      setAirport(null)
      setFlights(null)
      setDetail(describeAt(map, lng, lat))
    })
    map.on('move', () => {
      const center = map.getCenter()
      setHud({
        zoom: map.getZoom(),
        bearing: ((map.getBearing() % 360) + 360) % 360,
        lat: center.lat,
        lng: center.lng,
      })
    })
    map.on('mouseenter', 'poi-dot', () => { map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', 'poi-dot', () => { map.getCanvas().style.cursor = '' })

    return () => {
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city.lat, city.lng])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    const set = (id: string, visible: boolean) => {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none')
    }
    set('building', !layers.buildings3d)
    set('building-3d', layers.buildings3d)
    set('place-label', layers.labels)
    set('place-suburb', layers.labels)
    set('street-label', layers.labels && layers.streets)
    set('poi-dot', layers.pois)
    set('poi-label', layers.pois)
  }, [layers])

  // --- 3D model, parked behind the toggle -------------------------------
  useEffect(() => {
    if (mode !== '3d' || model) return
    const controller = new AbortController()
    setError(null)
    fetchCityModel(city.lat, city.lng, controller.signal)
      .then((next) => setModel(next))
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return
        setError(cause instanceof Error ? cause.message : 'Could not build the city')
      })
    return () => controller.abort()
  }, [mode, model, attempt, city.lat, city.lng])

  useEffect(() => {
    if (mode !== '3d') return
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target
      if (target instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return
      const key = event.key.toLowerCase()
      if (key === 'escape') onClose()
      if (key === 'w' || key === 'arrowup') pad.current.forward = 1
      if (key === 's' || key === 'arrowdown') pad.current.forward = -1
      if (key === 'a' || key === 'arrowleft') pad.current.strafe = -1
      if (key === 'd' || key === 'arrowright') pad.current.strafe = 1
      if (key === 'q') pad.current.turn = -1
      if (key === 'e') pad.current.turn = 1
      if (key === 'r') pad.current.lift = 1
      if (key === 'f') pad.current.lift = -1
    }
    const onKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      if (['w', 'arrowup', 's', 'arrowdown'].includes(key)) pad.current.forward = 0
      if (['a', 'arrowleft', 'd', 'arrowright'].includes(key)) pad.current.strafe = 0
      if (key === 'q' || key === 'e') pad.current.turn = 0
      if (key === 'r' || key === 'f') pad.current.lift = 0
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [mode, onClose])

  const handleReady = useCallback(() => {
    // The 2D map stays mounted but hidden, so the toggle can bring it back.
    setBuilt(true)
  }, [])

  useEffect(() => {
    if (mode !== '2d') return
    setBuilt(false)
    const map = mapRef.current
    if (map) requestAnimationFrame(() => map.resize())
  }, [mode])

  const setView = (view: 'aerial' | 'street' | 'centre') => {
    const map = mapRef.current
    if (!map) return
    if (view === 'centre') map.easeTo({ center: [city.lng, city.lat], zoom: 15.2, pitch: 48, bearing: -18, duration: 1200 })
    if (view === 'aerial') map.easeTo({ pitch: 58, zoom: Math.max(15.2, map.getZoom()), duration: 900 })
    if (view === 'street') map.easeTo({ pitch: 78, zoom: 17.4, duration: 1100 })
  }

  const openAirport = (feature: maplibregl.MapGeoJSONFeature) => {
    const properties = feature.properties ?? {}
    const geometry = (feature.geometry ?? { type: 'Point', coordinates: [hud.lng, hud.lat] }) as {
      type: string
      coordinates?: [number, number]
    }
    const point = geometry.type === 'Point' ? geometry.coordinates ?? null : null
    const icao = properties.icao ? String(properties.icao) : null
    const target: AirportTarget = {
      name: String(properties['name:latin'] ?? properties.name ?? properties.iata ?? 'Airport'),
      iata: properties.iata ? String(properties.iata) : null,
      icao,
      ele: properties.ele != null ? Number(properties.ele) : null,
      lng: point ? point[0] : hud.lng,
      lat: point ? point[1] : hud.lat,
    }
    setAirport(target)
    setDetail(null)
    setFlights(null)
    setFlightsError(null)
    if (!icao) {
      setFlightsError('This airport has no ICAO code in the tiles, so its movements cannot be looked up.')
      return
    }
    fetchAirportFlights(icao)
      .then((payload) => setFlights(payload))
      .catch((cause: unknown) => setFlightsError(cause instanceof Error ? cause.message : 'Airport feed unavailable'))
  }

  const startRoute = (lng: number, lat: number) => {
    const mode = actions.current.travel
    if (!mode) return
    setRouteBusy(true)
    setRouteError(null)
    planRoute(mode, [city.lng, city.lat], [lng, lat])
      .then((result) => {
        setRoute(result)
        const map = mapRef.current
        if (!map) return
        const routeSource = map.getSource('route') as maplibregl.GeoJSONSource | undefined
        routeSource?.setData({
          type: 'FeatureCollection',
          features: [{ type: 'Feature', properties: {}, geometry: result.geometry as never }],
        })
        const endSource = map.getSource('route-end') as maplibregl.GeoJSONSource | undefined
        endSource?.setData({
          type: 'FeatureCollection',
          features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [lng, lat] } }],
        })
        map.fitBounds(
          [[Math.min(city.lng, lng), Math.min(city.lat, lat)], [Math.max(city.lng, lng), Math.max(city.lat, lat)]],
          { padding: 130, duration: 900, maxZoom: 16 },
        )
      })
      .catch((cause: unknown) => setRouteError(cause instanceof Error ? cause.message : 'No route found'))
      .finally(() => setRouteBusy(false))
  }

  actions.current = { travel, airport: openAirport, route: startRoute }

  const clearTravel = () => {
    setTravel(null)
    setRoute(null)
    setRouteError(null)
    const map = mapRef.current
    const routeSource = map?.getSource('route') as maplibregl.GeoJSONSource | undefined
    routeSource?.setData({ type: 'FeatureCollection', features: [] })
    const endSource = map?.getSource('route-end') as maplibregl.GeoJSONSource | undefined
    endSource?.setData({ type: 'FeatureCollection', features: [] })
  }

  const hold = (key: keyof CityControls, value: number) => ({
    onPointerDown: () => { pad.current[key] = value },
    onPointerUp: () => { pad.current[key] = 0 },
    onPointerLeave: () => { pad.current[key] = 0 },
  })

  const tagged = model ? model.buildings.filter((building) => taggedHeight(building) !== null).length : 0
  const estimated = model ? model.buildings.length - tagged : 0

  return (
    <div className="city-view" role="dialog" aria-label={`${city.name} city view`}>
      <div className={`city-map ${built ? 'is-hidden' : ''}`} ref={container} />
      {mode === '3d' && model && (
        <CityScene
          model={model}
          controls={pad}
          onReady={handleReady}
          onPick={(info, x, y) => setInspect({ info, x, y })}
        />
      )}

      <header className="city-bar">
        <button className="city-back" onClick={onClose}><ArrowLeft size={14} /> MAP</button>
        <div className="city-title">
          <b>{city.name}</b>
          <small>{hud.lat.toFixed(3)}, {hud.lng.toFixed(3)} · z{hud.zoom.toFixed(1)} · BRG {Math.round(hud.bearing)}°</small>
        </div>
        <div className="city-mode" role="group" aria-label="View mode">
          <button className={mode === '2d' ? 'active' : ''} onClick={() => setMode('2d')}>2D MAP</button>
          <button className={mode === '3d' ? 'active' : ''} onClick={() => setMode('3d')}>3D CITY</button>
        </div>
        <button className={`city-legend-toggle ${panel === 'travel' ? 'active' : ''}`} onClick={() => setPanel(panel === 'travel' ? null : 'travel')}>
          <Compass size={11} /> TRAVEL
        </button>
        <button className={`city-legend-toggle ${panel === 'legend' ? 'active' : ''}`} onClick={() => setPanel(panel === 'legend' ? null : 'legend')}>
          <Building2 size={11} /> SECTORS
        </button>
        <button className={`city-legend-toggle ${panel === 'layers' ? 'active' : ''}`} onClick={() => setPanel(panel === 'layers' ? null : 'layers')}>
          <Layers3 size={11} /> LAYERS
        </button>
      </header>

      {mode === '2d' && panel === 'layers' && (
        <aside className="city-panel city-layers">
          <div className="city-panel-head">LAYERS</div>
          {([
            ['buildings3d', '3D buildings'],
            ['labels', 'Place labels'],
            ['pois', 'POIs'],
            ['streets', 'Street names'],
          ] as const).map(([key, label]) => (
            <label key={key} className="city-layer-row">
              <input
                type="checkbox"
                checked={layers[key]}
                onChange={(event) => setLayers({ ...layers, [key]: event.target.checked })}
              />
              <span>{label}</span>
            </label>
          ))}
          <div className="city-panel-foot">Basemap: OpenFreeMap vector tiles · labels from OSM names</div>
        </aside>
      )}

      {mode === '2d' && panel === 'travel' && (
        <aside className="city-panel city-travel">
          <div className="city-panel-head">DRIVE MODE</div>
          <div className="city-travel-list">
            {TRAVEL_MODES.map((entry) => (
              <button
                key={entry.id}
                className={`city-travel-mode ${travel === entry.id ? 'active' : ''}`}
                onClick={() => { setTravel(travel === entry.id ? null : entry.id); setRoute(null); setRouteError(null) }}
              >
                <span className="city-travel-icon">{entry.icon}</span>
                <span className="city-travel-text">
                  <b>{entry.label}</b>
                  <small>{entry.detail}</small>
                </span>
              </button>
            ))}
          </div>
          {travel && !route && !routeBusy && (
            <div className="city-travel-hint">
              Click a destination on the map. Trips start at the centre of {city.name}.
            </div>
          )}
          {routeBusy && <div className="city-travel-hint">Planning the {travel} route…</div>}
          {routeError && <div className="city-travel-error">{routeError}</div>}
          {route && (
            <div className="city-route">
              <div className="city-route-mode">{TRAVEL_MODES.find((entry) => entry.id === route.mode)?.label}</div>
              <div className="city-route-row"><span>Distance</span><b>{route.distance < 1000 ? `${Math.round(route.distance)} m` : `${(route.distance / 1000).toFixed(1)} km`}</b></div>
              <div className="city-route-row"><span>Time</span><b>{Math.max(1, Math.round(route.duration / 60))} min</b></div>
              <div className="city-route-note">
                {route.estimate
                  ? 'Estimated from the driving route with a mode factor — not a timetable.'
                  : 'Street route from the public OSRM service.'}
              </div>
              <button className="city-route-clear" onClick={clearTravel}>CLEAR</button>
            </div>
          )}
        </aside>
      )}

      {mode === '2d' && panel === 'legend' && (
        <aside className="city-panel city-legend-2d">
          <div className="city-panel-head">MAP KEY</div>
          <span><i style={{ background: '#eafaff' }} /> City / town</span>
          <span><i style={{ background: '#7fe3ff' }} /> Suburb / neighbourhood</span>
          <span><i style={{ background: '#7fd6ff' }} /> Shops & services</span>
          <span><i style={{ background: '#ff9f6e' }} /> Food & drink</span>
          <span><i style={{ background: '#ffd166' }} /> Worship</span>
          <span><i style={{ background: '#7ce7a4' }} /> Schools & health</span>
          <span><i style={{ background: '#d9a95f' }} /> Motorway</span>
          <span><i style={{ background: '#2fa8d8' }} /> Water</span>
        </aside>
      )}

      {mode === '2d' && airport && (
        <aside className="city-panel city-airport">
          <button className="city-detail-close" onClick={() => { setAirport(null); setFlights(null) }}>×</button>
          <div className="city-panel-head">AIRPORT</div>
          <b className="city-detail-title">{airport.name}</b>
          <small className="city-detail-kind">
            {[airport.iata, airport.icao].filter(Boolean).join(' · ') || 'no codes in tiles'}
            {airport.ele != null ? ` · ${Math.round(airport.ele)} m` : ''}
          </small>
          <div className="city-detail-rows">
            <div><span>Coordinates</span><b>{airport.lat.toFixed(5)}, {airport.lng.toFixed(5)}</b></div>
          </div>
          <div className="city-airport-views">
            <button onClick={() => mapRef.current?.easeTo({ center: [airport.lng, airport.lat], zoom: 15.4, pitch: 55, duration: 1100 })}>AERIAL</button>
            <button onClick={() => mapRef.current?.easeTo({ center: [airport.lng, airport.lat], zoom: 17.2, pitch: 78, duration: 1100 })}>GROUND</button>
          </div>

          <div className="city-detail-sub">RECENT ARRIVALS</div>
          {!flights && !flightsError && <div className="city-airport-note">Loading movements for {airport.icao}…</div>}
          {flightsError && <div className="city-airport-note">{flightsError}</div>}
          {flights && (
            <ul className="city-airport-list">
              {flights.arrivals.length === 0 && <li><span>No arrivals recorded</span></li>}
              {flights.arrivals.slice(0, 8).map((movement) => (
                <li key={`arr-${movement.icao24}-${movement.time}`}>
                  <span>{movement.callsign}</span>
                  <small>{movement.other_airport ?? 'origin unknown'} · {movement.time ? new Date(movement.time * 1000).toISOString().slice(11, 16) : '—'} UTC</small>
                </li>
              ))}
            </ul>
          )}

          <div className="city-detail-sub">RECENT DEPARTURES</div>
          {flights && (
            <ul className="city-airport-list">
              {flights.departures.length === 0 && <li><span>No departures recorded</span></li>}
              {flights.departures.slice(0, 8).map((movement) => (
                <li key={`dep-${movement.icao24}-${movement.time}`}>
                  <span>{movement.callsign}</span>
                  <small>{movement.other_airport ?? 'destination unknown'} · {movement.time ? new Date(movement.time * 1000).toISOString().slice(11, 16) : '—'} UTC</small>
                </li>
              ))}
            </ul>
          )}
          {flights && (
            <div className="city-airport-note">
              Tracks recorded by OpenSky in the last {flights.window_minutes} min. Not a timetable, and no future schedule is public.
            </div>
          )}
          <div className="city-airport-links">
            {airport.iata && (
              <a href={`https://www.google.com/travel/flights?q=flights%20to%20${airport.iata}`} target="_blank" rel="noreferrer">GOOGLE FLIGHTS</a>
            )}
            <a href={`https://www.google.com/maps/search/?api=1&query=${airport.lat},${airport.lng}`} target="_blank" rel="noreferrer">MAPS</a>
          </div>
        </aside>
      )}

      {mode === '2d' && detail && (
        <aside className="city-panel city-detail">
          <button className="city-detail-close" onClick={() => setDetail(null)}>×</button>
          <div className="city-panel-head">PLACE DETAIL</div>
          <b className="city-detail-title">{detail.title}</b>
          <small className="city-detail-kind">{detail.kind}</small>
          <div className="city-detail-rows">
            {detail.rows.map((row) => (
              <div key={row.label}><span>{row.label}</span><b>{row.value}</b></div>
            ))}
          </div>
          <div className="city-detail-views">
            <button onClick={() => setView('aerial')}>AERIAL</button>
            <button onClick={() => setView('street')}>STREET</button>
            <button onClick={() => setView('centre')}>CENTRE</button>
          </div>
          {detail.nearby.length > 0 && (
            <>
              <div className="city-detail-sub">NEARBY</div>
              <ul className="city-nearby">
                {detail.nearby.map((place) => (
                  <li key={`${place.name}-${place.distance}`}>
                    <span>{place.name}</span>
                    <small>{place.kind} · {place.distance < 1000 ? `${Math.round(place.distance)} m` : `${(place.distance / 1000).toFixed(1)} km`}</small>
                  </li>
                ))}
              </ul>
            </>
          )}
        </aside>
      )}

      {mode === '3d' && !built && !error && (
        <div className="city-loading">
          <div className="city-loading-ring" />
          <b>BUILDING {city.name.toUpperCase()}</b>
          <span>Fetching real footprints, heights and streets from OpenStreetMap, then meshing them into 3D.</span>
        </div>
      )}

      {mode === '3d' && error && (
        <div className="city-error">
          <b>Could not build the 3D city</b>
          <span>{error}</span>
          <span className="city-error-hint">The 2D map stays available while the model is unavailable.</span>
          <button onClick={() => { setModel(null); setAttempt(attempt + 1) }}>TRY AGAIN</button>
        </div>
      )}

      {mode === '3d' && built && panel === 'legend' && (
        <aside className="city-legend">
          <div className="city-legend-head">BUILDING SECTOR · COLOUR</div>
          {SECTORS.map((sector) => (
            <span key={sector.label}>
              <i style={{ background: sector.colour }} />
              {sector.label}
            </span>
          ))}
          <small>
            {model
              ? `${tagged} of ${model.buildings.length} heights tagged in OSM; ${estimated} estimated from footprint size.`
              : 'Colour comes from OSM building tags.'}
          </small>
        </aside>
      )}

      {mode === '3d' && (
        <>
          <div className="move-pad" aria-label="Movement pad">
            <button {...hold('forward', 1)} title="Forward">▲</button>
            <button {...hold('turn', -1)} title="Turn left"><Compass size={12} /></button>
            <button {...hold('forward', -1)} title="Back">▼</button>
            <button {...hold('strafe', -1)} title="Left">◀</button>
            <button {...hold('strafe', 1)} title="Right">▶</button>
            <button {...hold('lift', 1)} title="Climb">+</button>
            <button {...hold('lift', -1)} title="Descend">−</button>
          </div>
          <div className="move-hint">DRAG TO LOOK · W A S D MOVE · Q/E TURN · R/F CLIMB · ESC TO LEAVE</div>
        </>
      )}

      {mode === '3d' && inspect && built && (
        <div className="holo city-holo" style={{ left: inspect.x + 12, top: inspect.y + 12 }}>
          <div className="holo-head"><span>◈ CITY SCAN</span><span className="holo-coord">{city.name}</span></div>
          <div className="holo-body">
            {!inspect.info && <span className="holo-empty">Ground or road — no building here.</span>}
            {inspect.info && (
              <>
                <div className="holo-row"><b>{inspect.info.name ?? `${inspect.info.sector} building`}</b><span>{inspect.info.sector}</span></div>
                <div className="holo-row">
                  <b>Height</b>
                  <span>{inspect.info.estimated ? `≈${inspect.info.height} m · estimated` : `${inspect.info.height} m · OSM tag`}</span>
                </div>
              </>
            )}
          </div>
          <button className="holo-close" onClick={() => setInspect(null)}>×</button>
        </div>
      )}

      <div className="city-foot">
        <MapPin size={10} /> {city.name} · OSM footprints, heights, streets and place names · {mode === '3d' ? '3D massing is procedural, not photogrammetry' : 'click any place for details'}
      </div>

      {mode === '2d' && (
        <span className="city-2d-badge"><Move3d size={10} /> 3D MODEL PARKED · SWITCH TO 3D CITY</span>
      )}
    </div>
  )
}
