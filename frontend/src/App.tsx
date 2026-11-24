import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { Map as MapLibreMap, GeoJSONSource } from 'maplibre-gl'
import {
  Activity, AlertTriangle, ArrowUpRight, BarChart3, Bell, Blocks, Bot, ChevronDown,
  CircleHelp, CloudSun, Compass, Database, Factory, FileText, Gauge, Globe2, Layers3,
  MapPin, Menu, Radio, RefreshCw, Search, ShieldCheck, SlidersHorizontal, Sparkles,
  TrainFront, Waves, Wind, Zap,
} from 'lucide-react'
import type { DashboardSummary, DemoEvent, Layer } from './types'
import { LOCAL_EVENTS, LOCAL_LAYERS, localAnalystAnswer } from './localData'

// Empty in a static production build unless VITE_API_URL is provided at build time.
const API = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://127.0.0.1:8000' : '')
const layerIcons: Record<string, typeof Layers3> = {
  transport: TrainFront, climate: CloudSun, disaster: AlertTriangle,
  infrastructure: Factory, water: Waves, agriculture: Wind, energy: Zap,
}

function MapCanvas({ events, activeLayers, selectedId, onSelect }: {
  events: DemoEvent[]; activeLayers: string[]; selectedId: string | null; onSelect: (id: string) => void
}) {
  const container = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const eventsRef = useRef(events)
  const onSelectRef = useRef(onSelect)
  eventsRef.current = events
  onSelectRef.current = onSelect

  useEffect(() => {
    if (!container.current || mapRef.current) return
    const map = new maplibregl.Map({
      container: container.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: [78.8, 22.7],
      zoom: 4.15,
      minZoom: 3,
      maxZoom: 12,
      attributionControl: false,
    })
    mapRef.current = map
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'bottom-right')
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left')

    map.on('load', () => {
      map.addSource('demo-events', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: eventsRef.current.map((event) => ({
            type: 'Feature' as const,
            geometry: { type: 'Point' as const, coordinates: [event.lng, event.lat] },
            properties: { id: event.id, category: event.category, severity: event.severity, title: event.title },
          })),
        },
      })
      map.addLayer({
        id: 'demo-event-glow', type: 'circle', source: 'demo-events',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 9, 8, 16],
          'circle-color': ['match', ['get', 'category'], 'disaster', '#ff6b67', 'climate', '#f4b95f', 'transport', '#58b9ff', 'energy', '#d6b4ff', 'water', '#58d4cb', 'agriculture', '#a5cf78', '#9bb4c9'],
          'circle-opacity': 0.20, 'circle-blur': 0.9,
        },
      })
      map.addLayer({
        id: 'demo-event-points', type: 'circle', source: 'demo-events',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 4, 8, 7],
          'circle-color': ['match', ['get', 'category'], 'disaster', '#ff6b67', 'climate', '#f4b95f', 'transport', '#58b9ff', 'energy', '#d6b4ff', 'water', '#58d4cb', 'agriculture', '#a5cf78', '#9bb4c9'],
          'circle-stroke-width': 1.5, 'circle-stroke-color': '#eaf6ff',
        },
      })
      map.on('click', 'demo-event-points', (e) => {
        const feature = e.features?.[0]
        const id = feature?.properties?.id
        if (id) onSelectRef.current(String(id))
      })
      map.on('mouseenter', 'demo-event-points', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'demo-event-points', () => { map.getCanvas().style.cursor = '' })
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded() || !map.getSource('demo-events')) return
    const source = map.getSource('demo-events') as GeoJSONSource | undefined
    if (source) {
      source.setData({
        type: 'FeatureCollection',
        features: events.map((event) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [event.lng, event.lat] },
          properties: { id: event.id, category: event.category, severity: event.severity, title: event.title },
        })),
      })
    }
  }, [events])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded() || !map.getLayer('demo-event-points')) return
    const filter = activeLayers.length ? ['in', ['get', 'category'], ['literal', activeLayers]] : ['==', ['get', 'category'], '__none__']
    map.setFilter('demo-event-points', filter as never)
    map.setFilter('demo-event-glow', filter as never)
    if (selectedId) {
      const selected = events.find((e) => e.id === selectedId)
      if (selected) map.easeTo({ center: [selected.lng, selected.lat], zoom: Math.max(map.getZoom(), 5.1), duration: 650 })
    }
  }, [activeLayers, selectedId, events])

  return <div className="map-canvas" ref={container} />
}

