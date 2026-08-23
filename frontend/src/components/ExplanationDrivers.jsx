import { useTheme } from './ThemeContext.jsx'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { motion } from 'framer-motion'

export default function ExplanationDrivers({ topDrivers }) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  if (!topDrivers || topDrivers.length === 0) return null

  const card = isDark ? 'bg-[#111a30] border border-blue-900/20' : 'bg-white border border-slate-200'

  return (
    <div className={`rounded-2xl p-5 ${card} shadow-sm`}>
      <h3 className={`font-semibold text-sm mb-4 ${isDark ? 'text-white' : 'text-slate-800'}`}>
        SHAP Risk Drivers
      </h3>
      <div className="space-y-3">
        {topDrivers.map((d, i) => {
          const isIncrease = d.direction === 'increases_risk'
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                    {d.factor}
                  </span>
                  <span className={`
                    flex items-center gap-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full
                    ${isIncrease
                      ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                      : 'bg-green-500/10 text-green-400 border border-green-500/20'
                    }
                  `}>
                    {isIncrease ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
                    {isIncrease ? 'Increases' : 'Decreases'}
                  </span>
                </div>
                <span className={`text-xs font-bold tabular-nums ${isIncrease ? 'text-red-400' : 'text-green-400'}`}>
                  {d.contribution_pct?.toFixed(1)}%
                </span>
              </div>
              <div className={`h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${d.contribution_pct}%` }}
                  transition={{ duration: 0.6, delay: i * 0.05 + 0.2 }}
                  className={`h-full rounded-full ${isIncrease ? 'bg-red-500' : 'bg-green-500'}`}
                />
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
