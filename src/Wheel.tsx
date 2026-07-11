import { colorOf, type Entry } from './lib/wheel'

type Props = {
  entries: Entry[]
  weights: number[]
  rotation: number
  animate: boolean
  ariaLabel: string
  onSpinEnd: () => void
}

const CX = 100
const CY = 100
const R = 96

const point = (angle: number, r: number) => {
  const rad = ((angle - 90) * Math.PI) / 180
  return [CX + r * Math.cos(rad), CY + r * Math.sin(rad)] as const
}

function segmentPath(a0: number, a1: number): string {
  const [x0, y0] = point(a0, R)
  const [x1, y1] = point(a1, R)
  const large = a1 - a0 > 180 ? 1 : 0
  return `M ${CX} ${CY} L ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1} Z`
}

export default function Wheel({ entries, weights, rotation, animate, ariaLabel, onSpinEnd }: Props) {
  let acc = 0
  const segments = entries.map((e, i) => {
    const a0 = acc
    const sweep = (weights[i] / 100) * 360
    acc += sweep
    return { entry: e, i, a0, a1: acc, mid: a0 + sweep / 2, sweep }
  })

  return (
    <div className="relative mx-auto w-full max-w-md">
      {/* Zeiger oben */}
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-0 z-10 h-0 w-0 -translate-x-1/2 border-x-[12px] border-t-[20px] border-x-transparent border-t-slate-900 drop-shadow dark:border-t-white"
      />
      <svg viewBox="0 0 200 200" role="img" aria-label={ariaLabel} className="w-full">
        <g
          style={{
            transform: `rotate(${rotation}deg)`,
            transformOrigin: '100px 100px',
            transition: animate ? 'transform 4s cubic-bezier(0.2, 0.6, 0.1, 1)' : 'none',
          }}
          onTransitionEnd={(ev) => ev.propertyName === 'transform' && onSpinEnd()}
        >
          {segments.map(({ entry, i, a0, a1, mid, sweep }) => {
            if (sweep <= 0) return null
            if (sweep >= 359.99) {
              return <circle key={entry.id} cx={CX} cy={CY} r={R} fill={colorOf(i)} />
            }
            return <path key={entry.id} d={segmentPath(a0, a1)} fill={colorOf(i)} stroke="white" strokeWidth="1" />
          })}
          {segments.map(({ entry, i, mid, sweep }) => {
            if (sweep < 14) return null
            const [x, y] = point(mid, R * 0.62)
            const label = entry.label.length > 12 ? entry.label.slice(0, 11) + '…' : entry.label
            return (
              <text
                key={entry.id}
                x={x}
                y={y}
                fill="white"
                fontSize="9"
                fontWeight="600"
                textAnchor="middle"
                dominantBaseline="middle"
                transform={`rotate(${mid} ${x} ${y})`}
                aria-hidden="true"
              >
                {label}
              </text>
            )
          })}
        </g>
        <circle cx={CX} cy={CY} r="10" fill="white" stroke="#334155" strokeWidth="2" />
      </svg>
    </div>
  )
}