function App() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [layers, setLayers] = useState<Layer[]>([])
  const [events, setEvents] = useState<DemoEvent[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeLayers, setActiveLayers] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [analystText, setAnalystText] = useState('')
  const [analystBusy, setAnalystBusy] = useState(false)
  const [analystAnswer, setAnalystAnswer] = useState('')
  const [apiOnline, setApiOnline] = useState(false)
  const [dataSource, setDataSource] = useState<'api' | 'local'>('local')
  const [searchOpen, setSearchOpen] = useState(false)
  const [mobileMenu, setMobileMenu] = useState(false)

  const applyLocalData = () => {
    setApiOnline(false)
    setDataSource('local')
    setSummary({
      mode: 'DEMO', is_live: false, live_sources: 0,
      demo_scenarios: LOCAL_EVENTS.length, layer_groups: LOCAL_LAYERS.length,
      last_updated: new Date().toISOString(),
      notice: 'Static demonstration build: all records are bundled synthetic fixtures.',
    })
    setLayers(LOCAL_LAYERS)
    setEvents(LOCAL_EVENTS)
    setActiveLayers(LOCAL_LAYERS.map((layer) => layer.id))
    setSelectedId((current) => current ?? LOCAL_EVENTS[0]?.id ?? null)
  }

  const loadData = async () => {
    if (!API) { applyLocalData(); return }
    try {
      const [healthRes, summaryRes, layersRes, eventsRes] = await Promise.all([
        fetch(`${API}/health`), fetch(`${API}/api/dashboard`), fetch(`${API}/api/layers`), fetch(`${API}/api/events`),
      ])
      if (![healthRes, summaryRes, layersRes, eventsRes].every((r) => r.ok)) throw new Error('API unavailable')
      const [health, overview, layerData, eventData] = await Promise.all([
        healthRes.json(), summaryRes.json(), layersRes.json(), eventsRes.json(),
      ])
      setApiOnline(health.status === 'ok')
      setDataSource('api')
      setSummary(overview)
      setLayers(layerData.layers)
      setEvents(eventData.events)
      setActiveLayers(layerData.layers.map((l: Layer) => l.id))
      setSelectedId((current) => current ?? eventData.events[0]?.id ?? null)
    } catch {
      applyLocalData()
    }
  }

  useEffect(() => { void loadData() }, [])

  const selectedEvent = useMemo(() => events.find((event) => event.id === selectedId) ?? null, [events, selectedId])
  const filteredEvents = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return events.filter((event) => !needle || `${event.title} ${event.city} ${event.state} ${event.category}`.toLowerCase().includes(needle))
  }, [events, query])

  const toggleLayer = (id: string) => setActiveLayers((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])

  const askAnalyst = async (event: FormEvent) => {
    event.preventDefault()
    if (analystText.trim().length < 3) return
    setAnalystBusy(true)
    setAnalystAnswer('')
    try {
      const response = await fetch(`${API}/api/analyst`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: analystText, scope: 'india' }),
      })
      const body = await response.json()
      setAnalystAnswer(body.answer ?? 'No response returned.')
    } catch {
      setAnalystAnswer(localAnalystAnswer(analystText))
    } finally { setAnalystBusy(false) }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="mobile-menu icon-button" onClick={() => setMobileMenu(!mobileMenu)} aria-label="Toggle menu"><Menu size={18} /></button>
        <div className="brand-mark"><Globe2 size={19} /></div>
        <div className="brand-copy"><strong>INDIA AI <span>OS</span> MAPS</strong><small>GEOSPATIAL INTELLIGENCE NETWORK</small></div>
        <div className="top-divider" />
        <div className="workspace-label"><span className="live-dot" /> NATIONAL OVERVIEW</div>
        <div className="top-spacer" />
        <div className="environment-pill"><span /> DEMONSTRATION ENVIRONMENT</div>
        <button className="icon-button" title="Refresh data" onClick={() => void loadData()}><RefreshCw size={16} /></button>
        <button className="icon-button" title="Help" disabled><CircleHelp size={17} /></button>
        <div className="profile-chip">SA</div>
      </header>

      <div className="body-layout">
        <aside className={`sidebar ${mobileMenu ? 'sidebar-open' : ''}`}>
          <div className="sidebar-section-label">WORKSPACE</div>
          <button className="nav-item active"><Gauge size={17} /><span>Command overview</span><i /></button>
          <button className="nav-item" onClick={() => document.getElementById('map-panel')?.scrollIntoView({ behavior: 'smooth' })}><MapPin size={17} /><span>Geospatial explorer</span></button>
          <button className="nav-item" disabled title="Planned module"><Activity size={17} /><span>Live operations</span><span className="soon">ROADMAP</span></button>
          <button className="nav-item" onClick={() => document.getElementById('analyst-panel')?.scrollIntoView({ behavior: 'smooth' })}><Bot size={17} /><span>AI intelligence</span></button>
          <button className="nav-item" disabled title="Planned module"><BarChart3 size={17} /><span>Analytics studio</span></button>
          <button className="nav-item" disabled title="Planned module"><FileText size={17} /><span>Reports & briefings</span></button>
          <div className="sidebar-divider" />
          <div className="sidebar-section-label">SYSTEM</div>
          <button className="nav-item" disabled title="Planned module"><Database size={17} /><span>Data registry</span><span className="count">0</span></button>
          <button className="nav-item" disabled title="Planned module"><ShieldCheck size={17} /><span>Security & audit</span></button>
          <button className="nav-item" disabled title="Planned module"><Blocks size={17} /><span>Integrations</span></button>
          <div className="sidebar-bottom">
            <div className="system-card">
              <div className="system-card-head"><span className={apiOnline ? 'status-ok' : 'status-warn'} /> SYSTEM STATUS</div>
              <div className="system-row"><span>API service</span><b>{apiOnline ? 'ONLINE' : dataSource === 'local' ? 'BUNDLED DATA' : 'OFFLINE'}</b></div>
              <div className="system-row"><span>Official feeds</span><b>NOT LINKED</b></div>
              <div className="system-row"><span>Operating mode</span><b>DEMO</b></div>
            </div>
            <div className="sidebar-foot">STARLY INDUSTRIES · CONCEPT BUILD<br />v0.1.0 · LOCAL SANDBOX</div>
          </div>
        </aside>

        <main className="main-content">
          <section className="page-heading">
            <div>
              <div className="eyebrow"><span className="eyebrow-line" /> INDIA / NATIONAL SCOPE / OVERVIEW</div>
              <h1>National intelligence <em>workspace.</em></h1>
              <p>One geospatial canvas for understanding India's systems, infrastructure and environment.</p>
            </div>
            <div className="heading-actions">
              <button className="outline-button" onClick={() => setSearchOpen(!searchOpen)}><Search size={15} /> Search map</button>
              <button className="primary-button" onClick={() => document.getElementById('analyst-input')?.focus()}><Sparkles size={15} /> Ask India AI</button>
            </div>
          </section>

          <div className="notice-banner"><AlertTriangle size={16} /><div><strong>DEMO DATA ONLY</strong><span>All map markers and scenario records are synthetic. No official live feeds or operational alerts are connected.</span></div><button onClick={() => setAnalystAnswer('The current release uses synthetic test scenarios. Connect approved official sources before using it for real-world decisions.')}>Details <ArrowUpRight size={13} /></button></div>

          <section className="metrics-grid">
            <Metric icon={<Radio size={17} />} label="CONNECTED LIVE SOURCES" value="00" detail="No external feeds configured" tone="blue" />
            <Metric icon={<Layers3 size={17} />} label="THEMATIC LAYERS" value={String(summary?.layer_groups ?? 7).padStart(2, '0')} detail="Selectable map categories" tone="violet" />
            <Metric icon={<Activity size={17} />} label="DEMO SCENARIOS" value={String(summary?.demo_scenarios ?? 7).padStart(2, '0')} detail="Synthetic exercise records" tone="teal" />
            <Metric icon={<Bell size={17} />} label="VERIFIED LIVE ALERTS" value="00" detail="Not connected to alert services" tone="amber" />
          </section>

          <section className="work-grid">
            <div className="map-card panel" id="map-panel">
              <div className="panel-header map-header">
                <div><div className="panel-title"><Globe2 size={16} /> INDIA GEOSPATIAL CANVAS</div><div className="panel-subtitle">National overview · Pan and zoom to explore the demo markers</div></div>
                <div className="map-header-right"><span className="demo-tag">SIMULATED OVERLAYS</span><button className="icon-button small" title="Map options"><SlidersHorizontal size={15} /></button></div>
              </div>
              <div className="map-stage">
                <MapCanvas events={events} activeLayers={activeLayers} selectedId={selectedId} onSelect={setSelectedId} />
                <div className="map-coordinates"><span>LAT / LNG</span><b>INDIA · WGS84</b></div>
                <div className="map-hint"><Compass size={13} /> SELECT A MARKER TO INSPECT A SCENARIO</div>
                <div className="map-legend"><div className="legend-title">MAP KEY</div><div><i className="legend-dot red" /> Disaster</div><div><i className="legend-dot blue" /> Transport</div><div><i className="legend-dot gold" /> Climate</div><div><i className="legend-dot teal" /> Water</div></div>
              </div>
              <div className="map-footer"><span><span className="api-indicator" /> {apiOnline ? 'LOCAL API CONNECTED' : 'BUNDLED DEMO DATASET'}</span><span>BASEMAP: CARTO DARK · MAPLIBRE</span><span>DATA MODE: SYNTHETIC</span></div>
            </div>

            <aside className="right-column">
              <div className="panel layers-panel">
                <div className="panel-header"><div><div className="panel-title"><Layers3 size={16} /> INTELLIGENCE LAYERS</div><div className="panel-subtitle">Toggle map categories</div></div><span className="small-count">{activeLayers.length}/{layers.length}</span></div>
                <div className="layer-list">
                  {layers.map((layer) => {
                    const Icon = layerIcons[layer.id] ?? Layers3
                    const active = activeLayers.includes(layer.id)
                    return <button key={layer.id} className={`layer-row ${active ? 'layer-active' : ''}`} onClick={() => toggleLayer(layer.id)}><span className={`layer-icon ${layer.id}`}><Icon size={15} /></span><span className="layer-copy"><b>{layer.label}</b><small>{layer.description}</small></span><span className={`toggle ${active ? 'on' : ''}`}><i /></span></button>
                  })}
                </div>
                <button className="text-action" onClick={() => setActiveLayers(activeLayers.length === layers.length ? [] : layers.map((layer) => layer.id))}>{activeLayers.length === layers.length ? 'Clear all layers' : 'Enable all layers'} <ChevronDown size={13} /></button>
              </div>

              <div className="panel event-panel">
                <div className="panel-header"><div><div className="panel-title"><AlertTriangle size={16} /> SCENARIO MONITOR</div><div className="panel-subtitle">Synthetic test records · not official alerts</div></div><span className="small-count">{filteredEvents.length.toString().padStart(2, '0')}</span></div>
                {searchOpen && <div className="search-input-wrap"><Search size={14} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search city, state or layer…" autoFocus /></div>}
                <div className="event-list">
                  {filteredEvents.map((event) => <button key={event.id} className={`event-row ${selectedId === event.id ? 'event-selected' : ''}`} onClick={() => setSelectedId(event.id)}><span className={`event-severity ${event.severity}`} /><span className="event-copy"><b>{event.title}</b><small>{event.city}, {event.state}</small></span><span className="event-type">{event.category.toUpperCase()}</span></button>)}
                  {!filteredEvents.length && <div className="empty-state">No scenario matches your search.</div>}
                </div>
                {selectedEvent && <div className="selected-event"><div className="selected-event-top"><span>SELECTED SCENARIO</span><span className="simulated-badge">SIMULATED</span></div><strong>{selectedEvent.title}</strong><p>{selectedEvent.summary}</p><div className="event-meta"><span>{selectedEvent.city}, {selectedEvent.state}</span><span>Source: local fixture</span></div></div>}
              </div>
            </aside>
          </section>

          <section className="bottom-grid">
            <div className="panel analyst-panel" id="analyst-panel">
              <div className="panel-header"><div><div className="panel-title"><Sparkles size={16} /> INDIA AI ANALYST</div><div className="panel-subtitle">Ask a question about the current workspace</div></div><span className="prototype-badge">PLACEHOLDER</span></div>
              <form className="analyst-form" onSubmit={askAnalyst}><input id="analyst-input" value={analystText} onChange={(e) => setAnalystText(e.target.value)} placeholder="e.g. What data is required for a credible flood-risk assessment?" /><button className="primary-button" disabled={analystBusy || analystText.trim().length < 3}>{analystBusy ? 'Analysing…' : 'Ask'} <ArrowUpRight size={14} /></button></form>
              {analystAnswer && <div className="analyst-answer"><Bot size={15} /><span>{analystAnswer}</span></div>}
              <div className="analyst-foot"><ShieldCheck size={13} /> Demo response only. Production answers must cite source, timestamp, geography and uncertainty.</div>
            </div>
            <div className="panel readiness-panel">
              <div className="panel-header"><div><div className="panel-title"><Database size={16} /> DATA READINESS</div><div className="panel-subtitle">Integration status</div></div><span className="readiness-number">0%</span></div>
              <div className="readiness-bar"><span /></div>
              <div className="readiness-copy"><b>Connector registry not configured</b><span>Next: approve data sources, credentials, licences and refresh policies.</span></div>
              <div className="readiness-links"><a href="https://api.imd.gov.in/public/api_reference.html" target="_blank" rel="noreferrer">IMD APIs <ArrowUpRight size={12} /></a><a href="https://sachet.ndma.gov.in/CapFeed" target="_blank" rel="noreferrer">NDMA SACHET <ArrowUpRight size={12} /></a></div>
            </div>
          </section>

          <footer className="main-footer"><span>INDIA AI OS MAPS <b>·</b> STARLY INDUSTRIES</span><span>CONCEPT + LOCAL STARTER BUILD · NOT AN OFFICIAL GOVERNMENT PLATFORM</span><span>v0.1.0</span></footer>
        </main>
      </div>
    </div>
  )
}

function Metric({ icon, label, value, detail, tone }: { icon: React.ReactNode; label: string; value: string; detail: string; tone: string }) {
  return <div className="metric-card panel"><div className={`metric-icon ${tone}`}>{icon}</div><div className="metric-text"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div><div className="metric-corner" /></div>
}

export default App
