import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { GeoJSONSource, Map as MapLibreMap, StyleSpecification } from 'maplibre-gl'
import {
  Activity, AlertTriangle, ArrowLeft, ArrowUpRight, Bot, Building2, Camera, Car,
  ChevronDown, Database, Footprints, Globe2, Grid3x3, Layers3, MapPin, Plane, RefreshCw, Search,
  ShieldCheck, Sparkles, Thermometer, Waves, Wind, X,
} from 'lucide-react'
import type { AnalystResponse, Layer, Severity, Signal, Snapshot } from './types'
import { LANDMARKS, LANDMARK_BY_ID, type Landmark } from './landmarks'
import LandmarkViewer from './LandmarkViewer'
import AircraftViewer from './AircraftViewer'
import CityView, { type CityTarget } from './CityView'
import { addPlaneIcons, liveryFor } from './airlines'
import { DAM_BY_ID, damsGeoJSON } from './infrastructure'

const API = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'
const LAYER_ORDER: Layer[] = ['earthquake', 'alert', 'weather', 'air', 'flight']

const LAYER_META: Record<Layer, { label: string; short: string; colour: string; icon: typeof Activity }> = {
  earthquake: { label: 'Earthquakes', short: 'SEISMIC', colour: '#ff5c4d', icon: Activity },
  alert: { label: 'Disaster alerts', short: 'ALERTS', colour: '#ffb347', icon: AlertTriangle },
  weather: { label: 'Weather', short: 'WEATHER', colour: '#5ad1c8', icon: Thermometer },
  air: { label: 'Air quality', short: 'AIR', colour: '#c39bff', icon: Wind },
  flight: { label: 'Air traffic', short: 'FLIGHTS', colour: '#7ce7a4', icon: Plane },
}

const SEVERITY_COLOUR = ['match', ['get', 'severity'], 'critical', '#ff4d4d', 'high', '#ff8a3d', 'medium', '#ffd166', 'low', '#5ad1c8', '#7c93a8']

const MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    satellite: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      maxzoom: 19,
      attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
    },
    terrain: {
      type: 'raster-dem',
      tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
      encoding: 'terrarium',
      tileSize: 256,
      maxzoom: 15,
      attribution: 'Elevation © Mapzen / AWS Terrain Tiles',
    },
    relief: {
      type: 'raster-dem',
      tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
      encoding: 'terrarium',
      tileSize: 256,
      maxzoom: 15,
    },
    openmaptiles: {
      type: 'vector',
      url: 'https://tiles.openfreemap.org/planet',
    },
  },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': '#04101a' } },
    {
      id: 'satellite', type: 'raster', source: 'satellite',
      paint: { 'raster-saturation': 0.2, 'raster-contrast': 0.14, 'raster-fade-duration': 250 },
    },
    {
      id: 'terrain-relief', type: 'hillshade', source: 'relief',
      paint: {
        'hillshade-exaggeration': 0.4,
        'hillshade-shadow-color': '#03101c',
        'hillshade-highlight-color': '#dceeff',
        'hillshade-accent-color': '#0b2436',
      },
    },
    // Water bodies and waterways from the same vector tiles.
    {
      id: 'water', type: 'fill', source: 'openmaptiles', 'source-layer': 'water',
      paint: { 'fill-color': '#08283a', 'fill-opacity': 0.9 },
    },
    {
      id: 'waterway', type: 'line', source: 'openmaptiles', 'source-layer': 'waterway',
      paint: {
        'line-color': '#11536d',
        'line-width': ['interpolate', ['linear'], ['zoom'], 7, 0.6, 14, 3.2, 18, 7],
        'line-opacity': 0.85,
      },
    },
    // Airport infrastructure: runways and taxiways.
    {
      id: 'aeroway', type: 'line', source: 'openmaptiles', 'source-layer': 'aeroway',
      minzoom: 10,
      filter: ['in', ['get', 'class'], ['literal', ['runway', 'taxiway']]],
      paint: {
        'line-color': ['match', ['get', 'class'], 'runway', '#586572', '#3b4650'],
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.2, 14, 5, 18, 16],
        'line-opacity': 0.92,
      },
    },
    // Rail lines.
    {
      id: 'rail', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation',
      minzoom: 7,
      filter: ['==', ['get', 'class'], 'rail'],
      paint: {
        'line-color': '#3a4650',
        'line-width': ['interpolate', ['linear'], ['zoom'], 7, 0.5, 14, 1.6, 18, 3],
        'line-dasharray': [6, 4],
        'line-opacity': 0.8,
      },
    },
    // Tunnels first, so the road casing sits over them.
    {
      id: 'road-tunnel', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation',
      minzoom: 11,
      filter: ['all', ['==', ['get', 'brunnel'], 'tunnel'],
        ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary', 'secondary', 'tertiary']]]],
      paint: {
        'line-color': '#243542',
        'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.8, 16, 6, 18, 12],
        'line-dasharray': [2, 1.4],
        'line-opacity': 0.7,
      },
    },
    {
      id: 'road-casing', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation',
      minzoom: 9,
      filter: ['all', ['!=', ['get', 'brunnel'], 'tunnel'],
        ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary', 'secondary', 'tertiary']]]],
      paint: {
        'line-color': '#0b141b',
        'line-width': ['interpolate', ['linear'], ['zoom'], 9, 1.4, 13, 4.6, 16, 10, 18, 20],
        'line-opacity': 0.9,
      },
    },
    {
      id: 'road-fill', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation',
      minzoom: 9,
      filter: ['all', ['!=', ['get', 'brunnel'], 'tunnel'],
        ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary', 'secondary', 'tertiary']]]],
      paint: {
        'line-color': ['match', ['get', 'class'],
          'motorway', '#e3b169', 'trunk', '#dbab6b', 'primary', '#cbd2d8',
          'secondary', '#bcc4cb', 'tertiary', '#aeb7bf', '#a2acb5'],
        'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.7, 13, 3, 16, 7.4, 18, 15],
      },
    },
    // Bridges and flyovers: a shadow offset plus a bright deck reads as elevated.
    {
      id: 'road-bridge-shadow', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation',
      minzoom: 11,
      filter: ['all', ['==', ['get', 'brunnel'], 'bridge'],
        ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary', 'secondary', 'tertiary']]]],
      paint: {
        'line-color': '#02070b',
        'line-width': ['interpolate', ['linear'], ['zoom'], 11, 2, 15, 9, 18, 22],
        'line-opacity': 0.5,
        'line-translate': [3, 5],
        'line-translate-anchor': 'viewport',
      },
    },
    {
      id: 'road-bridge', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation',
      minzoom: 11,
      filter: ['all', ['==', ['get', 'brunnel'], 'bridge'],
        ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary', 'secondary', 'tertiary']]]],
      paint: {
        'line-color': ['match', ['get', 'class'],
          'motorway', '#f2c589', 'trunk', '#e8bd84', 'primary', '#e2e7ec',
          'secondary', '#d7dde3', 'tertiary', '#c9d1d8', '#c9d1d8'],
        'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1.2, 15, 6, 18, 14],
      },
    },
    // Local streets, drawn only when the camera is close enough to see them.
    {
      id: 'road-minor', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation',
      minzoom: 13,
      filter: ['in', ['get', 'class'], ['literal', ['minor', 'service', 'track']]],
      paint: {
        'line-color': '#38464f',
        'line-width': ['interpolate', ['linear'], ['zoom'], 13, 0.4, 16, 1.6, 18, 4.5],
        'line-opacity': 0.85,
      },
    },
    // Woodland canopy read as a low 3D mass instead of flat green fill.
    {
      id: 'landcover-wood', type: 'fill-extrusion', source: 'openmaptiles', 'source-layer': 'landcover',
      minzoom: 9,
      filter: ['in', ['get', 'class'], ['literal', ['wood', 'forest']]],
      paint: {
        'fill-extrusion-color': ['match', ['get', 'class'], 'wood', '#123a29', '#16452f'],
        'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 9, 0, 12, 5, 16, 13],
        'fill-extrusion-opacity': 0.6,
        'fill-extrusion-vertical-gradient': true,
      },
    },
    // Mountain peaks with their surveyed elevation.
    {
      id: 'peaks', type: 'symbol', source: 'openmaptiles', 'source-layer': 'mountain_peak',
      minzoom: 6,
      layout: {
        'text-field': ['concat', ['coalesce', ['get', 'name'], 'Peak'], ' ', ['to-string', ['round', ['coalesce', ['get', 'ele'], 0]]], ' m'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 6, 9, 12, 11],
        'text-font': ['Noto Sans Regular'],
        'text-allow-overlap': false,
        'text-padding': 4,
      },
      paint: { 'text-color': '#d8ece0', 'text-halo-color': '#07130d', 'text-halo-width': 1.3 },
    },
    {
      id: 'buildings-3d', type: 'fill-extrusion', source: 'openmaptiles', 'source-layer': 'building',
      minzoom: 13.6,
      filter: ['!=', ['get', 'hide_3d'], true],
      paint: {
        // Real mapped colours where OSM has them, otherwise concrete-to-glass
        // material tones sorted by height.
        'fill-extrusion-color': ['case',
          ['has', 'colour'], ['to-color', ['get', 'colour'], '#b6b1a8'],
          ['interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 10],
            0, '#9d998f', 8, '#b0aba1', 18, '#c1bcb2', 35, '#a9b3bc', 70, '#93a7b6', 130, '#b7c8d5'],
        ],
        // Clamp implausible heights (a few OSM footprints carry metres-as-feet
        // or stray huge values) and ignore elevated bases, which extrude as
        // floating slabs around complexes like the Taj Mahal.
        'fill-extrusion-height': ['min', 320, ['max', 3, ['coalesce', ['get', 'render_height'], 8]]],
        'fill-extrusion-base': 0,
        'fill-extrusion-opacity': 0.82,
        'fill-extrusion-vertical-gradient': true,
      },
    },
  ],
  terrain: { source: 'terrain', exaggeration: 1.3 },
}

type Overlays = { buildings: boolean; traffic: boolean; crowd: boolean; poi: boolean }
type InspectRow = { label: string; value: string }

const POI_CLASSES = {
  food: ['restaurant', 'fast_food', 'cafe', 'bar', 'pub', 'food_court', 'ice_cream', 'bakery'],
  lodging: ['hotel', 'hostel', 'guest_house', 'motel', 'lodging', 'apartment'],
  shop: ['shop', 'supermarket', 'convenience', 'mall', 'marketplace', 'clothes', 'clothing_store', 'department_store', 'grocery', 'butcher', 'hardware'],
  nature: ['park', 'garden', 'playground', 'beach', 'nature_reserve', 'viewpoint', 'picnic_site', 'campsite'],
  culture: ['museum', 'attraction', 'art_gallery', 'monument', 'memorial', 'theatre', 'cinema', 'place_of_worship', 'castle'],
  transport: ['bus', 'bus_station', 'railway', 'train', 'fuel', 'parking', 'ferry'],
  health: ['hospital', 'clinic', 'pharmacy', 'doctors', 'dentist'],
}

const POI_COLOURS: Record<string, string> = {}
for (const value of POI_CLASSES.food) POI_COLOURS[value] = '#ffb347'
for (const value of POI_CLASSES.lodging) POI_COLOURS[value] = '#c39bff'
for (const value of POI_CLASSES.shop) POI_COLOURS[value] = '#7ce7a4'
for (const value of POI_CLASSES.nature) POI_COLOURS[value] = '#58c98a'
for (const value of POI_CLASSES.culture) POI_COLOURS[value] = '#ffd166'
for (const value of POI_CLASSES.transport) POI_COLOURS[value] = '#8fb8ff'
for (const value of POI_CLASSES.health) POI_COLOURS[value] = '#ff8a8a'

const SENSORS = ['none', 'crt', 'nvg', 'flir', 'noir'] as const

const LANGUAGE_LABELS: Record<string, string> = {
  en: 'EN', Hindi: 'हिन्दी', Tamil: 'தமிழ்', Telugu: 'తెలుగు', Bengali: 'বাংলা',
  Malayalam: 'മലയാളം', Kannada: 'ಕನ್ನಡ', Gujarati: 'ગુજરાતી', Marathi: 'मराठी',
}

const POI_ALL = Object.values(POI_CLASSES).flat()
const POI_MATCH = ['match', ['get', 'class'], ...Object.entries(POI_COLOURS).flat(), '#9fb2c4']

/** Dashed heading ray for each aircraft, used to show where it is travelling. */
function flightTracks(signals: Signal[]) {
  const features = [] as { type: 'Feature'; geometry: { type: 'LineString'; coordinates: number[][] }; properties: Record<string, unknown> }[]
  for (const signal of signals) {
    if (signal.layer !== 'flight' || signal.lat === null || signal.lng === null) continue
    const heading = Number(signal.metrics.heading_deg ?? NaN)
    if (!Number.isFinite(heading)) continue
    const speed = Number(signal.metrics.speed_kmh ?? 0)
    const distanceKm = Math.min(180, Math.max(25, speed * 0.12))
    const theta = (heading * Math.PI) / 180
    const north = Math.cos(theta) * distanceKm
    const east = Math.sin(theta) * distanceKm
    const endLat = signal.lat + north / 111
    const endLng = signal.lng + east / (111 * Math.cos((signal.lat * Math.PI) / 180))
    features.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: [[signal.lng, signal.lat], [endLng, endLat]] },
      properties: { id: signal.id },
    })
  }
  return { type: 'FeatureCollection' as const, features }
}

