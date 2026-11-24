export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info'

export type Layer = 'earthquake' | 'alert' | 'weather' | 'air' | 'flight'

export type Signal = {
  id: string
  layer: Layer
  title: string
  severity: Severity
  lat: number | null
  lng: number | null
  place: string
  time: string | null
  provider: string
  source: string
  url: string | null
  detail: string | null
  metrics: Record<string, string | number>
}

export type NewsItem = {
  id: string
  title: string
  url: string
  source: string
  published: string | null
  language?: string
}

export type SourceStatus = {
  id: string
  name: string
  provider: string
  license: string
  url: string
  ok: boolean
  records: number
  last_success: string | null
  last_error: string | null
  cadence_seconds: number
}

export type Snapshot = {
  generated_at: string
  signals: Signal[]
  news: NewsItem[]
  counts: Record<string, number>
  sources: SourceStatus[]
}

export type AnalystResponse = {
  mode: string
  is_llm: boolean
  grounded_at: string
  answer: string
  evidence: { id: string; title: string; provider: string; severity: string; url: string | null }[]
  limitations: string[]
}
