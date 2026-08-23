import { useTheme } from './ThemeContext.jsx'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { motion } from 'framer-motion'

export default function KpiCard({ label, value, unit = '', sub, trend, trendLabel, color = 'blue', icon: Icon, delay = 0 }) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const colorMap = {
    blue:   { border: 'border-blue-500',   text: 'text-blue-400',   bg: 'bg-blue-500/10'  },
    green:  { border: 'border-green-500',  text: 'text-green-400',  bg: 'bg-green-500/10' },
    red:    { border: 'border-red-500',    text: 'text-red-400',    bg: 'bg-red-500/10'   },
    orange: { border: 'border-orange-500', text: 'text-orange-400', bg: 'bg-orange-500/10'},
    violet: { border: 'border-violet-500', text: 'text-violet-400', bg: 'bg-violet-500/10'},
  }
  const c = colorMap[color] || colorMap.blue

  const TrendIcon = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus
  const trendColor = trend > 0 ? 'text-green-400' : trend < 0 ? 'text-red-400' : 'text-slate-400'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className={`
        relative rounded-2xl p-5 border-l-4 ${c.border}
        ${isDark ? 'bg-[#111a30] border-t border-r border-b border-blue-900/20' : 'bg-white border-t border-r border-b border-slate-200'}
        shadow-sm overflow-hidden
      `}
    >
      {/* Icon */}
      {Icon && (
        <div className={`absolute top-4 right-4 p-2 rounded-xl ${c.bg}`}>
          <Icon size={16} className={c.text} />
        </div>
      )}

      <div className={`text-xs font-semibold uppercase tracking-widest mb-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
        {label}
      </div>

      <div className="flex items-end gap-1.5 mb-1">
        <span className={`text-3xl font-extrabold tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>
          {value ?? '—'}
        </span>
        {unit && <span className={`text-sm font-medium pb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{unit}</span>}
      </div>

      {sub && (
        <div className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{sub}</div>
      )}

      {trendLabel !== undefined && (
        <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trendColor}`}>
          <TrendIcon size={12} />
          {trendLabel}
        </div>
      )}
    </motion.div>
  )
}
