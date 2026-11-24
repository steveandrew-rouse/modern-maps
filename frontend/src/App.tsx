import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { GeoJSONSource, Map as MapLibreMap, StyleSpecification } from 'maplibre-gl'
import {
  Activity, AlertTriangle, ArrowLeft, ArrowUpRight, Bot, Building2, Camera, Car,
  ChevronDown, Database, Footprints, Globe2, Grid3x3, Layers3, MapPin, Plane, RefreshCw, Search,
  ShieldCheck, Sparkles, Thermometer, Wind, X,
} from 'lucide-react'
import type { AnalystResponse, Layer, NewsItem, Severity, Signal, Snapshot } from './types'
import { LANDMARKS, LANDMARK_BY_ID, type Landmark } from './landmarks'
import LandmarkViewer from './LandmarkViewer'

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
    {
      id: 'buildings-3d', type: 'fill-extrusion', source: 'openmaptiles', 'source-layer': 'building',
      minzoom: 13.6,
      filter: ['!=', ['get', 'hide_3d'], true],
      paint: {
        // Each building takes its own colour from its height band, so blocks stay
        // distinct instead of merging into one slab.
        'fill-extrusion-color': [
          'interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 10],
          0, '#0e4a6b', 6, '#1f8f9c', 12, '#45d1b3', 20, '#f2c94c',
          32, '#f2994a', 50, '#eb5757', 90, '#bb6bd9', 160, '#e6f7ff',
        ],
        'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 8],
        'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
        'fill-extrusion-opacity': 0.74,
        'fill-extrusion-vertical-gradient': true,
      },
    },
  ],
  terrain: { source: 'terrain', exaggeration: 1.35 },
}

type Overlays = { buildings: boolean; traffic: boolean; crowd: boolean }

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
        },
      })),
  }
}

