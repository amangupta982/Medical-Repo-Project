import { useTheme } from './ThemeContext.jsx'
import { Trophy } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const MODEL_COLORS = {
  xgboost: '#3b82f6',
  lightgbm: '#8b5cf6',
  lstm: '#22c55e',
  naive_lag1: '#64748b',
  moving_average_7d: '#94a3b8',
  logistic_regression: '#f97316',
  baseline: '#475569',
}

export default function ModelComparisonCard({ allModelOutputs, selectedModel, selectionReason }) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  if (!allModelOutputs || allModelOutputs.length === 0) return null

  const metricKeys = Object.keys(allModelOutputs[0]?.metrics || {}).filter(
    k => typeof allModelOutputs[0].metrics[k] !== 'object' && k !== 'model'
  )

  const chartData = allModelOutputs
    .filter(m => m.prediction !== null && m.prediction !== undefined)
    .map(m => ({
      name: m.model,
      prediction: m.prediction,
      isChamp: m.model === selectedModel,
    }))

  const card = isDark
    ? 'bg-[#111a30] border border-blue-900/20'
    : 'bg-white border border-slate-200'

  return (
    <div className={`rounded-2xl p-5 ${card} shadow-sm`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-slate-800'}`}>
          Model Comparison
        </h3>
        {selectedModel && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-semibold">
            <Trophy size={11} />
            {selectedModel}
          </div>
        )}
      </div>

      {/* Prediction bar chart */}
      {chartData.length > 0 && (
        <div className="mb-4">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} barCategoryGap="25%">
              <XAxis dataKey="name" stroke="#5e7399" fontSize={11} tick={{ fill: isDark ? '#94a3b8' : '#64748b' }} />
              <YAxis stroke="#5e7399" fontSize={11} tick={{ fill: isDark ? '#94a3b8' : '#64748b' }} />
              <Tooltip
                contentStyle={{
                  background: isDark ? '#1e293b' : '#fff',
                  border: `1px solid ${isDark ? 'rgba(56,90,150,0.3)' : '#e2e8f0'}`,
                  borderRadius: 10,
                  fontSize: 12,
                  color: isDark ? '#f1f5f9' : '#0f172a',
                }}
                cursor={{ fill: 'rgba(59,130,246,0.05)' }}
              />
              <Bar dataKey="prediction" radius={[6, 6, 0, 0]}>
                {chartData.map((d, i) => (
                  <Cell
                    key={i}
                    fill={d.isChamp ? '#22c55e' : MODEL_COLORS[d.name] || '#3b82f6'}
                    fillOpacity={d.isChamp ? 1 : 0.55}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className={`border-b ${isDark ? 'border-blue-900/30' : 'border-slate-200'}`}>
              <th className={`text-left py-2 pr-4 font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Model</th>
              <th className={`text-right py-2 pr-4 font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Prediction</th>
              {metricKeys.map(k => (
                <th key={k} className={`text-right py-2 pr-3 font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {k.toUpperCase()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allModelOutputs.map(m => {
              const isChamp = m.model === selectedModel
              return (
                <tr
                  key={m.model}
                  className={`border-b transition-colors
                    ${isDark ? 'border-blue-900/10' : 'border-slate-100'}
                    ${isChamp ? (isDark ? 'bg-green-500/5' : 'bg-green-50') : ''}
                  `}
                >
                  <td className={`py-2.5 pr-4 font-medium ${isChamp ? 'text-green-400' : isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    {isChamp && <Trophy size={10} className="inline mr-1 text-green-400" />}
                    {m.model}
                  </td>
                  <td className={`py-2.5 pr-4 text-right font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                    {m.prediction !== null && m.prediction !== undefined ? m.prediction : <span className="text-slate-400">offline</span>}
                  </td>
                  {metricKeys.map(k => (
                    <td key={k} className={`py-2.5 pr-3 text-right tabular-nums ${isChamp ? 'text-green-400 font-semibold' : isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      {m.metrics?.[k] ?? '—'}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {selectionReason && (
        <div className={`mt-3 px-3 py-2.5 rounded-xl text-xs ${isDark ? 'bg-green-500/8 text-green-300 border border-green-500/15' : 'bg-green-50 text-green-700 border border-green-200'}`}>
          <Trophy size={11} className="inline mr-1" />
          {selectionReason}
        </div>
      )}
    </div>
  )
}
