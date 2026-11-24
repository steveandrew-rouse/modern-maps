export type Layer = {
  id: string
  label: string
  description: string
  enabled: boolean
}

export type DemoEvent = {
  id: string
  category: string
  title: string
  city: string
  state: string
  lat: number
  lng: number
  severity: 'low' | 'medium' | 'high'
  status: 'SIMULATED'
  confidence: number | null
  summary: string
  source: string
  observed_at: string | null
}

export type DashboardSummary = {
  mode: string
  is_live: boolean
  live_sources: number
  demo_scenarios: number
  layer_groups: number
  last_updated: string
  notice: string
}