const INSPECT_LAYERS = [
  'buildings-3d', 'road-bridge', 'road-fill', 'road-minor', 'road-tunnel', 'water',
  'waterway', 'aeroway', 'rail', 'lyr-dam', 'lyr-landmark', 'lyr-tower', 'lyr-flight',
]

function addTowerIcon(map: MapLibreMap) {
  if (map.hasImage('tower')) return
  const size = 48
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (!context) return
  context.strokeStyle = '#7fe3ff'
  context.lineWidth = 2
  context.beginPath()
  context.moveTo(24, 8)
  context.lineTo(17, 40)
  context.moveTo(24, 8)
  context.lineTo(31, 40)
  context.stroke()
  context.beginPath()
  context.moveTo(18.5, 30)
  context.lineTo(29.5, 30)
  context.moveTo(20.5, 22)
  context.lineTo(27.5, 22)
  context.stroke()
  context.fillStyle = '#d9f7ff'
  context.beginPath()
  context.arc(24, 8, 2.6, 0, Math.PI * 2)
  context.fill()
  context.strokeStyle = 'rgba(127, 227, 255, 0.8)'
  context.lineWidth = 1.6
  for (const radius of [5, 9]) {
    context.beginPath()
    context.arc(24, 9, radius, -Math.PI * 0.82, -Math.PI * 0.18)
    context.stroke()
  }
  map.addImage('tower', context.getImageData(0, 0, size, size), { pixelRatio: 2 })
}

/** What is under this pixel, described for the hologram overlay. */
function describeFeatures(map: MapLibreMap, x: number, y: number): InspectRow[] {
  const layers = INSPECT_LAYERS.filter((id) => map.getLayer(id))
  if (!layers.length) return []
  const rows: InspectRow[] = []
  const seen = new Set<string>()
  for (const feature of map.queryRenderedFeatures([x, y], { layers })) {
    const properties = feature.properties ?? {}
    const layerId = feature.layer.id
    let label = ''
    let value = ''
    if (layerId === 'buildings-3d') {
      const height = Math.round(Number(properties.render_height ?? properties.height ?? 0))
      label = String(properties.name ?? 'Building')
      value = `${height > 0 ? `${height} m tall` : 'height unmapped'}${properties.class ? ` · ${properties.class}` : ''}`
    } else if (layerId.startsWith('road-')) {
      const kind = String(properties.class ?? 'road')
      label = String(properties.name ?? properties.ref ?? `${kind} road`)
      value = `${kind}${properties.brunnel ? ` · ${properties.brunnel}` : ''}${properties.lanes ? ` · ${properties.lanes} lanes` : ''}`
    } else if (layerId === 'water') {
      label = String(properties.name ?? 'Water body')
      value = String(properties.class ?? 'water')
    } else if (layerId === 'waterway') {
      label = String(properties.name ?? 'Waterway')
      value = String(properties.class ?? 'waterway')
    } else if (layerId === 'aeroway') {
      label = String(properties.name ?? properties.ref ?? 'Airport surface')
      value = String(properties.class ?? 'aeroway')
    } else if (layerId === 'rail') {
      label = String(properties.name ?? 'Railway line')
      value = 'rail'
    } else if (layerId === 'lyr-dam') {
      label = String(properties.name ?? 'Dam')
      value = `dam · ${Math.round(Number(properties.height ?? 0))} m`
    } else if (layerId === 'lyr-landmark') {
      label = String(properties.name ?? 'Landmark')
      value = 'landmark · click for the 360° panel'
    } else if (layerId === 'lyr-flight') {
      label = String(properties.title ?? 'Aircraft')
      const heading = Math.round(Number(properties.heading ?? 0))
      value = `aircraft · hdg ${heading}° · ${Math.round(Number(properties.altitude ?? 0))} m`
    } else if (layerId === 'lyr-tower') {
      label = String(properties.name ?? 'Mobile network tower')
      value = 'communications tower · click for coverage rings'
    }
    if (!label) continue
    const key = `${label}|${value}`
    if (seen.has(key)) continue
    seen.add(key)
    rows.push({ label, value })
    if (rows.length >= 5) break
  }
  return rows
}

function toFeatureCollection(signals: Signal[]) {
  return {
    type: 'FeatureCollection' as const,
    features: signals
      .filter((signal) => signal.lat !== null && signal.lng !== null)
      .map((signal) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [signal.lng as number, signal.lat as number] },
        properties: {
          id: signal.id,
          layer: signal.layer,
          severity: signal.severity,
          magnitude: Number(signal.metrics.magnitude ?? 0),
          title: signal.title,
          heading: Number(signal.metrics.heading_deg ?? 0),
          altitude: Number(signal.metrics.altitude_m ?? 0),
          airlineCode: signal.layer === 'flight' ? liveryFor(signal.title).code : 'UNK',
        },
      })),
  }
}

