import { useTheme } from './ThemeContext.jsx'
import { motion } from 'framer-motion'

const RISK_ZONES = [
  { label: 'LOW', color: '#22c55e', from: 0,    to: 0.3  },
  { label: 'MED', color: '#eab308', from: 0.3,  to: 0.6  },
  { label: 'HIGH',color: '#f97316', from: 0.6,  to: 0.85 },
  { label: 'CRIT',color: '#ef4444', from: 0.85, to: 1.0  },
]

function getRiskColor(prob) {
  if (prob >= 0.85) return '#ef4444'
  if (prob >= 0.6)  return '#f97316'
  if (prob >= 0.3)  return '#eab308'
  return '#22c55e'
}

function getRiskLabel(prob) {
  if (prob >= 0.85) return 'CRITICAL'
  if (prob >= 0.6)  return 'HIGH'
  if (prob >= 0.3)  return 'MEDIUM'
  return 'LOW'
}

export default function RiskGauge({ probability = 0, size = 200 }) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const cx = size / 2
  const cy = size * 0.62
  const r  = size * 0.38
  const strokeW = size * 0.075

  // Arc helpers (180° arc from left to right)
  const polarToXY = (angleDeg, radius) => {
    const rad = ((angleDeg - 180) * Math.PI) / 180
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) }
  }
  const describeArc = (startAngle, endAngle, radius) => {
    const s = polarToXY(startAngle, radius)
    const e = polarToXY(endAngle, radius)
    const large = endAngle - startAngle > 180 ? 1 : 0
    return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${large} 1 ${e.x} ${e.y}`
  }

  const totalAngle = 180
  const needleAngle = probability * totalAngle  // 0° = left, 180° = right
  const nx = polarToXY(needleAngle, r * 0.78)

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size * 0.72} viewBox={`0 0 ${size} ${size * 0.72}`}>
        {/* Background track */}
        <path
          d={describeArc(0, 180, r)}
          fill="none"
          stroke={isDark ? '#1e293b' : '#e2e8f0'}
          strokeWidth={strokeW}
          strokeLinecap="round"
        />
        {/* Color zones */}
        {RISK_ZONES.map((z) => (
          <path
            key={z.label}
            d={describeArc(z.from * 180, z.to * 180, r)}
            fill="none"
            stroke={z.color}
            strokeWidth={strokeW}
            strokeLinecap="butt"
            opacity={0.3}
          />
        ))}
        {/* Filled arc up to probability */}
        <motion.path
          d={describeArc(0, probability * 180, r)}
          fill="none"
          stroke={getRiskColor(probability)}
          strokeWidth={strokeW}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
        {/* Needle */}
        <motion.line
          x1={cx}
          y1={cy}
          x2={cx + r * 0.68}
          y2={cy}
          stroke={getRiskColor(probability)}
          strokeWidth={2.5}
          strokeLinecap="round"
          style={{ transformOrigin: `${cx}px ${cy}px` }}
          initial={{ rotate: 0 }}
          animate={{ rotate: needleAngle }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
        {/* Center dot */}
        <circle cx={cx} cy={cy} r={6} fill={getRiskColor(probability)} />

        {/* Zone labels */}
        {[
          { angle: 22.5,  label: 'LOW' },
          { angle: 80,    label: 'MED' },
          { angle: 135,   label: 'HIGH' },
          { angle: 162,   label: 'CRIT' },
        ].map(({ angle, label }) => {
          const pos = polarToXY(angle, r + strokeW * 1.2)
          return (
            <text key={label} x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="middle"
              fontSize={size * 0.055} fill={isDark ? '#475569' : '#94a3b8'} fontWeight="600">
              {label}
            </text>
          )
        })}
      </svg>

      {/* Probability label */}
      <div className="text-center -mt-2">
        <div className="text-3xl font-extrabold tracking-tight" style={{ color: getRiskColor(probability) }}>
          {(probability * 100).toFixed(1)}%
        </div>
        <div className={`text-xs font-bold tracking-widest uppercase mt-0.5`} style={{ color: getRiskColor(probability) }}>
          {getRiskLabel(probability)} RISK
        </div>
      </div>
    </div>
  )
}
