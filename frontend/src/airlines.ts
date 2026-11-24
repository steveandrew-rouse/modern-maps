import type { Map as MapLibreMap } from 'maplibre-gl'

/**
 * Airline liveries keyed by the ICAO callsign prefix that OpenSky reports in the
 * `callsign` field (for example "IGO1074" is IndiGo). Colours are approximations
 * of each carrier's published livery, used to paint the map icons and the 3D
 * aircraft model. OpenSky's state vectors do not carry an airframe type, so the
 * model is a generic narrowbody wherever the type is unknown.
 */
export type Livery = {
  code: string
  airline: string
  body: string
  accent: string
  trim: string
}

const TABLE: Record<string, Omit<Livery, 'code'>> = {
  AIC: { airline: 'Air India', body: '#f1e7d6', accent: '#b51f2e', trim: '#d9a54a' },
  IGO: { airline: 'IndiGo', body: '#f4f6fa', accent: '#1a2f7a', trim: '#3a5bd9' },
  SEJ: { airline: 'SpiceJet', body: '#f6f7f9', accent: '#d8212b', trim: '#f2b134' },
  AXB: { airline: 'Air India Express', body: '#f6f2ea', accent: '#d0342c', trim: '#f0a03c' },
  AKJ: { airline: 'Akasa Air', body: '#f7f7f8', accent: '#5b2d8e', trim: '#f47b20' },
  LLR: { airline: 'Alliance Air', body: '#f3f3f4', accent: '#c8102e', trim: '#1f6fb2' },
  BAW: { airline: 'British Airways', body: '#f2f3f5', accent: '#1f3a6e', trim: '#c8102e' },
  UAE: { airline: 'Emirates', body: '#f6f4ef', accent: '#c8102e', trim: '#d4af37' },
  THY: { airline: 'Turkish Airlines', body: '#f4f5f7', accent: '#c8102e', trim: '#0b2a5b' },
  QFA: { airline: 'Qantas', body: '#f3f4f6', accent: '#d0202f', trim: '#1b2a4a' },
  SIA: { airline: 'Singapore Airlines', body: '#f5f5f3', accent: '#1d2c5b', trim: '#d9b451' },
  DLH: { airline: 'Lufthansa', body: '#f2f4f7', accent: '#05164d', trim: '#f2b705' },
  AFR: { airline: 'Air France', body: '#f4f5f7', accent: '#002157', trim: '#e2001a' },
  ETD: { airline: 'Etihad Airways', body: '#f6f5f1', accent: '#b58a3c', trim: '#5a4a35' },
  QTR: { airline: 'Qatar Airways', body: '#f4f2ee', accent: '#5c0632', trim: '#9a8b6d' },
  SVA: { airline: 'Saudia', body: '#f5f4f1', accent: '#00674a', trim: '#c8a55c' },
  KAL: { airline: 'Korean Air', body: '#f5f6f8', accent: '#1e4b8f', trim: '#0b2340' },
  EVA: { airline: 'EVA Air', body: '#f4f6f2', accent: '#0d6b3f', trim: '#f0a93c' },
  CPA: { airline: 'Cathay Pacific', body: '#f4f5f2', accent: '#00645a', trim: '#7c8a86' },
  ANA: { airline: 'All Nippon Airways', body: '#f4f6fa', accent: '#0b2e6f', trim: '#4a86c8' },
  VTI: { airline: 'Vistara', body: '#f2eef4', accent: '#5b2b6b', trim: '#c9a227' },
}

const UNLISTED: Livery = {
  code: 'UNK',
  airline: 'Operator not in livery table',
  body: '#e9edf2',
  accent: '#5f7183',
  trim: '#9db0c2',
}

/** Prefix of an OpenSky callsign. Hex-only identifiers fall through to UNK. */
export function callsignPrefix(callsign: string): string {
  const prefix = callsign.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase()
  return /^[A-Z]{3}$/.test(prefix) ? prefix : 'UNK'
}

export function liveryFor(callsign: string): Livery {
  const code = callsignPrefix(callsign)
  const entry = TABLE[code]
  return entry ? { code, ...entry } : UNLISTED
}

export const LIVERIES: Livery[] = Object.entries(TABLE).map(([code, entry]) => ({ code, ...entry }))

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  context.beginPath()
  context.moveTo(x + r, y)
  context.lineTo(x + w - r, y)
  context.quadraticCurveTo(x + w, y, x + w, y + r)
  context.lineTo(x + w, y + h - r)
  context.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  context.lineTo(x + r, y + h)
  context.quadraticCurveTo(x, y + h, x, y + h - r)
  context.lineTo(x, y + r)
  context.quadraticCurveTo(x, y, x + r, y)
  context.closePath()
}

/**
 * Top-down airliner silhouette, nose pointing to -Y (north), drawn per livery so
 * each aircraft carries its operator's colours instead of a generic dot.
 */
function drawPlane(livery: Livery): ImageData {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (!context) throw new Error('2D canvas unavailable')

  context.scale(2, 2)
  context.translate(16, 16)

  // Wings
  context.fillStyle = 'rgba(214, 220, 228, 0.95)'
  context.beginPath()
  context.moveTo(0.6, -4.4)
  context.lineTo(14.6, 2.6)
  context.lineTo(14.6, 4.1)
  context.lineTo(1.6, 1.6)
  context.lineTo(1.6, 6.4)
  context.lineTo(0.6, 6.4)
  context.closePath()
  context.fill()
  context.beginPath()
  context.moveTo(-0.6, -4.4)
  context.lineTo(-14.6, 2.6)
  context.lineTo(-14.6, 4.1)
  context.lineTo(-1.6, 1.6)
  context.lineTo(-1.6, 6.4)
  context.lineTo(-0.6, 6.4)
  context.closePath()
  context.fill()

  // Horizontal stabilisers
  context.fillStyle = livery.accent
  context.beginPath()
  context.moveTo(0.5, 6.2)
  context.lineTo(5.2, 8.2)
  context.lineTo(5.2, 9)
  context.lineTo(0.5, 8)
  context.closePath()
  context.fill()
  context.beginPath()
  context.moveTo(-0.5, 6.2)
  context.lineTo(-5.2, 8.2)
  context.lineTo(-5.2, 9)
  context.lineTo(-0.5, 8)
  context.closePath()
  context.fill()

  // Fuselage
  context.fillStyle = livery.body
  roundedRect(context, -1.5, -10.6, 3, 20.2, 1.45)
  context.fill()
  context.strokeStyle = 'rgba(20, 28, 36, 0.55)'
  context.lineWidth = 0.35
  context.stroke()

  // Tail fin
  context.fillStyle = livery.accent
  context.beginPath()
  context.moveTo(-0.5, 6.6)
  context.lineTo(0.5, 6.6)
  context.lineTo(1.6, 10.9)
  context.lineTo(-1.6, 10.9)
  context.closePath()
  context.fill()

  // Cheatline
  context.fillStyle = livery.trim
  context.fillRect(-1.5, -3.4, 3, 0.6)

  return context.getImageData(0, 0, size, size)
}

/** Register one symbol image per livery (plus a neutral fallback) on the map. */
export function addPlaneIcons(map: MapLibreMap) {
  for (const livery of [...LIVERIES, UNLISTED]) {
    const id = `plane-${livery.code}`
    if (map.hasImage(id)) continue
    map.addImage(id, drawPlane(livery), { pixelRatio: 2 })
  }
}
