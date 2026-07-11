const COLORS = ['#4f46e5', '#c026d3', '#f59e0b', '#10b981', '#ef4444', '#3b82f6']

/** Full-screen confetti burst. Mount to start, unmount to clean up. */
export default function Confetti() {
  const pieces = Array.from({ length: 90 }, (_, i) => ({
    left: Math.random() * 100,
    delay: Math.random() * 0.4,
    duration: 2 + Math.random() * 1.5,
    color: COLORS[i % COLORS.length],
    size: 6 + Math.random() * 6,
  }))
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute top-0 rounded-xs"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.5,
            backgroundColor: p.color,
            // "both" keeps delayed pieces at the offscreen from-state, otherwise
            // they sit visibly at the top edge until their delay elapses.
            animation: `confetti-fall ${p.duration}s ease-in ${p.delay}s both`,
          }}
        />
      ))}
    </div>
  )
}
