import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useTheme } from '../components/ThemeContext.jsx'
import api from '../services/api.js'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts'
import { Loader2 } from 'lucide-react'

const TASK_LABELS = {
  stockout_classification: 'Stockout Classification',
  demand_forecast_1d:  'Demand Forecast — 1 Day',
  demand_forecast_7d:  'Demand Forecast — 7 Days',
  demand_forecast_14d: 'Demand Forecast — 14 Days',
  demand_forecast_30d: 'Demand Forecast — 30 Days',
}

const MODEL_COLORS = {
  xgboost: '#3b82f6', lightgbm: '#8b5cf6', lstm: '#22c55e',
  naive_lag1: '#64748b', moving_average_7d: '#94a3b8',
  logistic_regression: '#f97316', baseline: '#475569',
}

const CLASSIFICATION_METRICS = ['pr_auc', 'recall', 'precision', 'f1', 'f2_score']
const REGRESSION_METRICS = ['mae', 'rmse', 'r2', 'mape']

export default function ModelComparison() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTask, setActiveTask] = useState(null)

  useEffect(() => {
    api.getModelPerformance()
      .then(data => {
        setRows(data)
        const tasks = [...new Set(data.map(r => r.task))]
        if (tasks.length) setActiveTask(tasks[0])
      })
      .finally(() => setLoading(false))
  }, [])

  const tasks = [...new Set(rows.map(r => r.task))]
  const taskRows = rows.filter(r => r.task === activeTask)
  const isClassification = activeTask === 'stockout_classification'
  const metricKeys = isClassification ? CLASSIFICATION_METRICS : REGRESSION_METRICS
  const champion = taskRows.find(r => r.is_current_champion)

  const chartData = taskRows
    .filter(r => !['baseline', 'lstm'].includes(r.model_name))
    .map(r => {
      const d = { name: r.model_name }
      metricKeys.slice(0, 3).forEach(k => {
        d[k] = typeof r.metrics?.[k] === 'number' ? +r.metrics[k].toFixed(4) : null
      })
      return d
    })

  const card = isDark ? 'bg-[#111a30] border border-blue-900/20' : 'bg-white border border-slate-200'
  const ttStyle = {
    background: isDark ? '#1e293b' : '#fff',
    border: `1px solid ${isDark ? 'rgba(56,90,150,0.3)' : '#e2e8f0'}`,
    borderRadius: 10, fontSize: 12, color: isDark ? '#f1f5f9' : '#0f172a',
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={28} className="animate-spin text-blue-400" />
    </div>
  )

  return (
    <div className="space-y-5">
      {/* Task tabs */}
      <div className="flex gap-2 flex-wrap">
        {tasks.map(task => (
          <button key={task} onClick={() => setActiveTask(task)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all
              ${activeTask === task
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : isDark ? 'bg-[#111a30] text-slate-400 hover:text-slate-200 border border-blue-900/20' : 'bg-white text-slate-500 hover:text-slate-700 border border-slate-200'
              }
            `}
          >
            {TASK_LABELS[task] || task.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {/* Champion callout */}
      {champion && (
        <motion.div initial={{ opacity:0, scale:0.98 }} animate={{ opacity:1, scale:1 }}
          className={`rounded-2xl p-5 ${card} shadow-sm border-l-4 border-green-500`}>
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                🏆 Current Champion — {TASK_LABELS[activeTask] || activeTask}
              </div>
              <div className={`text-2xl font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>{champion.model_name}</div>
            </div>
            <div className="flex gap-4 flex-wrap">
              {metricKeys.slice(0, 3).map(k => champion.metrics?.[k] !== undefined && (
                <div key={k} className="text-right">
                  <div className={`text-[10px] uppercase tracking-widest font-semibold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{k.replace(/_/g, ' ')}</div>
                  <div className="text-xl font-extrabold text-green-400">
                    {Array.isArray(champion.metrics[k]) ? '—' : typeof champion.metrics[k] === 'number' ? champion.metrics[k].toFixed(4) : champion.metrics[k]}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Bar chart */}
      {chartData.length > 0 && (
        <div className={`rounded-2xl p-5 ${card} shadow-sm`}>
          <h3 className={`text-sm font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-800'}`}>
            Metric Comparison (Top Models)
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barCategoryGap="20%">
              <XAxis dataKey="name" stroke="#5e7399" fontSize={11} tick={{ fill: isDark ? '#94a3b8' : '#64748b' }} />
              <YAxis stroke="#5e7399" fontSize={11} tick={{ fill: isDark ? '#94a3b8' : '#64748b' }} />
              <Tooltip contentStyle={ttStyle} cursor={{ fill: 'rgba(59,130,246,0.05)' }} />
              <Legend wrapperStyle={{ fontSize: 11, color: isDark ? '#94a3b8' : '#64748b' }} />
              {metricKeys.slice(0, 3).map((k, i) => (
                <Bar key={k} dataKey={k} radius={[4, 4, 0, 0]} fill={['#3b82f6','#8b5cf6','#22c55e'][i]} fillOpacity={0.8} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Full metrics table */}
      <div className={`rounded-2xl p-5 ${card} shadow-sm`}>
        <h3 className={`text-sm font-semibold mb-4 ${isDark ? 'text-white' : 'text-slate-800'}`}>All Models</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className={`border-b ${isDark ? 'border-blue-900/30' : 'border-slate-200'}`}>
                <th className={`text-left py-2.5 pr-4 font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Model</th>
                {metricKeys.map(k => (
                  <th key={k} className={`text-right py-2.5 pr-3 font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {k.replace(/_/g, ' ').toUpperCase()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {taskRows.map(r => {
                const isChamp = r.is_current_champion
                return (
                  <tr key={r.model_name}
                    className={`border-b transition-colors
                      ${isDark ? 'border-blue-900/10' : 'border-slate-100'}
                      ${isChamp ? isDark ? 'bg-green-500/5' : 'bg-green-50' : ''}
                    `}>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: MODEL_COLORS[r.model_name] || '#64748b' }} />
                        <span className={`font-semibold ${isChamp ? 'text-green-400' : isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                          {isChamp && '🏆 '}{r.model_name}
                        </span>
                      </div>
                    </td>
                    {metricKeys.map(k => (
                      <td key={k} className={`py-3 pr-3 text-right tabular-nums font-medium
                        ${isChamp ? 'text-green-400' : isDark ? 'text-slate-400' : 'text-slate-500'}
                      `}>
                        {Array.isArray(r.metrics?.[k]) ? '…'
                          : typeof r.metrics?.[k] === 'number' ? r.metrics[k].toFixed(4)
                          : r.metrics?.[k] ?? '—'}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
