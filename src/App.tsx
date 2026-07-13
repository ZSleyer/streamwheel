import {
  Bookmark,
  Check,
  ChevronDown,
  ChevronUp,
  Dices,
  Eye,
  EyeOff,
  FerrisWheel,
  Link as LinkIcon,
  PartyPopper,
  Plus,
  Settings,
  Sparkles,
  TriangleAlert,
  Video,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import Confetti from './Confetti'
import Wheel from './Wheel'
import { initialLang, messages, persistLang, type Lang } from './lib/i18n'
import { connectObs, packObsCreds, unpackObsCreds, type ObsConnection, type ObsStatus } from './lib/obs'

// Bookmark links carry obfuscated OBS credentials in the "k" query param.
const bookmarkCreds = unpackObsCreds(new URLSearchParams(window.location.search).get('k') ?? '')
import {
  MAX_ENTRIES,
  MAX_LABEL,
  colorOf,
  decodeWheel,
  effectiveWeights,
  encodeWheel,
  loadWheel,
  overrideSum,
  pickWinner,
  saveWheel,
  type Entry,
} from './lib/wheel'

const newEntry = (label: string): Entry => ({ id: crypto.randomUUID(), label })

/** Localized starter wheel with suggested weights, shown until the user edits it. */
const defaultEntries = (lang: Lang): Entry[] => [
  { ...newEntry(messages[lang].defCook), percent: 10 },
  { ...newEntry(messages[lang].defOrder), percent: 50 },
  { ...newEntry(messages[lang].defStarve), percent: 5 },
]

/** True when the wheel is still the untouched default set for `lang` (labels + weights, ignoring ids/colors). */
const matchesDefaults = (entries: Entry[], lang: Lang): boolean => {
  const d = defaultEntries(lang)
  return entries.length === d.length && entries.every((e, i) => e.label === d[i].label && e.percent === d[i].percent)
}

/** Overlay mode renders only the wheel on a transparent background (OBS browser source). */
const isOverlay = new URLSearchParams(window.location.search).has('overlay')

type PointerPos = 'top' | 'right' | 'bottom' | 'left'
const POINTER_ANGLE: Record<PointerPos, number> = { top: 0, right: 90, bottom: 180, left: 270 }
const isPointerPos = (v: unknown): v is PointerPos =>
  v === 'top' || v === 'right' || v === 'bottom' || v === 'left'

function initialPointerPos(): PointerPos {
  const fromUrl = new URLSearchParams(window.location.search).get('pointer')
  if (isPointerPos(fromUrl)) return fromUrl
  try {
    const stored = localStorage.getItem('rad:pointer')
    if (isPointerPos(stored)) return stored
  } catch {
    // fall through to default
  }
  return 'left'
}

/** URL hash wins over localStorage, both validated by decodeWheel. */
function initialEntries(lang: Lang): Entry[] {
  const hash = window.location.hash.slice(1)
  if (hash) {
    const fromHash = decodeWheel(hash)
    if (fromHash) return fromHash
  }
  return loadWheel() ?? defaultEntries(lang)
}

const inputClass =
  'w-full border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2 text-[var(--text-primary)] ' +
  'focus-visible:border-[var(--accent-blue)] focus-visible:outline-2 focus-visible:outline-offset-2 ' +
  'focus-visible:outline-[var(--accent-blue)]'

const buttonClass =
  'px-4 py-2 font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 ' +
  'focus-visible:outline-[var(--accent-blue)] disabled:cursor-not-allowed disabled:opacity-50'

const primaryClass = `${buttonClass} t-cut bg-[var(--accent-blue)] text-[var(--bg-primary)] hover:brightness-110`

const secondaryClass = `${buttonClass} border border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]`

const iconButtonClass =
  'flex h-10 w-10 shrink-0 items-center justify-center border border-[var(--border-subtle)] bg-[var(--bg-card)] ' +
  'text-[var(--text-secondary)] transition hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-blue)] ' +
  'disabled:cursor-not-allowed disabled:opacity-50'

type NumberFieldProps = {
  id: string
  value: string
  min: number
  max: number
  step?: number
  placeholder?: string
  inputMode?: 'numeric' | 'decimal'
  incLabel: string
  decLabel: string
  onChange: (value: string) => void
  'aria-describedby'?: string
}

/**
 * Number input with custom stepper buttons replacing the browser default spinners.
 * Buttons are 24px tall each (WCAG 2.5.8) inside a 48px-tall field; typing is passed
 * through raw so the parent can apply its own masking.
 */
function NumberField({
  id,
  value,
  min,
  max,
  step = 1,
  placeholder,
  inputMode = 'numeric',
  incLabel,
  decLabel,
  onChange,
  ...rest
}: NumberFieldProps) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n))
  const bump = (dir: 1 | -1) => {
    const base = value === '' ? min : Number(value)
    if (Number.isNaN(base)) return
    onChange(String(clamp(base + dir * step)))
  }
  return (
    <div className="relative">
      <input
        id={id}
        type="number"
        inputMode={inputMode}
        min={min}
        max={max}
        step="any"
        value={value}
        placeholder={placeholder}
        onChange={(ev) => onChange(ev.target.value)}
        className={`${inputClass} no-spinner h-12 pr-9`}
        aria-describedby={rest['aria-describedby']}
      />
      {/* Full input height so each 48/2=24px button meets WCAG 2.5.8 target size. */}
      <div className="absolute inset-y-0 right-0 flex w-8 flex-col overflow-hidden border-l border-[var(--border-subtle)]">
        <button
          type="button"
          aria-label={incLabel}
          onClick={() => bump(1)}
          className="flex flex-1 items-center justify-center bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset--2 focus-visible:outline-[var(--accent-blue)]"
        >
          <ChevronUp aria-hidden="true" className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label={decLabel}
          onClick={() => bump(-1)}
          className="flex flex-1 items-center justify-center border-t border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset--2 focus-visible:outline-[var(--accent-blue)]"
        >
          <ChevronDown aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

/** Wheel-of-fortune app: entry editor, SVG wheel, share link, OBS overlay mode. */
export default function App() {
  const [lang, setLang] = useState<Lang>(initialLang)
  const t = messages[lang]
  useEffect(() => persistLang(lang), [lang])

  // Re-localize the starter wheel on language switch, but only while it is still untouched.
  const prevLang = useRef(lang)
  useEffect(() => {
    const from = prevLang.current
    prevLang.current = lang
    if (from !== lang) setEntries((es) => (matchesDefaults(es, from) ? defaultEntries(lang) : es))
  }, [lang])

  const [entries, setEntries] = useState<Entry[]>(() => initialEntries(lang))
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [winner, setWinner] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const pendingWinner = useRef<string | null>(null)
  const finishTimer = useRef<number | undefined>(undefined)

  // Confetti is a per-browser preference; the overlay can force it off via ?confetti=0.
  const [confettiOn, setConfettiOn] = useState(() => {
    if (new URLSearchParams(window.location.search).get('confetti') === '0') return false
    try {
      return localStorage.getItem('rad:confetti') !== '0'
    } catch {
      return true
    }
  })
  const [burst, setBurst] = useState(false)
  const confettiRef = useRef(confettiOn)
  confettiRef.current = confettiOn
  useEffect(() => {
    if (isOverlay) return
    try {
      localStorage.setItem('rad:confetti', confettiOn ? '1' : '0')
    } catch {
      // best effort
    }
  }, [confettiOn])

  const weights = effectiveWeights(entries)
  const fixedSum = overrideSum(entries)
  const canSpin = entries.length >= 2 && !spinning

  const [pointerPos, setPointerPos] = useState<PointerPos>(initialPointerPos)
  useEffect(() => {
    if (isOverlay) return
    try {
      localStorage.setItem('rad:pointer', pointerPos)
    } catch {
      // best effort
    }
  }, [pointerPos])

  // Overlay auto-hide: fade out after `hide` seconds of inactivity, fade back
  // in on the next spin (with a short delay so the wheel is visible again).
  const hideAfter = isOverlay ? Number(new URLSearchParams(window.location.search).get('hide')) || 0 : 0
  const [overlayVisible, setOverlayVisible] = useState(true)
  const overlayVisibleRef = useRef(true)
  overlayVisibleRef.current = overlayVisible
  const hideTimer = useRef<number | undefined>(undefined)
  function armHideTimer() {
    if (!hideAfter) return
    clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => setOverlayVisible(false), hideAfter * 1000)
  }
  useEffect(() => {
    armHideTimer()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
  }, [])

  function spinTo(idx: number) {
    if (isOverlay && !overlayVisibleRef.current) {
      // Fade back in first, then spin; the winner index is fixed so the
      // result stays in sync with the editor page.
      setOverlayVisible(true)
      window.setTimeout(() => actions.current.spinTo(idx), 700)
      return
    }
    if (!canSpin || idx < 0 || idx >= entries.length) return
    const start = weights.slice(0, idx).reduce((s, w) => s + w, 0) * 3.6
    const sweep = weights[idx] * 3.6
    // Land somewhere inside the winning segment, not always dead center.
    const target = start + sweep / 2 + (Math.random() - 0.5) * sweep * 0.8
    const current = ((rotation % 360) + 360) % 360
    const pointer = POINTER_ANGLE[pointerPos]
    const next = rotation + 4 * 360 + ((pointer + 360 - ((target + current) % 360)) % 360)
    pendingWinner.current = entries[idx].label
    setWinner(null)
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setRotation(next)
      setWinner(pendingWinner.current)
    } else {
      setSpinning(true)
      setRotation(next)
      // Background tabs (e.g. OBS sources) may throttle rendering and never
      // fire transitionend, so finish via timer as a fallback.
      clearTimeout(finishTimer.current)
      finishTimer.current = window.setTimeout(onSpinEnd, 4300)
    }
  }

  function spin() {
    if (!canSpin) return
    const idx = pickWinner(weights)
    // Broadcast first so open overlays (same browser or inside OBS) spin to the same winner.
    bcRef.current?.postMessage({ type: 'spin', idx })
    obsRef.current?.emit('rad-spin', { idx })
    spinTo(idx)
  }

  // Remote control for the overlay running inside OBS (separate browser):
  // talk to the local obs-websocket server, which forwards events to browser sources.
  const [obsStatus, setObsStatus] = useState<ObsStatus>('disconnected')
  // Prefilled from bookmark links, see the bookmark button.
  const [obsHost, setObsHost] = useState(() => {
    if (bookmarkCreds) return bookmarkCreds.host
    try {
      return localStorage.getItem('rad:obs-host') ?? '127.0.0.1'
    } catch {
      return '127.0.0.1'
    }
  })
  const [obsPort, setObsPort] = useState(bookmarkCreds?.port ?? '4455')
  const [obsPassword, setObsPassword] = useState(bookmarkCreds?.password ?? '')
  const [showObsPassword, setShowObsPassword] = useState(false)
  useEffect(() => {
    if (isOverlay) return
    try {
      localStorage.setItem('rad:obs-host', obsHost)
    } catch {
      // best effort
    }
  }, [obsHost])
  const [bookmarkCopied, setBookmarkCopied] = useState(false)
  // Native <dialog> gives us focus trap, Escape and backdrop for free.
  const dialogRef = useRef<HTMLDialogElement | null>(null)
  const openSettings = () => dialogRef.current?.showModal()
  const closeSettings = () => dialogRef.current?.close()
  const obsRef = useRef<ObsConnection | null>(null)
  function toggleObs() {
    if (obsRef.current) {
      obsRef.current.close()
      obsRef.current = null
      setObsStatus('disconnected')
      return
    }
    obsRef.current = connectObs(obsHost, obsPort, obsPassword, (s) => {
      setObsStatus(s)
      if (s === 'connected') {
        obsRef.current?.emit('rad-wheel', { data: encodeWheel(entriesRef.current) })
      } else if (s === 'disconnected' || s === 'error') {
        obsRef.current = null
      }
    })
  }

  // A bookmark link carries the OBS credentials, so connect right away.
  // The ref guards against StrictMode double-mount toggling the connection off again.
  const autoConnected = useRef(false)
  useEffect(() => {
    if (!isOverlay && bookmarkCreds && !autoConnected.current) {
      autoConnected.current = true
      toggleObs()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
  }, [])

  async function copyObsBookmark() {
    const url = `${location.origin}${location.pathname}?k=${packObsCreds(obsHost, obsPort, obsPassword)}#${encodeWheel(entries)}`
    try {
      await navigator.clipboard.writeText(url)
      setBookmarkCopied(true)
      setTimeout(() => setBookmarkCopied(false), 2000)
    } catch {
      // Clipboard blocked, nothing sensible to fall back to for a secret-bearing link.
    }
  }

  // Live control channel between editor page and overlay (same browser).
  const bcRef = useRef<BroadcastChannel | null>(null)
  const actions = useRef({ spinTo, setEntries })
  actions.current = { spinTo, setEntries }
  useEffect(() => {
    const bc = new BroadcastChannel('rad')
    bcRef.current = bc
    if (isOverlay) {
      bc.onmessage = (ev) => {
        const m = ev.data
        if (m?.type === 'wheel' && typeof m.data === 'string') {
          const es = decodeWheel(m.data)
          if (es) actions.current.setEntries(es)
        } else if (m?.type === 'spin' && typeof m.idx === 'number') {
          actions.current.spinTo(m.idx)
        }
      }
    }
    return () => bc.close()
  }, [])

  useEffect(() => {
    if (isOverlay) return
    saveWheel(entries)
    bcRef.current?.postMessage({ type: 'wheel', data: encodeWheel(entries) })
    obsRef.current?.emit('rad-wheel', { data: encodeWheel(entries) })
    // A share hash goes stale as soon as the wheel changes, drop it
    // (keep the query string, bookmark links carry OBS credentials there).
    if (location.hash) history.replaceState(null, '', location.pathname + location.search)
  }, [entries])

  // Overlay: space spins even without focus (handy with OBS "Interact"), and
  // CustomEvents arrive from the editor page via obs-websocket emit_event.
  useEffect(() => {
    if (!isOverlay) return
    const onKey = (ev: KeyboardEvent) => {
      if (ev.code === 'Space') {
        ev.preventDefault()
        actions.current.spinTo(pickWinner(effectiveWeights(entriesRef.current)))
      }
    }
    const onObsSpin = (ev: Event) => {
      const idx = (ev as CustomEvent).detail?.idx
      if (typeof idx === 'number') actions.current.spinTo(idx)
    }
    const onObsWheel = (ev: Event) => {
      const data = (ev as CustomEvent).detail?.data
      if (typeof data === 'string') {
        const es = decodeWheel(data)
        if (es) actions.current.setEntries(es)
      }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('rad-spin', onObsSpin)
    window.addEventListener('rad-wheel', onObsWheel)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('rad-spin', onObsSpin)
      window.removeEventListener('rad-wheel', onObsWheel)
    }
  }, [])
  const entriesRef = useRef(entries)
  entriesRef.current = entries

  function onSpinEnd() {
    clearTimeout(finishTimer.current)
    setSpinning(false)
    setWinner(pendingWinner.current)
    armHideTimer()
    if (confettiRef.current && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setBurst(true)
      window.setTimeout(() => setBurst(false), 4200)
    }
  }

  function update(id: string, patch: Partial<Entry>) {
    setEntries((es) => es.map((e) => (e.id === id ? { ...e, ...patch } : e)))
  }

  function setPercent(id: string, value: string) {
    if (value === '') return update(id, { percent: undefined })
    const n = Number(value)
    if (Number.isFinite(n)) update(id, { percent: Math.min(100, Math.max(0, n)) })
  }

  async function share() {
    const url = `${location.origin}${location.pathname}#${encodeWheel(entries)}`
    history.replaceState(null, '', url)
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked: the shareable URL is already in the address bar.
    }
  }

  // Auto-hide seconds for the overlay link, configured on the editor page.
  const [hideSecs, setHideSecs] = useState(() => {
    try {
      return localStorage.getItem('rad:hide') ?? '0'
    } catch {
      return '0'
    }
  })
  useEffect(() => {
    if (isOverlay) return
    try {
      localStorage.setItem('rad:hide', hideSecs)
    } catch {
      // best effort
    }
  }, [hideSecs])
  const overlayHref = `?overlay${Number(hideSecs) > 0 ? `&hide=${Number(hideSecs)}` : ''}${pointerPos !== 'left' ? `&pointer=${pointerPos}` : ''}#${encodeWheel(entries)}`

  const wheelAlt = `${t.wheelAlt} ${entries.map((e) => e.label || '?').join(', ')}`
  const year = new Date().getFullYear()

  if (isOverlay) {
    return (
      <div
        className={`flex min-h-screen flex-col items-center justify-center gap-6 bg-transparent p-4 transition-opacity duration-700 motion-reduce:transition-none ${overlayVisible ? 'opacity-100' : 'opacity-0'}`}
      >
        {burst && <Confetti />}
        <button
          type="button"
          onClick={() => spinTo(pickWinner(weights))}
          disabled={!canSpin}
          aria-label={t.spin}
          className="w-full max-w-[min(88vw,80vh)] rounded-full focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent-blue)]"
        >
          <Wheel
            entries={entries}
            weights={weights}
            rotation={rotation}
            animate={spinning}
            ariaLabel={wheelAlt}
            onSpinEnd={onSpinEnd}
            pointerAngle={POINTER_ANGLE[pointerPos]}
            className="max-w-none drop-shadow-2xl"
          />
        </button>
        <p
          aria-live="polite"
          className="min-h-12 text-center text-4xl font-extrabold wrap-break-word text-white [text-shadow:0_2px_10px_rgba(0,0,0,0.9),0_0_2px_rgba(0,0,0,0.9)]"
        >
          {winner !== null && (
            <>
              <PartyPopper
                aria-hidden="true"
                className="mr-3 inline h-9 w-9 drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]"
              />
              {winner || '?'}
            </>
          )}
        </p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {burst && <Confetti />}
      <div className="mx-auto w-full max-w-6xl grow px-4 py-8">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-3 text-4xl font-extrabold tracking-tight uppercase">
              <FerrisWheel aria-hidden="true" className="h-9 w-9 shrink-0 text-[var(--accent-blue)]" />
              <span className="text-[var(--accent-blue)]">{t.appTitle}</span>
            </h1>
            <p className="mt-2 max-w-xl text-[var(--text-secondary)]">{t.tagline}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button type="button" onClick={openSettings} aria-label={t.openSettings} className={iconButtonClass}>
              <Settings aria-hidden="true" className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setLang(lang === 'de' ? 'en' : 'de')}
              aria-label={t.switchLang}
              className={secondaryClass}
            >
              {lang === 'de' ? 'EN' : 'DE'}
            </button>
          </div>
        </header>

        <main className="grid items-start gap-10 lg:grid-cols-[1.2fr_1fr]">
          <section aria-label={t.appTitle} className="lg:sticky lg:top-8">
            <Wheel
              entries={entries}
              weights={weights}
              rotation={rotation}
              animate={spinning}
              ariaLabel={wheelAlt}
              onSpinEnd={onSpinEnd}
              pointerAngle={POINTER_ANGLE[pointerPos]}
              className="max-w-lg drop-shadow-[0_20px_50px_rgba(99,102,241,0.35)]"
            />
            <div className="mt-8 flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={spin}
                disabled={!canSpin}
                className={`${primaryClass} flex w-full max-w-sm items-center justify-center gap-2 py-3 text-lg`}
              >
                <Dices aria-hidden="true" className="h-5 w-5" />
                {spinning ? t.spinning : t.spin}
              </button>
              {entries.length < 2 && <p className="text-sm">{t.needTwo}</p>}
              <p aria-live="polite" className="min-h-8 max-w-full text-center text-2xl font-bold wrap-break-word">
                {winner !== null && (
                  <>
                    <PartyPopper aria-hidden="true" className="mr-2 inline h-6 w-6 text-[var(--accent-blue)]" />
                    {t.winner}: {winner || '?'}
                  </>
                )}
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <button type="button" onClick={share} className={`${secondaryClass} flex items-center gap-2`}>
                  {copied ? <Check aria-hidden="true" className="h-5 w-5" /> : <LinkIcon aria-hidden="true" className="h-5 w-5" />}
                  {copied ? t.copied : t.share}
                </button>
                <a
                  href={overlayHref}
                  target="_blank"
                  rel="noopener"
                  className={`${secondaryClass} flex items-center gap-2`}
                >
                  <Video aria-hidden="true" className="h-5 w-5" />
                  {t.overlay}
                </a>
              </div>
              <p className="flex flex-wrap items-center justify-center gap-x-2 text-sm text-[var(--text-muted)]">
                <span aria-live="polite">
                  {obsStatus === 'connecting' && t.obsStatusConnecting}
                  {obsStatus === 'connected' && (
                    <span className="text-[var(--accent-green)]">
                      <Check aria-hidden="true" className="mr-1 inline h-4 w-4" />
                      {t.obsStatusConnected}
                    </span>
                  )}
                  {obsStatus === 'error' && (
                    <span className="text-[var(--accent-red)]">
                      <TriangleAlert aria-hidden="true" className="mr-1 inline h-4 w-4" />
                      {t.obsBadgeError}
                    </span>
                  )}
                  {obsStatus === 'disconnected' && t.obsShortHint}
                </span>
                <button
                  type="button"
                  onClick={openSettings}
                  className="inline-flex items-center gap-1 font-medium text-[var(--accent-blue)] underline underline-offset-2 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-blue)]"
                >
                  <Settings aria-hidden="true" className="h-4 w-4" />
                  {t.settings}
                </button>
              </p>

              <dialog
                ref={dialogRef}
                aria-labelledby="settings-title"
                onClick={(ev) => {
                  // A click landing on the dialog itself is a backdrop click (content sits in children).
                  if (ev.target === dialogRef.current) closeSettings()
                }}
                className="t-panel m-auto w-[calc(100%-2rem)] max-w-2xl p-6 text-[var(--text-primary)] backdrop:bg-black/60"
              >
                <div className="mb-4 flex items-center justify-between gap-4">
                  <h2 id="settings-title" className="flex items-center gap-2 text-xl font-semibold uppercase tracking-wide">
                    <Settings aria-hidden="true" className="h-5 w-5" />
                    {t.settings}
                  </h2>
                  <button type="button" onClick={closeSettings} aria-label={t.close} className={iconButtonClass}>
                    <X aria-hidden="true" className="h-5 w-5" />
                  </button>
                </div>
                <div className="flex flex-col gap-6">
                  {/* Section: display preferences, the simple everyday knobs. */}
                  <section className="flex flex-col gap-3">
                    <p className="t-label t-label--accent self-start">{t.secDisplay}</p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                        <input
                          type="checkbox"
                          checked={confettiOn}
                          onChange={(ev) => setConfettiOn(ev.target.checked)}
                          className="h-5 w-5 accent-[var(--accent-blue)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-blue)]"
                        />
                        <Sparkles aria-hidden="true" className="h-5 w-5" />
                        {t.confetti}
                      </label>
                      <div>
                        <label htmlFor="pointer-pos" className="mb-1 block text-sm">
                          {t.pointerPos}
                        </label>
                        <select
                          id="pointer-pos"
                          value={pointerPos}
                          onChange={(ev) => setPointerPos(ev.target.value as PointerPos)}
                          className={inputClass}
                        >
                          <option value="top">{t.posTop}</option>
                          <option value="right">{t.posRight}</option>
                          <option value="bottom">{t.posBottom}</option>
                          <option value="left">{t.posLeft}</option>
                        </select>
                      </div>
                    </div>
                  </section>

                  {/* Section: overlay embedding, one tip plus the idle-hide field. */}
                  <section className="flex flex-col gap-3 border-t border-[var(--border-subtle)] pt-5">
                    <p className="t-label t-label--accent self-start">{t.secOverlay}</p>
                    <div>
                      <label htmlFor="overlay-hide" className="mb-1 block text-sm">
                        {t.overlayHide}
                      </label>
                      <div className="w-28">
                        <NumberField
                          id="overlay-hide"
                          min={0}
                          max={3600}
                          value={hideSecs}
                          incLabel={t.stepUp}
                          decLabel={t.stepDown}
                          onChange={(v) => setHideSecs(v.replace(/\D/g, '').slice(0, 4))}
                        />
                      </div>
                    </div>
                  </section>

                  {/* Section: OBS remote control, the primary way to drive the overlay live. */}
                  <section className="flex flex-col gap-3 border-t border-[var(--border-subtle)] pt-5">
                    <p className="t-label t-label--accent self-start">{t.obsHeading}</p>
                    <div className="flex flex-col gap-3">
                      <p className="text-sm text-[var(--text-muted)]">{t.obsHint}</p>
                      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                        <div className="flex gap-3">
                          <div className="grow">
                            <label htmlFor="obs-host" className="mb-1 block text-sm">
                              {t.obsHost}
                            </label>
                            <input
                              id="obs-host"
                              type="text"
                              inputMode="url"
                              autoComplete="off"
                              value={obsHost}
                              disabled={obsStatus === 'connected' || obsStatus === 'connecting'}
                              onChange={(ev) => setObsHost(ev.target.value.trim())}
                              className={inputClass}
                            />
                          </div>
                          <div className="w-24 shrink-0">
                            <label htmlFor="obs-port" className="mb-1 block text-sm">
                              {t.obsPort}
                            </label>
                            <input
                              id="obs-port"
                              type="text"
                              inputMode="numeric"
                              value={obsPort}
                              disabled={obsStatus === 'connected' || obsStatus === 'connecting'}
                              onChange={(ev) => setObsPort(ev.target.value.replace(/\D/g, '').slice(0, 5))}
                              className={inputClass}
                            />
                          </div>
                        </div>
                        <div>
                          <label htmlFor="obs-password" className="mb-1 block text-sm">
                            {t.obsPassword}
                          </label>
                          <div className="relative">
                            <input
                              id="obs-password"
                              type={showObsPassword ? 'text' : 'password'}
                              autoComplete="off"
                              value={obsPassword}
                              disabled={obsStatus === 'connected' || obsStatus === 'connecting'}
                              onChange={(ev) => setObsPassword(ev.target.value)}
                              className={`${inputClass} pr-11`}
                            />
                            <button
                              type="button"
                              onClick={() => setShowObsPassword((s) => !s)}
                              aria-label={showObsPassword ? t.hidePassword : t.showPassword}
                              aria-pressed={showObsPassword}
                              className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset--2 focus-visible:outline-[var(--accent-blue)]"
                            >
                              {showObsPassword ? (
                                <EyeOff aria-hidden="true" className="h-5 w-5" />
                              ) : (
                                <Eye aria-hidden="true" className="h-5 w-5" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <button type="button" onClick={toggleObs} className={secondaryClass}>
                          {obsStatus === 'connected' || obsStatus === 'connecting' ? t.obsDisconnect : t.obsConnect}
                        </button>
                        <button
                          type="button"
                          onClick={copyObsBookmark}
                          className={`${secondaryClass} flex items-center gap-2`}
                        >
                          {bookmarkCopied ? (
                            <Check aria-hidden="true" className="h-5 w-5" />
                          ) : (
                            <Bookmark aria-hidden="true" className="h-5 w-5" />
                          )}
                          {bookmarkCopied ? t.copied : t.obsBookmark}
                        </button>
                      </div>
                      <p aria-live="polite" className="min-h-5 text-sm">
                        {obsStatus === 'error' && (
                          <span className="text-[var(--accent-red)]">{t.obsStatusError}</span>
                        )}
                      </p>
                      <p className="text-sm text-[var(--text-muted)]">{t.obsBookmarkHint}</p>
                    </div>
                  </section>
                </div>
              </dialog>
            </div>
          </section>

          <section
            aria-label={t.entries}
            className="t-panel p-6 shadow-xl"
          >
            <h2 className="mb-4 text-xl font-semibold uppercase tracking-wide">{t.entries}</h2>
            {fixedSum > 100 && (
              <p
                id="percent-warning"
                className="mb-4 border border-[var(--accent-yellow)] bg-[color-mix(in_srgb,var(--accent-yellow)_12%,transparent)] px-3 py-2 text-sm text-[var(--text-primary)]"
              >
                <TriangleAlert aria-hidden="true" className="mr-1 inline h-5 w-5" />
                {t.warnOver100}
              </p>
            )}
            <ul className="flex flex-col gap-3">
              {entries.map((e, i) => (
                <li key={e.id} className="flex items-start gap-2">
                  <div className="shrink-0">
                    <label htmlFor={`color-${e.id}`} className="sr-only">
                      {t.color} {e.label || i + 1}
                    </label>
                    <input
                      id={`color-${e.id}`}
                      type="color"
                      value={e.color ?? colorOf(i)}
                      onChange={(ev) => update(e.id, { color: ev.target.value })}
                      className="h-10 w-10 cursor-pointer overflow-hidden border border-[var(--border-subtle)] bg-transparent p-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-blue)]"
                    />
                  </div>
                  <div className="grow">
                    <label htmlFor={`label-${e.id}`} className="sr-only">
                      {t.entryLabel} {i + 1}
                    </label>
                    <input
                      id={`label-${e.id}`}
                      type="text"
                      value={e.label}
                      maxLength={MAX_LABEL}
                      placeholder={t.entryLabel}
                      onChange={(ev) => update(e.id, { label: ev.target.value })}
                      className={inputClass}
                    />
                  </div>
                  <div className="w-28 shrink-0">
                    <label htmlFor={`percent-${e.id}`} className="sr-only">
                      {t.entryPercent}, {t.entryLabel} {i + 1}
                    </label>
                    <NumberField
                      id={`percent-${e.id}`}
                      inputMode="decimal"
                      min={0}
                      max={100}
                      value={e.percent != null ? String(e.percent) : ''}
                      placeholder={`${weights[i].toFixed(1)} %`}
                      incLabel={t.stepUp}
                      decLabel={t.stepDown}
                      aria-describedby={fixedSum > 100 ? 'percent-warning' : undefined}
                      onChange={(v) => setPercent(e.id, v)}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setEntries((es) => es.filter((x) => x.id !== e.id))}
                    disabled={entries.length <= 1}
                    aria-label={`${t.removeEntry} ${e.label || i + 1}`}
                    className={iconButtonClass}
                  >
                    <X aria-hidden="true" className="h-5 w-5" />
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setEntries((es) => [...es, newEntry(`Option ${es.length + 1}`)])}
              disabled={entries.length >= MAX_ENTRIES}
              className={`${primaryClass} mt-4 flex items-center gap-2`}
            >
              <Plus aria-hidden="true" className="h-5 w-5" />
              {t.addEntry}
            </button>
            {entries.length >= MAX_ENTRIES && <p className="mt-2 text-sm">{t.maxReached}</p>}
          </section>
        </main>
      </div>

      <footer className="mt-10 border-t border-[var(--border-subtle)] bg-[var(--bg-secondary)] py-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 text-sm text-[var(--text-muted)]">
          <span className="flex items-center gap-2">
            <FerrisWheel aria-hidden="true" className="h-4 w-4" />
            {t.appTitle}
          </span>
          <a
            href="https://github.com/ZSleyer/streamwheel"
            target="_blank"
            rel="noopener"
            className="underline underline-offset-2 hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-blue)]"
          >
            GitHub
          </a>
          <a
            href="https://www.gnu.org/licenses/agpl-3.0.html"
            target="_blank"
            rel="noopener"
            className="underline underline-offset-2 hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-blue)]"
          >
            AGPL-3.0
          </a>
          <span>© {year > 2026 ? `2026 - ${year}` : year} ZSleyer</span>
        </div>
      </footer>
    </div>
  )
}
