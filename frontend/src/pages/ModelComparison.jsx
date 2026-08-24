import { useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell
} from 'recharts'
import { Trophy, ShieldCheck, BarChart3, Loader2, Calendar } from 'lucide-react'
import { useTheme } from '../components/ThemeContext.jsx'
import api from '../services/api.js'
import LoadingSkeleton from '../components/LoadingSkeleton.jsx'

const TASK_LABELS = {
  stockout_classification: 'Stockout Classification (7-Day Early Warning)',
  demand_forecast_1d: 'Demand Forecasting (1-Day Horizon)',
  demand_forecast_7d: 'Demand Forecasting (7-Day Horizon)',
  demand_forecast_14d: 'Demand Forecasting (14-Day Horizon)',
  demand_forecast_30d: 'Demand Forecasting (30-Day Horizon)',
}

const MODEL_PALETTE = {
  xgboost: '#3b82f6',
  lightgbm: '#8b5cf6',
  lstm: '#10b981',
  naive_lag1: '#64748b',
  moving_average_7d: '#94a3b8',
  logistic_regression: '#f97316',
  baseline: '#475569',
}

export default function ModelComparison() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [allPerf, setAllPerf] = useState([])
  const [activeTask, setActiveTask] = useState('stockout_classification')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getModelPerformance()
      .then(data => {
        setAllPerf(data || [])
        if (data && data.length > 0) {
          const tasks = [...new Set(data.map(d => d.task))]
          if (tasks.includes('stockout_classification')) {
            setActiveTask('stockout_classification')
          } else {
            setActiveTask(tasks[0])
          }
        }
      })
      .catch(() => setAllPerf([]))
      .finally(() => setLoading(false))
  }, [])

  const tasks = useMemo(() => {
    return [...new Set(allPerf.map(r => r.task))]
  }, [allPerf])

  const taskRows = useMemo(() => {
    return allPerf.filter(r => r.task === activeTask)
  }, [allPerf, activeTask])

  const champion = useMemo(() => {
    return taskRows.find(r => r.is_current_champion)
  }, [taskRows])

  // Extract all metric keys for active task
  const metricKeys = useMemo(() => {
    const keys = new Set()
    taskRows.forEach(r => {
      if (r.metrics) {
        Object.keys(r.metrics).forEach(k => {
          if (typeof r.metrics[k] === 'number') keys.add(k)
        })
      }
    })
    return [...keys]
  }, [taskRows])

  // Chart data comparing top metrics
  const chartData = useMemo(() => {
    const primaryMetric = activeTask === 'stockout_classification' ? 'pr_auc' : 'mae'
    return taskRows.map(r => ({
      name: r.model_name,
      [primaryMetric.toUpperCase()]: r.metrics?.[primaryMetric] ? +r.metrics[primaryMetric].toFixed(4) : 0,
      isChamp: r.is_current_champion,
    }))
  }, [taskRows, activeTask])

  const cardCls = isDark
    ? 'bg-[#111a30] border border-blue-900/20 shadow-sm'
    : 'bg-white border border-slate-200 shadow-sm'

  const ttStyle = {
    background: isDark ? '#1e293b' : '#fff',
    border: `1px solid ${isDark ? 'rgba(56,90,150,0.3)' : '#e2e8f0'}`,
    borderRadius: 10,
    fontSize: 12,
    color: isDark ? '#f1f5f9' : '#0f172a',
  }

  if (loading) {
    return (
      <div className="space-y-5">
        <LoadingSkeleton type="stats" />
        <LoadingSkeleton count={2} />
      </div>
    )
  }

  return (
    <div className="space-y-5">

      {/* ── Task Selector Tabs ── */}
      <div className="flex gap-2 flex-wrap">
        {tasks.map(task => (
          <button
            key={task}
            onClick={() => setActiveTask(task)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all
              ${activeTask === task
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 scale-[1.02]'
                : isDark ? 'bg-[#111a30] text-slate-400 hover:text-slate-200 border border-blue-900/20' : 'bg-white text-slate-600 hover:text-slate-800 border border-slate-200'
              }
            `}
          >
            {TASK_LABELS[task] || task.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {/* ── Champion Callout Banner ── */}
      {champion && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`rounded-2xl p-5 ${cardCls} border-l-4 border-green-500`}
        >
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className={`text-[10px] font-bold uppercase tracking-widest mb-1 flex items-center gap-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                <Trophy size={13} className="text-amber-400" />
                Active Champion Model
              </div>
              <div className={`text-2xl font-extrabold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                {champion.model_name}
              </div>
              <div className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Evaluated with rolling walk-forward time-series validation on real facility data.
              </div>
            </div>

            <div className="flex gap-4 flex-wrap">
              {metricKeys.slice(0, 3).map(k => (
                <div key={k} className="text-right">
                  <div className={`text-[10px] uppercase tracking-widest font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {k.replace(/_/g, ' ')}
                  </div>
                  <div className="text-xl font-extrabold text-green-400 tabular-nums">
                    {typeof champion.metrics[k] === 'number' ? champion.metrics[k].toFixed(4) : champion.metrics[k]}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Metric Comparison Bar Chart ── */}
      <div className={`rounded-2xl p-5 ${cardCls}`}>
        <h3 className={`text-sm font-bold mb-1 ${isDark ? 'text-white' : 'text-slate-800'}`}>
          Comparative Performance Benchmark
        </h3>
        <p className={`text-xs mb-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
          {activeTask === 'stockout_classification' ? 'PR-AUC (higher is better)' : 'MAE (lower is better)'} across tested model architectures
        </p>
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(56,90,150,0.1)' : '#f1f5f9'} />
              <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} />
              <Tooltip contentStyle={ttStyle} />
              <Bar dataKey={activeTask === 'stockout_classification' ? 'PR_AUC' : 'MAE'} radius={[6, 6, 0, 0]}>
                {chartData.map((d, i) => (
                  <Cell
                    key={i}
                    fill={d.isChamp ? '#22c55e' : MODEL_PALETTE[d.name] || '#3b82f6'}
                    fillOpacity={d.isChamp ? 1 : 0.65}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Complete Model Leaderboard Table ── */}
      <div className={`rounded-2xl p-5 ${cardCls}`}>
        <h3 className={`text-sm font-bold mb-3 ${isDark ? 'text-white' : 'text-slate-800'}`}>
          Task Models & Validation Metrics
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className={`border-b ${isDark ? 'border-blue-900/30 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
                <th className="text-left py-2.5 pr-4 font-semibold">Model</th>
                <th className="text-center py-2.5 pr-4 font-semibold">Status</th>
                {metricKeys.map(k => (
                  <th key={k} className="text-right py-2.5 pr-3 font-semibold uppercase">
                    {k.replace(/_/g, ' ')}
                  </th>
                ))}
                <th className="text-right py-2.5 font-semibold">Trained At</th>
              </tr>
            </thead>
            <tbody>
              {taskRows.map(r => {
                const isChamp = r.is_current_champion
                return (
                  <tr
                    key={r.id || r.model_name}
                    className={`border-b transition-colors
                      ${isDark ? 'border-blue-900/10 hover:bg-white/5' : 'border-slate-100 hover:bg-slate-50'}
                      ${isChamp ? (isDark ? 'bg-green-500/5' : 'bg-green-50/50') : ''}
                    `}
                  >
                    <td className={`py-2.5 pr-4 font-bold ${isChamp ? 'text-green-400' : isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                      {isChamp && <Trophy size={11} className="inline mr-1.5 text-amber-400" />}
                      {r.model_name}
                    </td>
                    <td className="py-2.5 pr-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isChamp ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-slate-700/20 text-slate-400'}`}>
                        {isChamp ? 'Champion' : 'Challenger'}
                      </span>
                    </td>
                    {metricKeys.map(k => (
                      <td
                        key={k}
                        className={`py-2.5 pr-3 text-right tabular-nums font-mono
                          ${isChamp ? 'text-green-400 font-bold' : isDark ? 'text-slate-300' : 'text-slate-600'}
                        `}
                      >
                        {r.metrics?.[k] !== undefined
                          ? (typeof r.metrics[k] === 'number' ? r.metrics[k].toFixed(4) : r.metrics[k])
                          : '—'
                        }
                      </td>
                    ))}
                    <td className="py-2.5 text-right text-slate-500 text-[10px]">
                      {r.trained_at ? new Date(r.trained_at).toLocaleDateString() : 'Baseline'}
                    </td>
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
