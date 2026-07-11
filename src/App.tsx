import {
  Check,
  Dices,
  FerrisWheel,
  Link as LinkIcon,
  PartyPopper,
  Plus,
  Sparkles,
  TriangleAlert,
  Video,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import Confetti from './Confetti'
import Wheel from './Wheel'
import { initialLang, messages, persistLang, type Lang } from './lib/i18n'
import { connectObs, type ObsConnection, type ObsStatus } from './lib/obs'
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

const defaultEntries = () => ['Pizza', 'Pasta', 'Sushi', 'Tacos'].map(newEntry)

/** Overlay mode renders only the wheel on a transparent background (OBS browser source). */
const isOverlay = new URLSearchParams(window.location.search).has('overlay')

/** URL hash wins over localStorage, both validated by decodeWheel. */
function initialEntries(): Entry[] {
  const hash = window.location.hash.slice(1)
  if (hash) {
    const fromHash = decodeWheel(hash)
    if (fromHash) return fromHash
  }
  return loadWheel() ?? defaultEntries()
}

const inputClass =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuchsia-600 ' +
  'dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100'

const buttonClass =
  'rounded-xl px-4 py-2 font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 ' +
  'focus-visible:outline-fuchsia-600 disabled:cursor-not-allowed disabled:opacity-50'

const primaryClass = `${buttonClass} bg-linear-to-r from-indigo-600 to-fuchsia-600 text-white hover:brightness-110`

const secondaryClass = `${buttonClass} border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700`

const iconButtonClass =
  'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-300 bg-white ' +
  'text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 ' +
  'focus-visible:outline-fuchsia-600 disabled:cursor-not-allowed disabled:opacity-50 ' +
  'dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'

/** Wheel-of-fortune app: entry editor, SVG wheel, share link, OBS overlay mode. */
export default function App() {
  const [lang, setLang] = useState<Lang>(initialLang)
  const t = messages[lang]
  useEffect(() => persistLang(lang), [lang])

  const [entries, setEntries] = useState<Entry[]>(initialEntries)
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

  function spinTo(idx: number) {
    if (!canSpin || idx < 0 || idx >= entries.length) return
    const start = weights.slice(0, idx).reduce((s, w) => s + w, 0) * 3.6
    const sweep = weights[idx] * 3.6
    // Land somewhere inside the winning segment, not always dead center.
    const target = start + sweep / 2 + (Math.random() - 0.5) * sweep * 0.8
    const current = ((rotation % 360) + 360) % 360
    const next = rotation + 4 * 360 + ((360 - ((target + current) % 360)) % 360)
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
  const [obsPort, setObsPort] = useState('4455')
  const [obsPassword, setObsPassword] = useState('')
  const obsRef = useRef<ObsConnection | null>(null)
  function toggleObs() {
    if (obsRef.current) {
      obsRef.current.close()
      obsRef.current = null
      setObsStatus('disconnected')
      return
    }
    obsRef.current = connectObs(obsPort, obsPassword, (s) => {
      setObsStatus(s)
      if (s === 'connected') {
        obsRef.current?.emit('rad-wheel', { data: encodeWheel(entriesRef.current) })
      } else if (s === 'disconnected' || s === 'error') {
        obsRef.current = null
      }
    })
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
    // A share hash goes stale as soon as the wheel changes, drop it.
    if (location.hash) history.replaceState(null, '', location.pathname)
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

  const wheelAlt = `${t.wheelAlt} ${entries.map((e) => e.label || '?').join(', ')}`

  if (isOverlay) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-transparent p-4">
        {burst && <Confetti />}
        <button
          type="button"
          onClick={() => spinTo(pickWinner(weights))}
          disabled={!canSpin}
          aria-label={t.spin}
          className="w-full max-w-[min(88vw,80vh)] rounded-full focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-fuchsia-500"
        >
          <Wheel
            entries={entries}
            weights={weights}
            rotation={rotation}
            animate={spinning}
            ariaLabel={wheelAlt}
            onSpinEnd={onSpinEnd}
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
    <div className="min-h-screen bg-linear-to-b from-slate-100 via-indigo-100 to-slate-100 text-slate-900 dark:from-slate-950 dark:via-indigo-950 dark:to-slate-950 dark:text-slate-100">
      {burst && <Confetti />}
      <div className="mx-auto max-w-6xl px-4 py-8">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-3 text-4xl font-extrabold tracking-tight">
              <FerrisWheel aria-hidden="true" className="h-9 w-9 shrink-0 text-fuchsia-600 dark:text-fuchsia-400" />
              <span className="bg-linear-to-r from-indigo-600 to-fuchsia-600 bg-clip-text text-transparent dark:from-indigo-400 dark:to-fuchsia-400">
                {t.appTitle}
              </span>
            </h1>
            <p className="mt-2 max-w-xl text-slate-700 dark:text-slate-300">{t.tagline}</p>
          </div>
          <button
            type="button"
            onClick={() => setLang(lang === 'de' ? 'en' : 'de')}
            aria-label={t.switchLang}
            className={secondaryClass}
          >
            {lang === 'de' ? 'EN' : 'DE'}
          </button>
        </header>

        <main className="grid items-start gap-8 lg:grid-cols-[3fr_2fr]">
          <section
            aria-label={t.appTitle}
            className="rounded-3xl bg-white p-6 shadow-xl ring-1 ring-slate-200 sm:p-8 dark:bg-slate-900 dark:shadow-[0_0_80px_-20px] dark:shadow-indigo-500/30 dark:ring-white/10"
          >
            <Wheel
              entries={entries}
              weights={weights}
              rotation={rotation}
              animate={spinning}
              ariaLabel={wheelAlt}
              onSpinEnd={onSpinEnd}
              className="max-w-lg"
            />
            <div className="mt-8 flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={spin}
                disabled={!canSpin}
                className={`${primaryClass} flex w-full max-w-sm items-center justify-center gap-2 py-3 text-lg shadow-lg shadow-fuchsia-600/20`}
              >
                <Dices aria-hidden="true" className="h-5 w-5" />
                {spinning ? t.spinning : t.spin}
              </button>
              {entries.length < 2 && <p className="text-sm">{t.needTwo}</p>}
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={confettiOn}
                  onChange={(ev) => setConfettiOn(ev.target.checked)}
                  className="h-5 w-5 accent-fuchsia-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuchsia-600"
                />
                <Sparkles aria-hidden="true" className="h-5 w-5" />
                {t.confetti}
              </label>
              <p aria-live="polite" className="min-h-8 max-w-full text-center text-2xl font-bold wrap-break-word">
                {winner !== null && (
                  <>
                    <PartyPopper aria-hidden="true" className="mr-2 inline h-6 w-6 text-fuchsia-600 dark:text-fuchsia-400" />
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
                  href={`?overlay#${encodeWheel(entries)}`}
                  target="_blank"
                  rel="noopener"
                  className={`${secondaryClass} flex items-center gap-2`}
                >
                  <Video aria-hidden="true" className="h-5 w-5" />
                  {t.overlay}
                </a>
              </div>
              <p className="max-w-md text-center text-sm text-slate-600 dark:text-slate-400">{t.overlayTip}</p>

              <div className="mt-2 w-full max-w-md rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                <h2 className="mb-1 flex items-center gap-2 font-semibold">
                  <Video aria-hidden="true" className="h-5 w-5" />
                  {t.obsHeading}
                </h2>
                <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">{t.obsHint}</p>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="w-24">
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
                  <div className="min-w-40 grow">
                    <label htmlFor="obs-password" className="mb-1 block text-sm">
                      {t.obsPassword}
                    </label>
                    <input
                      id="obs-password"
                      type="password"
                      autoComplete="off"
                      value={obsPassword}
                      disabled={obsStatus === 'connected' || obsStatus === 'connecting'}
                      onChange={(ev) => setObsPassword(ev.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <button type="button" onClick={toggleObs} className={secondaryClass}>
                    {obsStatus === 'connected' || obsStatus === 'connecting' ? t.obsDisconnect : t.obsConnect}
                  </button>
                </div>
                <p aria-live="polite" className="mt-2 min-h-5 text-sm">
                  {obsStatus === 'connecting' && t.obsStatusConnecting}
                  {obsStatus === 'connected' && (
                    <span className="text-emerald-700 dark:text-emerald-400">
                      <Check aria-hidden="true" className="mr-1 inline h-4 w-4" />
                      {t.obsStatusConnected}
                    </span>
                  )}
                  {obsStatus === 'error' && (
                    <span className="text-red-700 dark:text-red-400">
                      <TriangleAlert aria-hidden="true" className="mr-1 inline h-4 w-4" />
                      {t.obsStatusError}
                    </span>
                  )}
                </p>
              </div>
            </div>
          </section>

          <section
            aria-label={t.entries}
            className="rounded-3xl bg-white p-6 shadow-xl ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-white/10"
          >
            <h2 className="mb-4 text-xl font-semibold">{t.entries}</h2>
            {fixedSum > 100 && (
              <p
                id="percent-warning"
                className="mb-4 rounded-xl border border-amber-600 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200"
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
                      className="h-10 w-10 cursor-pointer rounded-xl border border-slate-300 bg-white p-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuchsia-600 dark:border-slate-600 dark:bg-slate-950"
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
                    <input
                      id={`percent-${e.id}`}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={100}
                      step="any"
                      value={e.percent ?? ''}
                      placeholder={t.auto}
                      aria-describedby={fixedSum > 100 ? 'percent-warning' : undefined}
                      onChange={(ev) => setPercent(e.id, ev.target.value)}
                      className={inputClass}
                    />
                    <p className="mt-0.5 text-xs text-slate-700 dark:text-slate-300">
                      = {weights[i].toFixed(1)} %
                    </p>
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
    </div>
  )
}
