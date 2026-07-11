export type Entry = {
  id: string
  label: string
  /** Fixed percentage (0-100). If absent, the remainder is split evenly. */
  percent?: number
  /** Custom segment color (#rrggbb). If absent, the palette color is used. */
  color?: string
}

export const MAX_ENTRIES = 24
export const MAX_LABEL = 60
const STORAGE_KEY = 'rad:v1'

// Dark colors, all with contrast >= 4.5:1 against white text.
export const PALETTE = [
  '#1d4ed8', // blue
  '#b91c1c', // red
  '#047857', // green
  '#6d28d9', // violet
  '#92400e', // amber
  '#be185d', // pink
  '#0e7490', // cyan
  '#3f6212', // lime
]

export const colorOf = (index: number) => PALETTE[index % PALETTE.length]

/** Sum of the fixed percentages (used for the > 100 warning). */
export const overrideSum = (entries: Entry[]) =>
  entries.reduce((s, e) => s + (e.percent ?? 0), 0)

/** Effective probability per entry in %, summing to 100. */
export function effectiveWeights(entries: Entry[]): number[] {
  if (entries.length === 0) return []
  const fixedSum = overrideSum(entries)
  const freeCount = entries.filter((e) => e.percent === undefined).length
  const freeShare = freeCount > 0 ? Math.max(0, 100 - fixedSum) / freeCount : 0
  const raw = entries.map((e) => e.percent ?? freeShare)
  const total = raw.reduce((s, r) => s + r, 0)
  // All zero or sum != 100 (e.g. overrides > 100): normalize proportionally.
  if (total <= 0) return entries.map(() => 100 / entries.length)
  return raw.map((r) => (r / total) * 100)
}

/** Weighted random pick, returns the winner's index. */
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

/** Compact format for URL hash and localStorage: [{l, p?, c?}, ...] as base64url. */
export function encodeWheel(entries: Entry[]): string {
  const data = entries.map((e) => ({
    l: e.label,
    ...(e.percent !== undefined ? { p: e.percent } : {}),
    ...(e.color !== undefined ? { c: e.color } : {}),
  }))
  const bytes = new TextEncoder().encode(JSON.stringify(data))
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

/**
 * Single trust boundary for external data (URL hash, localStorage):
 * strict validation, returns null on any error.
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
      const { l, p, c } = item as Record<string, unknown>
      if (typeof l !== 'string' || l.length > MAX_LABEL) return null
      if (p !== undefined && (typeof p !== 'number' || !Number.isFinite(p) || p < 0 || p > 100)) return null
      if (c !== undefined && (typeof c !== 'string' || !/^#[0-9a-f]{6}$/i.test(c))) return null
      entries.push({
        id: crypto.randomUUID(),
        label: l,
        ...(p !== undefined ? { percent: p } : {}),
        ...(c !== undefined ? { color: c } : {}),
      })
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
    // localStorage full or blocked, the app keeps working without it.
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
