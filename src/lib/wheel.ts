export type Entry = {
  id: string
  label: string
  /** Fester Prozentwert (0–100). Fehlt er, wird der Rest gleichmäßig verteilt. */
  percent?: number
}

export const MAX_ENTRIES = 24
export const MAX_LABEL = 60
const STORAGE_KEY = 'rad:v1'

// Dunkle Farben, alle mit Kontrast ≥ 4.5:1 zu weißem Text.
export const PALETTE = [
  '#1d4ed8', // blau
  '#b91c1c', // rot
  '#047857', // grün
  '#6d28d9', // violett
  '#92400e', // amber
  '#be185d', // pink
  '#0e7490', // cyan
  '#3f6212', // lime
]

export const colorOf = (index: number) => PALETTE[index % PALETTE.length]

/** Summe der fest gesetzten Prozente (für Warnung > 100). */
export const overrideSum = (entries: Entry[]) =>
  entries.reduce((s, e) => s + (e.percent ?? 0), 0)

/** Effektive Wahrscheinlichkeit je Eintrag in %, Summe 100. */
export function effectiveWeights(entries: Entry[]): number[] {
  if (entries.length === 0) return []
  const fixedSum = overrideSum(entries)
  const freeCount = entries.filter((e) => e.percent === undefined).length
  const freeShare = freeCount > 0 ? Math.max(0, 100 - fixedSum) / freeCount : 0
  const raw = entries.map((e) => e.percent ?? freeShare)
  const total = raw.reduce((s, r) => s + r, 0)
  // Alles 0 oder Summe ≠ 100 (z.B. Overrides > 100): proportional normalisieren.
  if (total <= 0) return entries.map(() => 100 / entries.length)
  return raw.map((r) => (r / total) * 100)
}

/** Gewichtete Zufallsauswahl, Index des Gewinners. */
export function pickWinner(weights: number[]): number {
  const total = weights.reduce((s, w) => s + w, 0)
  const r = (crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32) * total
  let acc = 0
  for (let i = 0; i < weights.length; i++) {
    acc += weights[i]
    if (r < acc) return i
  }
  return weights.length - 1
}

/** Kompaktes Format für URL-Hash und localStorage: [{l, p?}, …] als base64url. */
export function encodeWheel(entries: Entry[]): string {
  const data = entries.map((e) => ({
    l: e.label,
    ...(e.percent !== undefined ? { p: e.percent } : {}),
  }))
  const bytes = new TextEncoder().encode(JSON.stringify(data))
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

/**
 * Einzige Vertrauensgrenze für externe Daten (URL-Hash, localStorage):
 * strikte Validierung, bei jedem Fehler null.
 */
export function decodeWheel(encoded: string): Entry[] | null {
  try {
    const b64 = encoded.replaceAll('-', '+').replaceAll('_', '/')
    const bin = atob(b64)
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
    const data: unknown = JSON.parse(new TextDecoder().decode(bytes))
    if (!Array.isArray(data) || data.length < 1 || data.length > MAX_ENTRIES) return null
    const entries: Entry[] = []
    for (const item of data) {
      if (typeof item !== 'object' || item === null) return null
      const { l, p } = item as Record<string, unknown>
      if (typeof l !== 'string' || l.length < 1 || l.length > MAX_LABEL) return null
      if (p !== undefined && (typeof p !== 'number' || !Number.isFinite(p) || p < 0 || p > 100)) return null
      entries.push({ id: crypto.randomUUID(), label: l, ...(p !== undefined ? { percent: p } : {}) })
    }
    return entries
  } catch {
    return null
  }
}

export function saveWheel(entries: Entry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, encodeWheel(entries))
  } catch {
    // localStorage voll oder blockiert — App funktioniert ohne weiter.
  }
}

export function loadWheel(): Entry[] | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? decodeWheel(stored) : null
  } catch {
    return null
  }
}
