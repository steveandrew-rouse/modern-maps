import { useCallback, useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { Map as MapLibreMap, StyleSpecification } from 'maplibre-gl'
import { ArrowLeft, Building2, Compass, Layers3, MapPin, Move3d } from 'lucide-react'
import CityScene, { type BuildingInfo, type CityControls } from './CityScene'
import { fetchCityModel, taggedHeight, type CityModel } from './citymodel'

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

function contextStyle(): StyleSpecification {
  return {
    version: 8,
    sources: {
      satellite: {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
        maxzoom: 19,
      },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#04101a' } },
      {
        id: 'satellite', type: 'raster', source: 'satellite',
        paint: { 'raster-saturation': 0.16, 'raster-contrast': 0.16, 'raster-fade-duration': 250 },
      },
    ],
  }
}

export default function CityView({ city, onClose }: { city: CityTarget; onClose: () => void }) {
  const container = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const pad = useRef<CityControls>({ forward: 0, strafe: 0, turn: 0, lift: 0 })
  const [model, setModel] = useState<CityModel | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [built, setBuilt] = useState(false)
  const [legend, setLegend] = useState(true)
  const [inspect, setInspect] = useState<{ x: number; y: number; info: BuildingInfo | null } | null>(null)

  // Satellite view stays only while the 3D city is being fetched, then it is removed.
  useEffect(() => {
    if (!container.current || mapRef.current) return
    const map = new maplibregl.Map({
      container: container.current,
      style: contextStyle(),
      center: [city.lng, city.lat],
      zoom: 11.8,
      pitch: 40,
      bearing: -18,
      maxZoom: 18.5,
      attributionControl: false,
    })
    mapRef.current = map
    map.on('load', () => {
      map.resize()
      map.easeTo({ center: [city.lng, city.lat], zoom: 15.4, pitch: 60, bearing: -22, duration: 2400 })
    })
    return () => {
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city.lat, city.lng])

  useEffect(() => {
    const controller = new AbortController()
    setModel(null)
    setError(null)
    setBuilt(false)
    fetchCityModel(city.lat, city.lng, controller.signal)
      .then((next) => setModel(next))
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return
        setError(cause instanceof Error ? cause.message : 'Could not build the city')
      })
    return () => controller.abort()
  }, [city.lat, city.lng, attempt])

  useEffect(() => {
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
  }, [onClose])

  const handleReady = useCallback(() => {
    setBuilt(true)
    // The 3D city is drawn from OSM geometry, so the basemap has nothing left to show.
    mapRef.current?.remove()
    mapRef.current = null
  }, [])

  const hold = (key: keyof CityControls, value: number) => ({
    onPointerDown: () => { pad.current[key] = value },
    onPointerUp: () => { pad.current[key] = 0 },
    onPointerLeave: () => { pad.current[key] = 0 },
  })

  const tagged = model ? model.buildings.filter((building) => taggedHeight(building) !== null).length : 0
  const estimated = model ? model.buildings.length - tagged : 0

  return (
    <div className="city-view" role="dialog" aria-label={`${city.name} 3D city view`}>
      <div className={`city-map ${built ? 'is-hidden' : ''}`} ref={container} />
      {model && (
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
          <small>{city.lat.toFixed(3)}, {city.lng.toFixed(3)} · real OSM geometry</small>
        </div>
        <span className="city-chip"><Move3d size={11} /> 3D CITY</span>
        <span className="city-chip"><Layers3 size={11} /> {model ? `${model.buildings.length} BUILDINGS` : 'BUILDING…'}</span>
        <button className="city-legend-toggle" onClick={() => setLegend(!legend)}>
          <Building2 size={11} /> SECTORS
        </button>
      </header>

      {!built && !error && (
        <div className="city-loading">
          <div className="city-loading-ring" />
          <b>BUILDING {city.name.toUpperCase()}</b>
          <span>Fetching real footprints, heights and streets from OpenStreetMap, then meshing them into 3D.</span>
        </div>
      )}

      {error && (
        <div className="city-error">
          <b>Could not build the 3D city</b>
          <span>{error}</span>
          <span className="city-error-hint">The satellite context view stays visible while the model is unavailable.</span>
          <button onClick={() => setAttempt(attempt + 1)}>TRY AGAIN</button>
        </div>
      )}

      {legend && built && (
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

      <div className="move-pad" aria-label="Movement pad">
        <button {...hold('forward', 1)} title="Forward">▲</button>
        <button {...hold('turn', -1)} title="Turn left"><Compass size={12} /></button>
        <button {...hold('forward', -1)} title="Back">▼</button>
        <button {...hold('strafe', -1)} title="Left">◀</button>
        <button {...hold('strafe', 1)} title="Right">▶</button>
        <button {...hold('lift', 1)} title="Climb">+</button>
        <button {...hold('lift', -1)} title="Descend">−</button>
      </div>
      <div className="move-hint">DRAG TO LOOK · W A S D MOVE · Q/E TURN · R/F CLIMB · WHEEL ZOOM · ESC TO LEAVE</div>

      {inspect && built && (
        <div className="holo city-holo" style={{ left: inspect.x + 12, top: inspect.y + 12 }}>
          <div className="holo-head"><span>◈ CITY SCAN</span><span className="holo-coord">{city.name}</span></div>
          <div className="holo-body">
            {!inspect.info && <span className="holo-empty">Ground or road — no building here.</span>}
            {inspect.info && (
              <>
                <div className="holo-row"><b>{inspect.info.name ?? `${inspect.info.sector} building`}</b><span>{inspect.info.sector}</span></div>
                <div className="holo-row">
                  <b>Height</b>
                  <span>
                    {inspect.info.estimated ? `≈${inspect.info.height} m · estimated` : `${inspect.info.height} m · OSM tag`}
                  </span>
                </div>
              </>
            )}
          </div>
          <button className="holo-close" onClick={() => setInspect(null)}>×</button>
        </div>
      )}

      <div className="city-foot">
        <MapPin size={10} /> {city.name} · OSM footprints, heights and streets meshed in 3D · procedural massing, not photogrammetry
      </div>
    </div>
  )
}