function MapCanvas({ signals, activeLayers, selectedId, overlays, mode, focus, drone, walk, globe, selectedLandmarkId, asciiMode, onSelectSignal, onSelectLandmark, onSelectDam, onSelectCity, onPick }: {
  signals: Signal[]
  activeLayers: Layer[]
  selectedId: string | null
  overlays: Overlays
  mode: '2d' | '3d'
  focus: [number, number]
  drone: boolean
  walk: boolean
  globe: boolean
  selectedLandmarkId: string | null
  asciiMode: boolean
  onSelectSignal: (id: string) => void
  onSelectLandmark: (id: string) => void
  onSelectDam: (id: string) => void
  onSelectCity: (city: CityTarget) => void
  onPick: (lat: number, lng: number) => void
}) {
  const container = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const handlers = useRef({ onSelectSignal, onSelectLandmark, onSelectDam, onSelectCity, onPick })
  handlers.current = { onSelectSignal, onSelectLandmark, onSelectDam, onSelectCity, onPick }
  const [ready, setReady] = useState(false)
  const [ascii, setAscii] = useState<{ lines: string[]; coords: string } | null>(null)
  const [orbit, setOrbit] = useState(true)
  const orbitRef = useRef(true)
  const orbitPauseRef = useRef(0)
  const [hud, setHud] = useState({ zoom: 0, bearing: 0 })
  const [walkHud, setWalkHud] = useState({ lat: 0, lng: 0, heading: 0, moving: false, distance: 0 })
  const [inspect, setInspect] = useState<{ lng: number; lat: number; x: number; y: number; rows: InspectRow[] } | null>(null)
  const exaggerationRef = useRef(1.3)
  orbitRef.current = orbit

  useEffect(() => {
    if (!container.current || mapRef.current) return
    const map = new maplibregl.Map({
      container: container.current,
      style: MAP_STYLE,
      center: [78.9, 22.4],
      zoom: 4.1,
      pitch: 50,
      bearing: -8,
      minZoom: 2.6,
      maxZoom: 18,
      maxPitch: 80,
      canvasContextAttributes: { preserveDrawingBuffer: true },
      attributionControl: false,
    })
    mapRef.current = map
    if (import.meta.env.DEV) (window as unknown as { __map?: MapLibreMap }).__map = map
    map.on('error', (event) => console.error('MAP ERROR', event.error?.message ?? event))
    map.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }), 'bottom-right')
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')
    map.on('load', () => {
      map.resize()
      addPlaneIcons(map)
      addTowerIcon(map)
      map.setSky({
        'sky-color': '#0a2033', 'horizon-color': '#2b5673', 'fog-color': '#08131d',
        'sky-horizon-blend': 0.6, 'horizon-fog-blend': 0.6, 'fog-ground-blend': 0.45,
        'atmosphere-blend': 0.7,
      })
      setReady(true)
    })
    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const element = container.current
    const map = mapRef.current
    if (!element || !map) return
    const observer = new ResizeObserver(() => map.resize())
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const waveRef = useRef<(() => void) | null>(null)

  // Expanding coverage rings from a clicked tower; purely indicative.
  const startWave = (lng: number, lat: number) => {
    const map = mapRef.current
    const source = map?.getSource('waves') as GeoJSONSource | undefined
    if (!source) return
    waveRef.current?.()
    const started = performance.now()
    let frame = 0
    const tick = (time: number) => {
      const elapsed = (time - started) / 1000
      if (elapsed > 8) {
        source.setData({ type: 'FeatureCollection', features: [] })
        waveRef.current = null
        return
      }
      const rings = [0, 1, 2].map((index) => {
        const phase = ((elapsed * 0.5) + index / 3) % 1
        return {
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [lng, lat] as [number, number] },
          properties: { id: index, r: 5 + phase * 110, o: (1 - phase) * 0.55 },
        }
      })
      source.setData({ type: 'FeatureCollection', features: rings })
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    waveRef.current = () => cancelAnimationFrame(frame)
  }

  useEffect(() => () => { waveRef.current?.() }, [])

  useEffect(() => {
    if (!ready) return
    const map = mapRef.current
    if (!map) return
    if (map.getSource('signals')) {
      ;(map.getSource('signals') as GeoJSONSource).setData(toFeatureCollection(signals))
      const tracks = map.getSource('flight-tracks') as GeoJSONSource | undefined
      if (tracks) tracks.setData(flightTracks(signals) as never)
      return
    }
    map.addSource('signals', { type: 'geojson', data: toFeatureCollection(signals) })
    map.addSource('landmarks', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: LANDMARKS.map((landmark) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [landmark.lng, landmark.lat] },
          properties: { id: landmark.id, name: landmark.name },
        })),
      },
    })
    map.addSource('traffic', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
    map.addSource('crowd', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
    map.addSource('picked', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
    map.addSource('dams', { type: 'geojson', data: damsGeoJSON() })
    map.addSource('waves', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
    map.addSource('towers', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
    map.addSource('flight-tracks', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })

    map.addLayer({
      id: 'lyr-flight', type: 'symbol', source: 'signals', filter: ['==', ['get', 'layer'], 'flight'],
      layout: {
        'icon-image': ['concat', 'plane-', ['get', 'airlineCode']],
        'icon-size': ['interpolate', ['linear'], ['zoom'], 3, 0.5, 8, 0.8, 13, 1.2],
        'icon-rotate': ['get', 'heading'],
        'icon-rotation-alignment': 'map',
        'icon-pitch-alignment': 'viewport',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'symbol-sort-key': ['get', 'altitude'],
      },
    })
    map.addLayer({
      id: 'lyr-weather', type: 'circle', source: 'signals', filter: ['==', ['get', 'layer'], 'weather'],
      paint: {
        'circle-radius': 5, 'circle-color': LAYER_META.weather.colour, 'circle-opacity': 0.9,
        'circle-stroke-width': 1, 'circle-stroke-color': '#eafcff',
      },
    })
    map.addLayer({
      id: 'lyr-air', type: 'circle', source: 'signals', filter: ['==', ['get', 'layer'], 'air'],
      paint: {
        'circle-radius': 6, 'circle-color': LAYER_META.air.colour, 'circle-opacity': 0.7,
        'circle-stroke-width': 1, 'circle-stroke-color': '#efe6ff',
      },
    })
    map.addLayer({
      id: 'lyr-alert', type: 'circle', source: 'signals', filter: ['==', ['get', 'layer'], 'alert'],
      paint: {
        'circle-radius': 9, 'circle-color': SEVERITY_COLOUR as never, 'circle-opacity': 0.55,
        'circle-stroke-width': 1.5, 'circle-stroke-color': '#ffe6b8',
      },
    })
    map.addLayer({
      id: 'lyr-earthquake', type: 'circle', source: 'signals', filter: ['==', ['get', 'layer'], 'earthquake'],
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['get', 'magnitude'], 2.5, 5, 6, 14],
        'circle-color': SEVERITY_COLOUR as never, 'circle-opacity': 0.85,
        'circle-stroke-width': 1.5, 'circle-stroke-color': '#ffe1dc',
      },
    })
    map.addLayer({
      id: 'lyr-crowd', type: 'circle', source: 'crowd',
      paint: {
        'circle-radius': ['get', 'size'], 'circle-color': '#ffd166', 'circle-opacity': 0.32,
        'circle-blur': 0.6,
      },
    })
    map.addLayer({
      id: 'lyr-traffic', type: 'circle', source: 'traffic',
      paint: {
        'circle-radius': ['match', ['get', 'mode'], 'bus', 3.4, 'auto', 2.4, 2],
        'circle-color': ['match', ['get', 'mode'], 'bus', '#ff8a3d', 'auto', '#7ce7a4', '#ffd166'],
        'circle-opacity': 0.95, 'circle-stroke-width': 0.6, 'circle-stroke-color': '#04120b',
      },
    })
    map.addLayer({
      id: 'lyr-selected', type: 'circle', source: 'signals', filter: ['==', ['get', 'id'], '__none__'],
      paint: {
        'circle-radius': 15, 'circle-color': 'rgba(0,0,0,0)',
        'circle-stroke-width': 2, 'circle-stroke-color': '#33e08a',
      },
    })
    map.addLayer({
      id: 'lyr-landmark', type: 'circle', source: 'landmarks',
      paint: {
        'circle-radius': 6.5, 'circle-color': '#111b17', 'circle-opacity': 0.9,
        'circle-stroke-width': 2, 'circle-stroke-color': '#ffd166',
      },
    })
    map.addLayer({
      id: 'lyr-landmark-selected', type: 'circle', source: 'landmarks', filter: ['==', ['get', 'id'], '__none__'],
      paint: {
        'circle-radius': 12, 'circle-color': 'rgba(0,0,0,0)',
        'circle-stroke-width': 2, 'circle-stroke-color': '#ffd166',
      },
    })
    map.addLayer({
      id: 'lyr-dam', type: 'circle', source: 'dams',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 2.6, 10, 4.6, 16, 7],
        'circle-color': '#4fb0d8', 'circle-opacity': 0.9,
        'circle-stroke-width': 1.4, 'circle-stroke-color': '#e8fcff',
      },
    })
    map.addLayer({
      id: 'lyr-dam-label', type: 'symbol', source: 'dams', minzoom: 5.4,
      layout: {
        'text-field': ['get', 'name'], 'text-size': 10, 'text-offset': [0, 1.1],
        'text-anchor': 'top', 'text-font': ['Noto Sans Regular'],
      },
      paint: { 'text-color': '#cfeaf6', 'text-halo-color': '#04121b', 'text-halo-width': 1.3 },
    })
    // Mobile network towers, with animated coverage rings on click.
    map.addLayer({
      id: 'lyr-waves', type: 'circle', source: 'waves',
      paint: {
        'circle-radius': ['get', 'r'],
        'circle-color': '#7fe3ff',
        'circle-opacity': ['get', 'o'],
        'circle-stroke-width': 1.4,
        'circle-stroke-color': '#d9f7ff',
        'circle-stroke-opacity': ['get', 'o'],
      },
    })
    map.addLayer({
      id: 'lyr-tower', type: 'symbol', source: 'towers', minzoom: 11,
      layout: {
        'icon-image': 'tower',
        'icon-size': ['interpolate', ['linear'], ['zoom'], 11, 0.7, 16, 1.25],
        'icon-allow-overlap': true,
        'text-field': ['coalesce', ['get', 'name'], 'Tower'],
        'text-size': 9,
        'text-offset': [0, 1.7],
        'text-font': ['Noto Sans Regular'],
        'text-optional': true,
      },
      paint: { 'text-color': '#bff2ff', 'text-halo-color': '#04121b', 'text-halo-width': 1.2 },
    })

    // Points of interest: food, lodging, shops, parks and beaches, culture,
    // transport and health, straight from the OSM poi layer.
    map.addLayer({
      id: 'lyr-poi', type: 'circle', source: 'openmaptiles', 'source-layer': 'poi', minzoom: 13,
      filter: ['in', ['get', 'class'], ['literal', POI_ALL]],
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 2.4, 17, 4.8],
        'circle-color': POI_MATCH as never,
        'circle-opacity': 0.92,
        'circle-stroke-width': 1,
        'circle-stroke-color': '#04121b',
      },
    })
    map.addLayer({
      id: 'lyr-poi-label', type: 'symbol', source: 'openmaptiles', 'source-layer': 'poi', minzoom: 14.4,
      filter: ['all', ['in', ['get', 'class'], ['literal', POI_ALL]], ['has', 'name']],
      layout: {
        'text-field': ['get', 'name'],
        'text-size': 10,
        'text-font': ['Noto Sans Regular'],
        'text-offset': [0, 1.2],
        'text-anchor': 'top',
        'text-optional': true,
        'text-padding': 2,
      },
      paint: { 'text-color': '#e8f4ff', 'text-halo-color': '#04121b', 'text-halo-width': 1.2 },
    })

    // City and town labels double as the entry point to the full city page view.
    map.addLayer({
      id: 'lyr-place', type: 'symbol', source: 'openmaptiles', 'source-layer': 'place', minzoom: 4,
      filter: ['in', ['get', 'class'], ['literal', ['city', 'town']]],
      layout: {
        'text-field': ['coalesce', ['get', 'name:latin'], ['get', 'name']],
        'text-size': ['interpolate', ['linear'], ['zoom'], 4, 11, 8, 13, 12, 15],
        'text-font': ['Noto Sans Regular'],
        'text-letter-spacing': 0.08,
      },
      paint: { 'text-color': '#eaf6ff', 'text-halo-color': '#04121b', 'text-halo-width': 1.6 },
    })

    // Projected track for the selected aircraft (heading ray, not a filed route).
    map.addLayer({
      id: 'lyr-flight-track', type: 'line', source: 'flight-tracks',
      paint: {
        'line-color': '#7ce7a4', 'line-width': 1.6, 'line-opacity': 0.7,
        'line-dasharray': [3, 2],
      },
    })
    map.addLayer({
      id: 'lyr-picked', type: 'circle', source: 'picked',
      paint: {
        'circle-radius': 5, 'circle-color': '#33e08a', 'circle-stroke-width': 2,
        'circle-stroke-color': '#04120b',
      },
    })

    for (const id of ['lyr-flight', 'lyr-weather', 'lyr-air', 'lyr-alert', 'lyr-earthquake']) {
      map.on('click', id, (event) => {
        const feature = event.features?.[0]
        if (feature?.properties?.id) handlers.current.onSelectSignal(String(feature.properties.id))
      })
      map.on('mouseenter', id, () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', id, () => { map.getCanvas().style.cursor = '' })
    }
    map.on('click', 'lyr-landmark', (event) => {
      const feature = event.features?.[0]
      if (feature?.properties?.id) handlers.current.onSelectLandmark(String(feature.properties.id))
    })
    map.on('mouseenter', 'lyr-landmark', () => { map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', 'lyr-landmark', () => { map.getCanvas().style.cursor = '' })
    map.on('click', 'lyr-dam', (event) => {
      const feature = event.features?.[0]
      if (feature?.properties?.id) handlers.current.onSelectDam(String(feature.properties.id))
    })
    map.on('mouseenter', 'lyr-dam', () => { map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', 'lyr-dam', () => { map.getCanvas().style.cursor = '' })

    map.on('click', 'lyr-tower', (event) => {
      const feature = event.features?.[0]
      if (!feature) return
      const lng = event.lngLat.lng
      const lat = event.lngLat.lat
      startWave(lng, lat)
      setInspect({
        lng, lat, x: event.point.x, y: event.point.y,
        rows: [
          { label: String(feature.properties?.name ?? 'Mobile network tower'), value: 'communications tower' },
          { label: 'Coverage rings', value: 'indicative visualisation — not measured signal strength' },
        ],
      })
    })
    map.on('mouseenter', 'lyr-tower', () => { map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', 'lyr-tower', () => { map.getCanvas().style.cursor = '' })

    map.on('click', 'lyr-place', (event) => {
      const feature = event.features?.[0]
      const name = String(feature?.properties?.name ?? '')
      const coordinates = (feature?.geometry as { coordinates?: [number, number] } | undefined)?.coordinates
      if (!name || !coordinates) return
      handlers.current.onSelectCity({ name, lng: coordinates[0], lat: coordinates[1] })
    })
    map.on('mouseenter', 'lyr-place', () => { map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', 'lyr-place', () => { map.getCanvas().style.cursor = '' })

    // Click anywhere: describe whatever the style is drawing under the cursor.
    map.on('click', (event) => {
      setInspect({
        lng: event.lngLat.lng,
        lat: event.lngLat.lat,
        x: event.point.x,
        y: event.point.y,
        rows: describeFeatures(map, event.point.x, event.point.y),
      })
    })
  }, [ready, signals])

  useEffect(() => {
    if (!ready) return
    const map = mapRef.current
    if (!map) return
    for (const layer of LAYER_ORDER) {
      const id = `lyr-${layer}`
      if (!map.getLayer(id)) continue
      map.setFilter(id, activeLayers.includes(layer) ? ['==', ['get', 'layer'], layer] : ['==', ['get', 'layer'], '__off__'])
    }
  }, [ready, activeLayers])

  useEffect(() => {
    if (!ready) return
    const map = mapRef.current
    if (!map) return
    if (map.getLayer('lyr-selected')) map.setFilter('lyr-selected', ['==', ['get', 'id'], selectedId ?? '__none__'])
    if (map.getLayer('lyr-landmark-selected')) {
      map.setFilter('lyr-landmark-selected', ['==', ['get', 'id'], selectedLandmarkId ?? '__none__'])
    }
    if (map.getLayer('lyr-flight-track')) {
      map.setFilter('lyr-flight-track', ['==', ['get', 'id'], selectedId ?? '__none__'])
    }
    // Do not move the camera while walking or flying a drone: the snapshot
    // refresh re-runs this effect and would yank the view off the street.
    if (walk || drone) return
    const selected = signals.find((signal) => signal.id === selectedId)
    if (selected && selected.lat !== null && selected.lng !== null) {
      // An aircraft needs context for its track, so ease out rather than keep a
      // street-level zoom from a previous place.
      const zoom = selected.layer === 'flight'
        ? Math.min(Math.max(map.getZoom(), 6), 9.5)
        : Math.max(map.getZoom(), 5.2)
      map.easeTo({ center: [selected.lng, selected.lat], zoom, duration: 800 })
    }
  }, [ready, selectedId, selectedLandmarkId, signals, walk, drone])

  useEffect(() => {
    if (!ready) return
    const map = mapRef.current
    if (!map) return
    if (mode === '3d') {
      map.setTerrain({ source: 'terrain', exaggeration: exaggerationRef.current })
      map.easeTo({ pitch: 50, bearing: -8, duration: 700 })
    } else {
      map.setTerrain(null)
      map.easeTo({ pitch: 0, bearing: 0, duration: 700 })
    }
  }, [ready, mode])

  // The DEM is roughly 90 m per cell. At street zoom a strong vertical
  // exaggeration lifts roads and building bases off the ground and bends them,
  // so ease it off as the camera descends.
  useEffect(() => {
    if (!ready) return
    const map = mapRef.current
    if (!map) return
    const apply = () => {
      const zoom = map.getZoom()
      const target = zoom >= 12 ? 0.85 : zoom >= 9 ? 1.05 : 1.3
      if (Math.abs(target - exaggerationRef.current) < 0.01) return
      exaggerationRef.current = target
      map.setTerrain({ source: 'terrain', exaggeration: target })
    }
    apply()
    let timer = 0
    const onZoom = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(apply, 240)
    }
    map.on('zoom', onZoom)
    return () => {
      window.clearTimeout(timer)
      map.off('zoom', onZoom)
    }
  }, [ready])

  // Globe projection with live precipitation radar for the planet-scale view.
  useEffect(() => {
    if (!ready) return
    const map = mapRef.current
    if (!map) return
    map.setProjection({ type: globe ? 'globe' : 'mercator' })
    if (!globe) {
      if (map.getLayer('radar')) map.setLayoutProperty('radar', 'visibility', 'none')
      map.easeTo({ pitch: 50, zoom: Math.max(map.getZoom(), 3.4), bearing: -8, duration: 900 })
      if (mode === '3d') map.setTerrain({ source: 'terrain', exaggeration: exaggerationRef.current })
      return
    }
    map.setTerrain(null)
    map.easeTo({ pitch: 0, zoom: 2.3, bearing: 0, duration: 1200 })
    if (map.getLayer('radar')) {
      map.setLayoutProperty('radar', 'visibility', 'visible')
      return
    }
    let cancelled = false
    fetch('https://api.rainviewer.com/public/weather-maps.json')
      .then((response) => response.json())
      .then((body) => {
        if (cancelled || map.getSource('radar')) return
        const frames = body?.radar?.past ?? []
        const latest = frames[frames.length - 1]
        if (!latest || !body.host) return
        map.addSource('radar', {
          type: 'raster',
          tiles: [`${body.host}${latest.path}/256/{z}/{x}/{y}/2/1_1.png`],
          tileSize: 256,
          attribution: 'Radar © RainViewer',
        })
        map.addLayer({ id: 'radar', type: 'raster', source: 'radar', paint: { 'raster-opacity': 0.5 } })
      })
      .catch(() => { /* radar is optional */ })
    return () => { cancelled = true }
  }, [ready, globe, mode])

  // Communication towers live in OSM but not in the vector tiles, so ask the API
  // (which proxies Overpass) for the current viewport whenever the map settles.
  useEffect(() => {
    if (!ready) return
    const map = mapRef.current
    if (!map) return
    const source = map.getSource('towers') as GeoJSONSource | undefined
    if (!source) return

    let timer = 0
    let controller: AbortController | null = null
    let lastFetch = 0
    const load = async () => {
      if (map.getZoom() < 11.5) {
        source.setData({ type: 'FeatureCollection', features: [] })
        return
      }
      const now = performance.now()
      if (now - lastFetch < 4000) return
      lastFetch = now
      const bounds = map.getBounds()
      const params = new URLSearchParams({
        west: bounds.getWest().toFixed(4),
        south: bounds.getSouth().toFixed(4),
        east: bounds.getEast().toFixed(4),
        north: bounds.getNorth().toFixed(4),
      })
      controller?.abort()
      controller = new AbortController()
      try {
        const response = await fetch(`${API}/api/v1/towers?${params.toString()}`, { signal: controller.signal })
        if (!response.ok) return
        const body = await response.json()
        source.setData(body as never)
      } catch {
        /* aborted, offline or rate-limited: keep whatever is drawn */
      }
    }
    const schedule = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => void load(), 450)
    }
    map.on('moveend', schedule)
    schedule()
    return () => {
      window.clearTimeout(timer)
      controller?.abort()
      map.off('moveend', schedule)
    }
  }, [ready])

  // Drone camera: low-altitude pitched view that orbits the focused place 360°.
  useEffect(() => {
    if (!ready || !drone) return
    const map = mapRef.current
    if (!map) return
    map.easeTo({
      pitch: 68,
      zoom: Math.max(map.getZoom(), 15.2),
      center: focus,
      duration: 1200,
    })
    let frame = 0
    let paused = false
    let orbiting = false
    let resumeTimer = 0
    // Wait for the descent animation before orbiting: setBearing cancels an
    // in-flight ease, which would leave the camera at country altitude.
    const startTimer = window.setTimeout(() => { orbiting = true }, 1350)
    const pause = () => {
      paused = true
      window.clearTimeout(resumeTimer)
      resumeTimer = window.setTimeout(() => { paused = false }, 3000)
    }
    map.on('mousedown', pause)
    map.on('touchstart', pause)
    map.on('wheel', pause)
    const tick = () => {
      frame = requestAnimationFrame(tick)
      if (orbiting && !paused && orbitRef.current && performance.now() > orbitPauseRef.current) {
        map.setBearing(map.getBearing() + 0.12)
      }
    }
    tick()
    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(resumeTimer)
      window.clearTimeout(startTimer)
      map.off('mousedown', pause)
      map.off('touchstart', pause)
      map.off('wheel', pause)
    }
  }, [ready, drone, focus])

  useEffect(() => {
    if (!ready || !drone) return
    const map = mapRef.current
    if (!map) return
    const update = () => setHud({ zoom: map.getZoom(), bearing: map.getBearing() })
    update()
    const timer = setInterval(update, 250)
    return () => clearInterval(timer)
  }, [ready, drone])

  // Street-level walk mode: WASD / arrow keys move the camera at human speed
  // over the satellite and 3D building layers, Shift jogs.
  useEffect(() => {
    if (!ready || !walk) return
    const map = mapRef.current
    if (!map) return
    map.easeTo({ center: focus, zoom: Math.max(map.getZoom(), 17.6), pitch: 78, bearing: 0, duration: 1100 })
    const start = map.getCenter()
    setWalkHud({ lat: start.lat, lng: start.lng, heading: 0, moving: false, distance: 0 })

    const pressed = new Set<string>()
    const keys = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift']
    const isField = (target: EventTarget | null) =>
      target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
    const onKeyDown = (event: KeyboardEvent) => {
      if (isField(event.target)) return
      const key = event.key.toLowerCase()
      if (!keys.includes(key)) return
      pressed.add(key)
      event.preventDefault()
    }
    const onKeyUp = (event: KeyboardEvent) => pressed.delete(event.key.toLowerCase())
    const onBlur = () => pressed.clear()
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)

    let distance = 0
    let last = performance.now()
    let sample = 0
    let frame = 0
    const tick = (time: number) => {
      frame = requestAnimationFrame(tick)
      const seconds = Math.min(0.12, (time - last) / 1000)
      last = time
      const forward = (pressed.has('w') || pressed.has('arrowup') ? 1 : 0)
        - (pressed.has('s') || pressed.has('arrowdown') ? 1 : 0)
      const strafe = (pressed.has('d') || pressed.has('arrowright') ? 1 : 0)
        - (pressed.has('a') || pressed.has('arrowleft') ? 1 : 0)
      const moving = forward !== 0 || strafe !== 0
      if (moving) {
        const speed = pressed.has('shift') ? 6 : 1.5
        const bearing = (map.getBearing() * Math.PI) / 180
        const north = (Math.cos(bearing) * forward - Math.sin(bearing) * strafe) * speed * seconds
        const east = (Math.sin(bearing) * forward + Math.cos(bearing) * strafe) * speed * seconds
        const center = map.getCenter()
        map.setCenter([
          center.lng + east / (111320 * Math.cos((center.lat * Math.PI) / 180)),
          center.lat + north / 111320,
        ])
        distance += speed * seconds
      }
      sample += 1
      if (sample % 6 === 0) {
        const center = map.getCenter()
        setWalkHud({
          lat: center.lat,
          lng: center.lng,
          heading: ((map.getBearing() % 360) + 360) % 360,
          moving,
          distance,
        })
      }
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      pressed.clear()
    }
  }, [ready, walk, focus])

  // Keep the hologram pinned to its coordinate while the map moves.
  useEffect(() => {
    if (!ready || !inspect) return
    const map = mapRef.current
    if (!map) return
    const lng = inspect.lng
    const lat = inspect.lat
    const reposition = () => {
      const point = map.project([lng, lat])
      setInspect((current) => (current ? { ...current, x: point.x, y: point.y } : current))
    }
    map.on('move', reposition)
    return () => { map.off('move', reposition) }
  }, [ready, inspect?.lng, inspect?.lat])

  const nudgeBearing = (delta: number) => {
    const map = mapRef.current
    if (!map) return
    setOrbit(false)
    map.easeTo({ bearing: map.getBearing() + delta, duration: 450 })
  }

  const nudgeZoom = (delta: number) => {
    const map = mapRef.current
    if (!map) return
    // Pause the orbit so setBearing does not cancel this ease on the next frame.
    orbitPauseRef.current = performance.now() + 1500
    map.easeTo({ zoom: map.getZoom() + delta, duration: 450 })
  }

  useEffect(() => {
    if (!ready) return
    const map = mapRef.current
    if (!map || !map.getLayer('buildings-3d')) return
    map.setLayoutProperty('buildings-3d', 'visibility', overlays.buildings ? 'visible' : 'none')
  }, [ready, overlays.buildings])

  useEffect(() => {
    if (!ready) return
    const map = mapRef.current
    if (!map) return
    for (const id of ['lyr-poi', 'lyr-poi-label']) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', overlays.poi ? 'visible' : 'none')
    }
  }, [ready, overlays.poi])

  // Simulated traffic: vehicles circulating around the focused city.
  useEffect(() => {
    if (!ready) return
    const map = mapRef.current
    if (!map || !map.getLayer('lyr-traffic')) return
    map.setLayoutProperty('lyr-traffic', 'visibility', overlays.traffic ? 'visible' : 'none')
    if (!overlays.traffic) return

    const source = map.getSource('traffic') as GeoJSONSource | undefined
    if (!source) return
    const [lng, lat] = focus
    const vehicles = Array.from({ length: 70 }, (_, index) => ({
      angle: (index / 70) * Math.PI * 2 + Math.random(),
      radius: 0.012 + Math.random() * 0.05,
      speed: 0.006 + Math.random() * 0.012,
      mode: index % 9 === 0 ? 'bus' : index % 3 === 0 ? 'auto' : 'car',
    }))
    let frame = 0
    let last = 0
    const animate = (time: number) => {
      frame = requestAnimationFrame(animate)
      if (time - last < 90) return
      last = time
      source.setData({
        type: 'FeatureCollection',
        features: vehicles.map((vehicle, index) => {
          vehicle.angle += vehicle.speed * 0.12
          const latitude = lat + Math.sin(vehicle.angle) * vehicle.radius * 0.72
          const longitude = lng + Math.cos(vehicle.angle) * vehicle.radius
          return {
            type: 'Feature' as const,
            geometry: { type: 'Point' as const, coordinates: [longitude, latitude] },
            properties: { id: `veh-${index}`, mode: vehicle.mode },
          }
        }),
      })
    }
    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [ready, overlays.traffic, focus])

  // Simulated crowd: pulsing density near the focused place.
  useEffect(() => {
    if (!ready) return
    const map = mapRef.current
    if (!map || !map.getLayer('lyr-crowd')) return
    map.setLayoutProperty('lyr-crowd', 'visibility', overlays.crowd ? 'visible' : 'none')
    if (!overlays.crowd) return

    const source = map.getSource('crowd') as GeoJSONSource | undefined
    if (!source) return
    const [lng, lat] = focus
    source.setData({
      type: 'FeatureCollection',
      features: Array.from({ length: 110 }, (_, index) => {
        const angle = Math.random() * Math.PI * 2
        const radius = Math.random() * 0.02
        return {
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [lng + Math.cos(angle) * radius, lat + Math.sin(angle) * radius * 0.7] },
          properties: { id: `crowd-${index}`, size: 6 + Math.random() * 18 },
        }
      }),
    })
    let frame = 0
    const start = performance.now()
    const pulse = () => {
      frame = requestAnimationFrame(pulse)
      const phase = (Math.sin((performance.now() - start) / 520) + 1) / 2
      map.setPaintProperty('lyr-crowd', 'circle-opacity', 0.18 + phase * 0.2)
    }
    pulse()
    return () => cancelAnimationFrame(frame)
  }, [ready, overlays.crowd, focus])

  useEffect(() => {
    if (!ready || drone) return
    const map = mapRef.current
    if (!map) return
    map.easeTo({ center: focus, zoom: Math.max(map.getZoom(), 5.6), duration: 900 })
  }, [ready, focus, drone])

  // ASCII projection of the rendered map; click a cell to locate that point.
  useEffect(() => {
    if (!asciiMode || !ready) return
    const map = mapRef.current
    if (!map) return
    const cols = 64
    const rows = 24
    const offscreen = document.createElement('canvas')
    offscreen.width = cols
    offscreen.height = rows
    const context = offscreen.getContext('2d', { willReadFrequently: true })
    const ramp = ' .:-=+*#%@'

    const capture = () => {
      const canvas = map.getCanvas()
      if (!canvas || !context) return
      context.drawImage(canvas, 0, 0, cols, rows)
      const { data } = context.getImageData(0, 0, cols, rows)
      const lines: string[] = []
      for (let y = 0; y < rows; y += 1) {
        let line = ''
        for (let x = 0; x < cols; x += 1) {
          const index = (y * cols + x) * 4
          const luminance = (data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114) / 255
          line += ramp[Math.min(ramp.length - 1, Math.floor(luminance * ramp.length))]
        }
        lines.push(line)
      }
      const center = map.getCenter()
      setAscii({ lines, coords: `${center.lat.toFixed(3)}, ${center.lng.toFixed(3)}` })
    }

    capture()
    const timer = setInterval(capture, 900)
    return () => clearInterval(timer)
  }, [asciiMode, ready])

  const handleAsciiClick = (event: MouseEvent<HTMLPreElement>) => {
    const map = mapRef.current
    if (!map) return
    const rect = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    const point = map.unproject([x, y])
    handlers.current.onPick(point.lat, point.lng)
  }

  return (
    <>
      <div className="map-canvas" ref={container} />
      {drone && (
        <div className="drone-hud">
          <span className="drone-title"><Plane size={11} /> DRONE</span>
          <button className={orbit ? 'active' : ''} onClick={() => setOrbit(!orbit)} title="Toggle 360° orbit">ORBIT</button>
          <button onClick={() => nudgeBearing(-25)} title="Rotate left">◀</button>
          <button onClick={() => nudgeBearing(25)} title="Rotate right">▶</button>
          <button onClick={() => nudgeZoom(0.6)} title="Climb">▲</button>
          <button onClick={() => nudgeZoom(-0.6)} title="Descend">▼</button>
          <span className="drone-readout">ALT z{hud.zoom.toFixed(1)} · BRG {Math.round((hud.bearing % 360 + 360) % 360)}°</span>
        </div>
      )}
      {walk && (
        <div className="walk-hud">
          <span className="walk-title"><Footprints size={11} /> WALK</span>
          <span className="walk-readout">
            {walkHud.lat.toFixed(5)}, {walkHud.lng.toFixed(5)} · HDG {Math.round(walkHud.heading)}° · {Math.round(walkHud.distance)} m
          </span>
          <span className={`walk-state ${walkHud.moving ? 'moving' : ''}`}>{walkHud.moving ? 'WALKING' : 'STANDING'}</span>
          <span className="walk-hint">W A S D / arrows move · Shift to jog · drag to look</span>
        </div>
      )}
      {inspect && (
        <div className="holo" style={{ left: inspect.x, top: inspect.y }}>
          <div className="holo-head">
            <span>◈ FEATURE SCAN</span>
            <span className="holo-coord">{inspect.lat.toFixed(5)}, {inspect.lng.toFixed(5)}</span>
          </div>
          <div className="holo-body">
            {inspect.rows.length === 0 && (
              <span className="holo-empty">No mapped object under this pixel — satellite imagery only.</span>
            )}
            {inspect.rows.map((row) => (
              <div key={`${row.label}-${row.value}`} className="holo-row">
                <b>{row.label}</b>
                <span>{row.value}</span>
              </div>
            ))}
          </div>
          <button className="holo-close" onClick={() => setInspect(null)} title="Close"><X size={10} /></button>
        </div>
      )}
      {asciiMode && ascii && (
        <div className="ascii-shell">
          <div className="ascii-head">
            <span><Grid3x3 size={11} /> ASCII PROJECTION</span>
            <span>{ascii.coords}</span>
            <span className="ascii-hint">CLICK A CELL TO LOCATE</span>
          </div>
          <pre className="ascii-grid" onClick={handleAsciiClick}>
            {ascii.lines.join('\n')}
          </pre>
        </div>
      )}
    </>
  )
}