function MapCanvas({ signals, activeLayers, selectedId, overlays, mode, focus, drone, selectedLandmarkId, asciiMode, onSelectSignal, onSelectLandmark, onPick }: {
  signals: Signal[]
  activeLayers: Layer[]
  selectedId: string | null
  overlays: Overlays
  mode: '2d' | '3d'
  focus: [number, number]
  drone: boolean
  selectedLandmarkId: string | null
  asciiMode: boolean
  onSelectSignal: (id: string) => void
  onSelectLandmark: (id: string) => void
  onPick: (lat: number, lng: number) => void
}) {
  const container = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const handlers = useRef({ onSelectSignal, onSelectLandmark, onPick })
  handlers.current = { onSelectSignal, onSelectLandmark, onPick }
  const [ready, setReady] = useState(false)
  const [ascii, setAscii] = useState<{ lines: string[]; coords: string } | null>(null)
  const [orbit, setOrbit] = useState(true)
  const orbitRef = useRef(true)
  const [hud, setHud] = useState({ zoom: 0, bearing: 0 })
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
    map.on('error', (event) => console.error('MAP ERROR', event.error?.message ?? event))
    map.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }), 'bottom-right')
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')
    map.on('load', () => {
      map.resize()
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

  useEffect(() => {
    if (!ready) return
    const map = mapRef.current
    if (!map) return
    if (map.getSource('signals')) {
      ;(map.getSource('signals') as GeoJSONSource).setData(toFeatureCollection(signals))
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

    map.addLayer({
      id: 'lyr-flight', type: 'circle', source: 'signals', filter: ['==', ['get', 'layer'], 'flight'],
      paint: {
        'circle-radius': 2.6, 'circle-color': LAYER_META.flight.colour, 'circle-opacity': 0.85,
        'circle-stroke-width': 0.5, 'circle-stroke-color': '#04221a',
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
    const selected = signals.find((signal) => signal.id === selectedId)
    if (selected && selected.lat !== null && selected.lng !== null) {
      map.easeTo({ center: [selected.lng, selected.lat], zoom: Math.max(map.getZoom(), 5.2), duration: 700 })
    }
  }, [ready, selectedId, selectedLandmarkId, signals])

  useEffect(() => {
    if (!ready) return
    const map = mapRef.current
    if (!map) return
    if (mode === '3d') {
      map.setTerrain({ source: 'terrain', exaggeration: 1.35 })
      map.easeTo({ pitch: 50, bearing: -8, duration: 700 })
    } else {
      map.setTerrain(null)
      map.easeTo({ pitch: 0, bearing: 0, duration: 700 })
    }
  }, [ready, mode])

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
      if (orbiting && !paused && orbitRef.current) map.setBearing(map.getBearing() + 0.12)
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

  const nudgeBearing = (delta: number) => {
    const map = mapRef.current
    if (!map) return
    setOrbit(false)
    map.easeTo({ bearing: map.getBearing() + delta, duration: 450 })
  }

  const nudgeZoom = (delta: number) => {
    const map = mapRef.current
    if (!map) return
    map.easeTo({ zoom: map.getZoom() + delta, duration: 450 })
  }

  useEffect(() => {
    if (!ready) return
    const map = mapRef.current
    if (!map || !map.getLayer('buildings-3d')) return
    map.setLayoutProperty('buildings-3d', 'visibility', overlays.buildings ? 'visible' : 'none')
  }, [ready, overlays.buildings])

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
  const [overlays, setOverlays] = useState<Overlays>({ buildings: true, traffic: false, crowd: false })
  const [analystText, setAnalystText] = useState('')
  const [analystBusy, setAnalystBusy] = useState(false)
  const [analyst, setAnalyst] = useState<AnalystResponse | null>(null)
  const [now, setNow] = useState(() => new Date())
  const [landmarkId, setLandmarkId] = useState<string | null>(null)
  const [detailTab, setDetailTab] = useState<DetailTab>('view')
  const [picked, setPicked] = useState<{ lat: number; lng: number } | null>(null)

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
  const landmark = landmarkId ? LANDMARK_BY_ID.get(landmarkId) ?? null : null
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
            <button className={`ascii-toggle drone-toggle ${drone ? 'active' : ''}`} onClick={() => setDrone(!drone)} title="Drone camera mode">
              <Plane size={12} /> DRONE
            </button>
            <div className="seg" role="group" aria-label="Map view mode">
              <button className={mode === '2d' ? 'active' : ''} onClick={() => setMode('2d')}>2D</button>
              <button className={mode === '3d' ? 'active' : ''} onClick={() => setMode('3d')}>3D</button>
            </div>
          </div>

          <div className="map-stage">
            <MapCanvas
              signals={signals}
              activeLayers={activeLayers}
              selectedId={selectedId}
              overlays={overlays}
              mode={mode}
              focus={focus}
              drone={drone}
              selectedLandmarkId={landmarkId}
              asciiMode={asciiMode}
              onSelectSignal={setSelectedId}
              onSelectLandmark={openLandmark}
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
                <div className="rail-tabs">
                  {snapshot?.news.length
                    ? [...new Set((snapshot?.news ?? []).map((item: NewsItem) => item.source))].slice(0, 6)
                        .map((name) => <span key={name} className="source-tab">{name}</span>)
                    : <span className="source-tab">Awaiting feeds</span>}
                </div>
                <div className="news-list">
                  {(snapshot?.news ?? []).slice(0, 20).map((item) => (
                    <a key={item.id} className="news-row" href={item.url} target="_blank" rel="noreferrer">
                      <b>{item.title}</b>
                      <small>{item.source} · {relative(item.published, now)} ago</small>
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

      <footer className="footer">
        <span>INDIA AI OS MAPS · LIVE GEOSPATIAL INTELLIGENCE</span>
        <span><Camera size={9} /> 3D RECONSTRUCTION · SIMULATED TRAFFIC &amp; CROWD</span>
        <span>NOT AN OFFICIAL GOVERNMENT PLATFORM</span>
      </footer>
    </div>
  )
}

export default App
