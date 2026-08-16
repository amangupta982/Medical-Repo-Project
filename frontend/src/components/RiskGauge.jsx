export default function RiskGauge({ probability = 0, size = 180 }) {
  const pct = Math.max(0, Math.min(1, probability))
  const angle = pct * 180
  const radius = 70
  const cx = 90
  const cy = 85

  const polarToXY = (deg) => {
    const rad = (deg - 180) * Math.PI / 180
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) }
  }

  const start = polarToXY(0)
  const end = polarToXY(angle)
  const largeArc = angle > 180 ? 1 : 0

  const color = pct >= 0.85 ? '#ff4d6a'
    : pct >= 0.6 ? '#ff9d3a'
    : pct >= 0.3 ? '#ffd23a'
    : '#36d89a'

  const riskLabel = pct >= 0.85 ? 'CRITICAL'
    : pct >= 0.6 ? 'HIGH'
    : pct >= 0.3 ? 'MEDIUM'
    : 'LOW'

  return (
    <div className="risk-gauge" style={{ width: size, height: size * 0.6 }}>
      <svg viewBox="0 0 180 100">
        {/* Background arc */}
        <path
          d={`M ${polarToXY(0).x} ${polarToXY(0).y} A ${radius} ${radius} 0 1 1 ${polarToXY(180).x} ${polarToXY(180).y}`}
          fill="none" stroke="rgba(56,90,150,0.15)" strokeWidth="10" strokeLinecap="round"
        />
        {/* Value arc */}
        {pct > 0.01 && (
          <path
            d={`M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`}
            fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 6px ${color}40)` }}
          />
        )}
      </svg>
      <div className="gauge-label">
        <div className="gauge-value" style={{ color }}>{(pct * 100).toFixed(0)}%</div>
        <div className="gauge-text">{riskLabel}</div>
      </div>
    </div>
  )
}