function relative(iso: string | null, now: Date): string {
  if (!iso) return '—'
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return '—'
  const seconds = Math.max(0, Math.round((now.getTime() - then) / 1000))
  if (seconds < 90) return `${seconds}s`
  if (seconds < 5400) return `${Math.round(seconds / 60)}m`
  if (seconds < 172800) return `${Math.round(seconds / 3600)}h`
  return `${Math.round(seconds / 86400)}d`
}

type DetailTab = 'view' | 'history' | 'materials' | 'artifacts'

function LandmarkPanel({ landmark, tab, onTab, onClose }: {
  landmark: Landmark
  tab: DetailTab
  onTab: (tab: DetailTab) => void
  onClose: () => void
}) {
  const tabs: { id: DetailTab; label: string }[] = [
    { id: 'view', label: '360° VIEW' },
    { id: 'history', label: 'HISTORY' },
    { id: 'materials', label: 'MATERIALS' },
    { id: 'artifacts', label: 'ARTIFACTS' },
  ]
  return (
    <section className="rail-panel landmark-panel">
      <div className="landmark-head">
        <button className="back-button" onClick={onClose}><ArrowLeft size={13} /></button>
        <div className="landmark-titles">
          <b>{landmark.name}</b>
          <small>{landmark.city}, {landmark.state} · {landmark.built}</small>
        </div>
        <button className="icon-button tiny" onClick={onClose} title="Close"><X size={13} /></button>
      </div>
      <div className="landmark-badges">
        {landmark.unesco && <span className="unesco">UNESCO</span>}
        <span>{landmark.kind.toUpperCase()}</span>
        <span>{landmark.lat.toFixed(3)}, {landmark.lng.toFixed(3)}</span>
      </div>
      <div className="landmark-tabs">
        {tabs.map((item) => (
          <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => onTab(item.id)}>
            {item.label}
          </button>
        ))}
      </div>

      <div className="landmark-body">
        {tab === 'view' && (
          <>
            <LandmarkViewer landmark={landmark} />
            <p className="landmark-summary">{landmark.summary}</p>
            {landmark.images.length > 0 && (
              <div className="image-strip">
                {landmark.images.map((image) => (
                  <figure key={image.src}>
                    <img src={image.src} alt={image.caption} loading="lazy" />
                    <figcaption>{image.caption}</figcaption>
                  </figure>
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'history' && (
          <div className="prose">
            <p className="landmark-summary">{landmark.summary}</p>
            <dl className="facts">
              <div><dt>Built</dt><dd>{landmark.built}</dd></div>
              <div><dt>Architect</dt><dd>{landmark.architect}</dd></div>
            </dl>
            {landmark.history.map((paragraph) => <p key={paragraph.slice(0, 24)}>{paragraph}</p>)}
          </div>
        )}

        {tab === 'materials' && (
          <div className="prose">
            <h4>Materials</h4>
            {landmark.materials.map((material) => (
              <div key={material.name} className="material-row">
                <i style={{ background: material.colour }} />
                <div><b>{material.name}</b><small>{material.note}</small></div>
              </div>
            ))}
            <h4>Design concepts</h4>
            {landmark.concepts.map((concept) => (
              <div key={concept.name} className="concept-row">
                <b>{concept.name}</b>
                <small>{concept.note}</small>
              </div>
            ))}
          </div>
        )}

        {tab === 'artifacts' && (
          <div className="prose">
            <h4>Artifacts &amp; features</h4>
            {landmark.artifacts.map((artifact) => (
              <div key={artifact.name} className="concept-row">
                <b>{artifact.name}</b>
                <small>{artifact.note}</small>
              </div>
            ))}
            {landmark.images.length > 0 ? (
              <div className="image-grid">
                {landmark.images.map((image) => (
                  <figure key={image.src}>
                    <img src={image.src} alt={image.caption} loading="lazy" />
                    <figcaption>{image.caption}</figcaption>
                  </figure>
                ))}
              </div>
            ) : (
              <p className="muted-note">No licensed imagery is bundled for this landmark; the 3D reconstruction is procedural.</p>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

function App() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'all' | Layer>('all')
  const [activeLayers, setActiveLayers] = useState<Layer[]>([...LAYER_ORDER])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<'2d' | '3d'>('3d')
  const [layersOpen, setLayersOpen] = useState(true)
  const [placesOpen, setPlacesOpen] = useState(false)
  const [asciiMode, setAsciiMode] = useState(false)
  const [drone, setDrone] = useState(false)
  const [walk, setWalk] = useState(false)
  const [damId, setDamId] = useState<string | null>(null)
  const [globe, setGlobe] = useState(false)
  const [city, setCity] = useState<CityTarget | null>(null)
  const [sensor, setSensor] = useState<(typeof SENSORS)[number]>('none')
  const [overlays, setOverlays] = useState<Overlays>({ buildings: true, traffic: false, crowd: false, poi: true })
  const [analystText, setAnalystText] = useState('')
  const [analystBusy, setAnalystBusy] = useState(false)
  const [analyst, setAnalyst] = useState<AnalystResponse | null>(null)
  const [now, setNow] = useState(() => new Date())
  const [landmarkId, setLandmarkId] = useState<string | null>(null)
  const [detailTab, setDetailTab] = useState<DetailTab>('view')
  const [picked, setPicked] = useState<{ lat: number; lng: number } | null>(null)
  const [newsLang, setNewsLang] = useState<string | null>(null)

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const load = useCallback(async (force = false) => {
    try {
      const response = force
        ? await fetch(`${API}/api/v1/refresh`, { method: 'POST' })
        : await fetch(`${API}/api/v1/snapshot`)
      if (!response.ok) throw new Error(`API ${response.status}`)
      const body: Snapshot = await response.json()
      setSnapshot(body)
      setError(null)
      setSelectedId((current) => current ?? body.signals[0]?.id ?? null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'API unavailable')
    }
  }, [])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const timer = setInterval(() => void load(), 60_000)
    return () => clearInterval(timer)
  }, [load])

  const signals = snapshot?.signals ?? []
  const sourcesOk = snapshot ? snapshot.sources.filter((source) => source.ok).length : 0
  const sourcesTotal = snapshot?.sources.length ?? 0
  const critical = signals.filter((signal) => signal.severity === 'critical').length
  const high = signals.filter((signal) => signal.severity === 'high').length

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return signals.filter((signal) => {
      if (tab !== 'all' && signal.layer !== tab) return false
      if (!activeLayers.includes(signal.layer)) return false
      if (!needle) return true
      return `${signal.title} ${signal.place} ${signal.provider} ${signal.source}`.toLowerCase().includes(needle)
    })
  }, [signals, tab, activeLayers, query])

  const selected = signals.find((signal) => signal.id === selectedId) ?? null
  const newsLanguages = useMemo(
    () => [...new Set((snapshot?.news ?? []).map((item) => item.language ?? 'en'))],
    [snapshot],
  )
  const visibleNews = useMemo(
    () => (snapshot?.news ?? []).filter((item) => !newsLang || (item.language ?? 'en') === newsLang),
    [snapshot, newsLang],
  )
  const landmark = landmarkId ? LANDMARK_BY_ID.get(landmarkId) ?? null : null
  const dam = damId ? DAM_BY_ID.get(damId) ?? null : null
  const focus = useMemo<[number, number]>(
    () => (landmark ? [landmark.lng, landmark.lat] : [78.9, 22.4]),
    [landmark],
  )

  const openLandmark = (id: string) => {
    setLandmarkId(id)
    setDetailTab('view')
    setPicked(null)
  }

  const handlePick = (lat: number, lng: number) => {
    setPicked({ lat, lng })
    let nearest: Landmark | null = null
    let best = Number.POSITIVE_INFINITY
    for (const candidate of LANDMARKS) {
      const distance = (candidate.lat - lat) ** 2 + (candidate.lng - lng) ** 2
      if (distance < best) { best = distance; nearest = candidate }
    }
    if (nearest && Math.sqrt(best) < 1.2) openLandmark(nearest.id)
  }

  const nearbyPicked = picked
    ? signals.filter((signal) => signal.lat !== null && signal.lng !== null
        && Math.abs(signal.lat - picked.lat) < 1.4 && Math.abs((signal.lng as number) - picked.lng) < 1.4)
    : []

  const toggleLayer = (layer: Layer) =>
    setActiveLayers((current) => current.includes(layer) ? current.filter((item) => item !== layer) : [...current, layer])

  const askAnalyst = async (event: FormEvent) => {
    event.preventDefault()
    if (analystText.trim().length < 3) return
    setAnalystBusy(true)
    try {
      const response = await fetch(`${API}/api/v1/analyst`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: analystText }),
      })
      if (!response.ok) throw new Error(`API ${response.status}`)
      setAnalyst(await response.json())
    } catch {
      setAnalyst({
        mode: 'OFFLINE', is_llm: false, grounded_at: snapshot?.generated_at ?? '',
        answer: `The API at ${API} is not responding. Start the backend with scripts/dev.ps1, then ask again.`,
        evidence: [], limitations: [],
      })
    } finally {
      setAnalystBusy(false)
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark"><Globe2 size={16} /></span>
          <span className="brand-name">INDIA AI <b>OS</b> <em>MAPS</em></span>
        </div>
        <nav className="nav-tabs">
          <button className={`nav-tab ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')}>OVERVIEW</button>
          {LAYER_ORDER.map((layer) => {
            const Icon = LAYER_META[layer].icon
            return (
              <button key={layer} className={`nav-tab ${tab === layer ? 'active' : ''}`} onClick={() => setTab(layer)}>
                <Icon size={12} /> {LAYER_META[layer].label}
              </button>
            )
          })}
          <button className={`nav-tab ${placesOpen ? 'active' : ''}`} onClick={() => setPlacesOpen(!placesOpen)}>
            <MapPin size={12} /> Places
          </button>
        </nav>
        <div className="top-actions">
          <div className="search-inline">
            <Search size={13} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter signals, cities, providers" />
          </div>
          <span className={`chip ${sourcesOk === sourcesTotal && sourcesTotal > 0 ? 'ok' : 'warn'}`}>
            <i /> {sourcesOk}/{sourcesTotal || '—'} SOURCES
          </span>
          <span className="chip alert"><AlertTriangle size={12} /> {critical + high} HIGH</span>
          <button className="icon-button" title="Refresh feeds now" onClick={() => void load(true)}><RefreshCw size={14} /></button>
          <span className="clock">{now.toISOString().slice(11, 19)} UTC</span>
          <span className="avatar">SA</span>
        </div>
      </header>

      <div className="subbar">
        <div className="ws-tabs">
          <button className="ws-tab active">Main</button>
          <button className="ws-tab">+</button>
          <span className="ws-scope">NATIONAL SCOPE · INDIA</span>
        </div>
        <div className="subbar-right">
          <span className="live-pill"><i /> LIVE PUBLIC FEEDS</span>
          <span className="sub-note">Last sync {snapshot ? relative(snapshot.generated_at, now) : '—'} ago</span>
        </div>
      </div>

      <div className="stripe">
        <ShieldCheck size={13} />
        <span>Live public data. Not an official warning or government service — follow IMD and NDMA advisories. Traffic and crowd overlays are simulations.</span>
        <span className="stripe-right">3D SATELLITE · TERRAIN · BUILDINGS</span>
      </div>

      {error && (
        <div className="error-bar">
          <AlertTriangle size={14} /> API unavailable ({error}). Start it with <code>scripts/dev.ps1</code> — the dashboard polls {API}.
        </div>
      )}

      <main className="workspace">
        <section className="map-panel">
          <div className="panel-head">
            <div className="panel-title"><Globe2 size={14} /> INDIA SITUATION</div>
            <div className="panel-head-meta">
              <span>{signals.length} SIGNALS</span>
              <span className="sep" />
              <span>{snapshot?.news.length ?? 0} HEADLINES</span>
            </div>
            <button className={`ascii-toggle ${asciiMode ? 'active' : ''}`} onClick={() => setAsciiMode(!asciiMode)} title="ASCII projection view">
              <Grid3x3 size={12} /> ASCII
            </button>
            <button className={`ascii-toggle drone-toggle ${drone ? 'active' : ''}`} onClick={() => { const next = !drone; setDrone(next); setWalk(false); if (next) setMode('3d') }} title="Drone camera mode">
              <Plane size={12} /> DRONE
            </button>
            <button className={`ascii-toggle walk-toggle ${walk ? 'active' : ''}`} onClick={() => { setWalk(!walk); setDrone(false) }} title="Street-level walk mode">
              <Footprints size={12} /> WALK
            </button>
            <button className={`ascii-toggle globe-toggle ${globe ? 'active' : ''}`} onClick={() => { setGlobe(!globe); setDrone(false); setWalk(false) }} title="Globe projection with weather radar">
              <Globe2 size={12} /> GLOBE
            </button>
            <button className="ascii-toggle sensor-toggle" onClick={() => setSensor(SENSORS[(SENSORS.indexOf(sensor) + 1) % SENSORS.length])} title="Display look">
              <Camera size={12} /> {sensor === 'none' ? 'SENSOR' : sensor.toUpperCase()}
            </button>
            <div className="seg" role="group" aria-label="Map view mode">
              <button className={mode === '2d' ? 'active' : ''} onClick={() => setMode('2d')}>2D</button>
              <button className={mode === '3d' ? 'active' : ''} onClick={() => setMode('3d')}>3D</button>
            </div>
          </div>

          <div className={`map-stage sensor-${sensor}`}>
            <MapCanvas
              signals={signals}
              activeLayers={activeLayers}
              selectedId={selectedId}
              overlays={overlays}
              mode={mode}
              focus={focus}
              drone={drone}
              walk={walk}
              globe={globe}
              selectedLandmarkId={landmarkId}
              asciiMode={asciiMode}
              onSelectSignal={setSelectedId}
              onSelectLandmark={openLandmark}
              onSelectDam={setDamId}
              onSelectCity={setCity}
              onPick={handlePick}
            />

            <div className={`layer-drawer ${layersOpen ? 'open' : ''}`}>
              <button className="drawer-head" onClick={() => setLayersOpen(!layersOpen)}>
                <span><Layers3 size={13} /> LAYERS</span>
                <span className="drawer-count">{activeLayers.length + Object.values(overlays).filter(Boolean).length}</span>
                <ChevronDown size={13} className={layersOpen ? 'flip' : ''} />
              </button>
              {layersOpen && (
                <div className="drawer-body">
                  {LAYER_ORDER.map((layer) => {
                    const meta = LAYER_META[layer]
                    const Icon = meta.icon
                    const on = activeLayers.includes(layer)
                    return (
                      <button key={layer} className={`layer-row ${on ? 'on' : ''}`} onClick={() => toggleLayer(layer)}>
                        <span className={`check ${on ? 'checked' : ''}`} />
                        <Icon size={13} style={{ color: meta.colour }} />
                        <span className="layer-name">{meta.label}</span>
                        <span className="layer-count">{snapshot?.counts[layer] ?? 0}</span>
                      </button>
                    )
                  })}
                  <div className="drawer-divider">3D &amp; SIMULATION</div>
                  <button className={`layer-row ${overlays.buildings ? 'on' : ''}`} onClick={() => setOverlays({ ...overlays, buildings: !overlays.buildings })}>
                    <span className={`check ${overlays.buildings ? 'checked' : ''}`} />
                    <Building2 size={13} style={{ color: '#8ef0ff' }} />
                    <span className="layer-name">3D buildings</span>
                    <span className="layer-count">z14+</span>
                  </button>
                  <button className={`layer-row ${overlays.poi ? 'on' : ''}`} onClick={() => setOverlays({ ...overlays, poi: !overlays.poi })}>
                    <span className={`check ${overlays.poi ? 'checked' : ''}`} />
                    <MapPin size={13} style={{ color: '#7ce7a4' }} />
                    <span className="layer-name">Places &amp; POIs</span>
                    <span className="layer-count">z13+</span>
                  </button>
                  <button className={`layer-row ${overlays.traffic ? 'on' : ''}`} onClick={() => setOverlays({ ...overlays, traffic: !overlays.traffic })}>
                    <span className={`check ${overlays.traffic ? 'checked' : ''}`} />
                    <Car size={13} style={{ color: '#ffd166' }} />
                    <span className="layer-name">Traffic <em>sim</em></span>
                    <span className="layer-count">70</span>
                  </button>
                  <button className={`layer-row ${overlays.crowd ? 'on' : ''}`} onClick={() => setOverlays({ ...overlays, crowd: !overlays.crowd })}>
                    <span className={`check ${overlays.crowd ? 'checked' : ''}`} />
                    <Footprints size={13} style={{ color: '#ffb347' }} />
                    <span className="layer-name">Crowd <em>sim</em></span>
                    <span className="layer-count">110</span>
                  </button>
                </div>
              )}
            </div>

            {placesOpen && (
              <div className="places-drawer">
                <div className="places-head"><MapPin size={12} /> PLACES · 3D</div>
                <div className="places-list">
                  {LANDMARKS.map((place) => (
                    <button key={place.id} className={`place-row ${place.id === landmarkId ? 'active' : ''}`} onClick={() => openLandmark(place.id)}>
                      <span>{place.name}</span>
                      <small>{place.city}</small>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {dam && (
              <div className="locator-card dam-card">
                <div className="locator-head"><Waves size={11} /> DAM · {dam.state}</div>
                <b>{dam.name}</b>
                <small>{dam.river} · {dam.type} · {dam.height_m} m high · {dam.year}</small>
                <button className="locator-close" onClick={() => setDamId(null)}><X size={11} /></button>
              </div>
            )}

            {picked && !landmark && (
              <div className="locator-card">
                <div className="locator-head"><Grid3x3 size={11} /> ASCII LOCATOR</div>
                <b>{picked.lat.toFixed(3)}°N, {picked.lng.toFixed(3)}°E</b>
                <small>{nearbyPicked.length} live signals within ~150 km</small>
                {nearbyPicked.slice(0, 2).map((signal) => (
                  <button key={signal.id} className="locator-row" onClick={() => setSelectedId(signal.id)}>
                    <span className={`sev ${signal.severity}`} /> {signal.title}
                  </button>
                ))}
                <button className="locator-close" onClick={() => setPicked(null)}><X size={11} /></button>
              </div>
            )}

            <div className="map-legend">
              {(['critical', 'high', 'medium', 'low'] as Severity[]).map((severity) => (
                <span key={severity}><i className={`dot ${severity}`} /> {severity.toUpperCase()}</span>
              ))}
            </div>
          </div>
        </section>

        <aside className="rail">
          {landmark ? (
            <LandmarkPanel landmark={landmark} tab={detailTab} onTab={setDetailTab} onClose={() => setLandmarkId(null)} />
          ) : (
            <>
              <section className="rail-panel feed-panel">
                <div className="rail-head">
                  <span><Activity size={12} /> LIVE SIGNALS</span>
                  <span className="badge">{visible.length}</span>
                </div>
                <div className="rail-tabs">
                  <button className={tab === 'all' ? 'active' : ''} onClick={() => setTab('all')}>ALL</button>
                  {LAYER_ORDER.map((layer) => (
                    <button key={layer} className={tab === layer ? 'active' : ''} onClick={() => setTab(layer)}>
                      {LAYER_META[layer].short}
                    </button>
                  ))}
                </div>
                <div className="feed">
                  {!snapshot && !error && <div className="feed-empty">Connecting to live feeds…</div>}
                  {snapshot && !visible.length && <div className="feed-empty">No live records match this filter.</div>}
                  {visible.slice(0, 120).map((signal) => (
                    <button
                      key={signal.id}
                      className={`feed-row ${selectedId === signal.id ? 'selected' : ''}`}
                      onClick={() => setSelectedId(signal.id)}
                    >
                      <span className={`sev ${signal.severity}`} />
                      <span className="feed-copy">
                        <b>{signal.title}</b>
                        <small>{signal.place || '—'} · {signal.provider}</small>
                      </span>
                      <span className="feed-time">{relative(signal.time, now)}</span>
                    </button>
                  ))}
                </div>
              </section>

              {selected && (
                <section className="rail-panel detail-panel">
                  <div className="rail-head">
                    <span><Search size={12} /> SELECTED SIGNAL</span>
                    <span className={`sev-label ${selected.severity}`}>{selected.severity.toUpperCase()}</span>
                  </div>
                  <div className="detail">
                    <h3>{selected.title}</h3>
                    {selected.layer === 'flight' && <AircraftViewer signal={selected} />}
                    <p>{selected.detail || 'No further detail supplied by the provider.'}</p>
                    <dl>
                      <div><dt>Place</dt><dd>{selected.place || '—'}</dd></div>
                      <div><dt>Observed</dt><dd>{selected.time ? `${new Date(selected.time).toISOString().slice(0, 16).replace('T', ' ')} UTC` : '—'}</dd></div>
                      <div><dt>Provider</dt><dd>{selected.provider}</dd></div>
                      <div><dt>Feed</dt><dd>{selected.source}</dd></div>
                      {Object.entries(selected.metrics).slice(0, 3).map(([key, value]) => (
                        <div key={key}><dt>{key.replace(/_/g, ' ')}</dt><dd>{typeof value === 'number' ? Number(value.toFixed(1)) : value}</dd></div>
                      ))}
                    </dl>
                    {selected.url && (
                      <a className="detail-link" href={selected.url} target="_blank" rel="noreferrer">
                        Open source record <ArrowUpRight size={12} />
                      </a>
                    )}
                  </div>
                </section>
              )}

              <section className="rail-panel news-panel">
                <div className="rail-head">
                  <span><Database size={12} /> LIVE HEADLINES</span>
                  <span className="badge">{snapshot?.news.length ?? 0}</span>
                </div>
                <div className="rail-tabs lang-tabs">
                  <button className={newsLang === null ? 'active' : ''} onClick={() => setNewsLang(null)}>ALL</button>
                  {newsLanguages.map((language) => (
                    <button
                      key={language}
                      className={newsLang === language ? 'active' : ''}
                      onClick={() => setNewsLang(language)}
                    >
                      {LANGUAGE_LABELS[language] ?? language}
                    </button>
                  ))}
                </div>
                <div className="news-list">
                  {visibleNews.length === 0 && <div className="feed-empty">No headlines in this language yet.</div>}
                  {visibleNews.slice(0, 30).map((item) => (
                    <a key={item.id} className="news-row" href={item.url} target="_blank" rel="noreferrer">
                      <b>{item.title}</b>
                      <small>
                        <span className="lang-badge">{LANGUAGE_LABELS[item.language ?? 'en'] ?? item.language}</span>
                        {' '}{item.source} · {relative(item.published, now)} ago
                      </small>
                    </a>
                  ))}
                </div>
              </section>

              <section className="rail-panel analyst-panel">
                <div className="rail-head">
                  <span><Sparkles size={12} /> INDIA ANALYST</span>
                  <span className="mode-tag">GROUNDED</span>
                </div>
                <form className="analyst-form" onSubmit={askAnalyst}>
                  <input
                    value={analystText}
                    onChange={(event) => setAnalystText(event.target.value)}
                    placeholder="Ask about quakes, air, weather, flights…"
                  />
                  <button className="primary" disabled={analystBusy || analystText.trim().length < 3}>
                    {analystBusy ? '…' : <Bot size={16} />}
                  </button>
                </form>
                {analyst && (
                  <div className="analyst-answer">
                    <div className="answer-meta">{analyst.mode} · {analyst.is_llm ? 'LLM' : 'NO MODEL'} · {relative(analyst.grounded_at, now)} ago</div>
                    <p>{analyst.answer}</p>
                    {analyst.evidence.length > 0 && (
                      <div className="evidence">
                        {analyst.evidence.map((item) => (
                          <a key={item.id} href={item.url ?? '#'} target="_blank" rel="noreferrer">
                            <span className={`sev ${item.severity}`} /> {item.title}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </section>

              <section className="rail-panel health-panel">
                <div className="rail-head">
                  <span><ShieldCheck size={12} /> SOURCE HEALTH</span>
                  <span className="badge">{sourcesOk}/{sourcesTotal || '—'}</span>
                </div>
                <div className="health-list">
                  {(snapshot?.sources ?? []).map((source) => (
                    <div key={source.id} className="health-row" title={source.license}>
                      <span className={`status-dot ${source.ok ? 'ok' : 'bad'}`} />
                      <span className="health-name">
                        <b>{source.name}</b>
                        <small>{source.provider}</small>
                      </span>
                      <span className="health-meta">
                        {source.ok ? `${source.records} rec` : (source.last_error ? 'error' : '—')}
                        <small>{source.ok ? relative(source.last_success, now) : ''}</small>
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </aside>
      </main>

      {city && <CityView city={city} onClose={() => setCity(null)} />}

      <footer className="footer">
        <span>INDIA AI OS MAPS · LIVE GEOSPATIAL INTELLIGENCE</span>
        <span><Camera size={9} /> OSM ROADS, BRIDGES &amp; BUILDINGS · SIMULATED TRAFFIC &amp; CROWD</span>
        <span>NOT AN OFFICIAL GOVERNMENT PLATFORM</span>
      </footer>
    </div>
  )
}

export default App
