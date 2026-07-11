import { colorOf, type Entry } from './lib/wheel'

type Props = {
  entries: Entry[]
  weights: number[]
  rotation: number
  animate: boolean
  ariaLabel: string
  onSpinEnd: () => void
  /** Pointer position on the rim in degrees: 0 top, 90 right, 180 bottom, 270 left. */
  pointerAngle?: number
  className?: string
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

/** SVG wheel of fortune. Purely presentational, spinning is driven via the rotation prop. */
export default function Wheel({
  entries,
  weights,
  rotation,
  animate,
  ariaLabel,
  onSpinEnd,
  pointerAngle = 0,
  className = 'max-w-md',
}: Props) {
  let acc = 0
  const segments = entries.map((e, i) => {
    const a0 = acc
    const sweep = (weights[i] / 100) * 360
    acc += sweep
    return { entry: e, i, a0, a1: acc, mid: a0 + sweep / 2, sweep }
  })

  return (
    <div className={`relative mx-auto w-full ${className}`}>
      <svg viewBox="0 0 200 200" role="img" aria-label={ariaLabel} className="w-full">
        <g
          style={{
            transform: `rotate(${rotation}deg)`,
            transformOrigin: '100px 100px',
            transition: animate ? 'transform 4s cubic-bezier(0.2, 0.6, 0.1, 1)' : 'none',
          }}
          onTransitionEnd={(ev) => ev.propertyName === 'transform' && onSpinEnd()}
        >
          {segments.map(({ entry, i, a0, a1, sweep }) => {
            if (sweep <= 0) return null
            const fill = entry.color ?? colorOf(i)
            if (sweep >= 359.99) {
              return <circle key={entry.id} cx={CX} cy={CY} r={R} fill={fill} />
            }
            return <path key={entry.id} d={segmentPath(a0, a1)} fill={fill} stroke="white" strokeWidth="1" />
          })}
          {segments.map(({ entry, mid, sweep }) => {
            if (sweep < 8) return null
            // Text runs outward along the radius, so its length is independent
            // of the segment angle and never bleeds into neighbor segments.
            const [x, y] = point(mid, R * 0.58)
            const label = entry.label.length > 14 ? entry.label.slice(0, 13) + '…' : entry.label
            return (
              <text
                key={entry.id}
                x={x}
                y={y}
                fill="white"
                stroke="#0f172a"
                strokeWidth="2"
                paintOrder="stroke"
                fontSize="9"
                fontWeight="600"
                textAnchor="middle"
                dominantBaseline="middle"
                transform={`rotate(${mid - 90} ${x} ${y})`}
                aria-hidden="true"
              >
                {label}
              </text>
            )
          })}
        </g>
        <circle cx={CX} cy={CY} r="10" fill="white" stroke="#334155" strokeWidth="2" />
        {/* two-tone pointer stays readable on any background (cards, OBS scenes) */}
        <g transform={pointerAngle ? `rotate(${pointerAngle} ${CX} ${CY})` : undefined}>
          <polygon points="90,1 110,1 100,22" fill="white" stroke="#0f172a" strokeWidth="2.5" strokeLinejoin="round" />
        </g>
      </svg>
    </div>
  )
}
