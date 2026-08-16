import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts'
import api from '../services/api.js'
import LoadingSkeleton from '../components/LoadingSkeleton.jsx'

const METRIC_COLORS = {
  pr_auc: '#4ea8ff', roc_auc: '#7c5cff', recall: '#36d89a', precision: '#ffd23a',
  f1: '#ff9d3a', f2_score: '#ff4d6a', mae: '#4ea8ff', rmse: '#ff9d3a', r2: '#36d89a', mape: '#ffd23a',
}

export default function ModelComparison() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { api.getModelPerformance().then(setRows).finally(() => setLoading(false)) }, [])

  const tasks = [...new Set(rows.map(r => r.task))]

  if (loading) return <LoadingSkeleton type="table" />

  return (
    <div>
      <div className="page-header">
        <h2>Model Performance — Full Comparison</h2>
        <div className="page-subtitle">Evidence-based model selection with time-based validation metrics</div>
      </div>

      {tasks.map(task => {
        const taskRows = rows.filter(r => r.task === task)
        const metricKeys = Object.keys(taskRows[0]?.metrics || {}).filter(
          k => k !== 'confusion_matrix' && k !== 'model' && k !== 'threshold'
        )

        const chartData = taskRows.filter(r => !['baseline', 'naive_lag1', 'moving_average_7d'].includes(r.model_name)).map(r => {
          const d = { name: r.model_name }
          metricKeys.forEach(k => { d[k] = r.metrics[k] })
          return d
        })

        return (
          <div className="card" key={task}>
            <h2>{task.replaceAll('_', ' ')}</h2>
            <table>
              <thead>
                <tr>
                  <th>Model</th><th></th>
                  {metricKeys.map(k => <th key={k}>{k.toUpperCase()}</th>)}
                </tr>
              </thead>
              <tbody>
                {taskRows.map(r => (
                  <tr key={r.model_name} style={{
                    background: r.is_current_champion ? 'rgba(54,216,154,0.06)' : 'transparent',
                  }}>
                    <td style={{ fontWeight: r.is_current_champion ? 700 : 400 }}>
                      {r.model_name}
                    </td>
                    <td>{r.is_current_champion ? '🏆' : ''}</td>
                    {metricKeys.map(k => (
                      <td key={k} style={{
                        color: r.is_current_champion ? 'var(--low)' : 'var(--text-secondary)',
                        fontWeight: r.is_current_champion ? 600 : 400,
                      }}>
                        {Array.isArray(r.metrics[k]) ? '…' : r.metrics[k]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>

            {chartData.length > 0 && metricKeys.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(56,90,150,0.1)" />
                    <XAxis dataKey="name" stroke="#5e7399" fontSize={11} />
                    <YAxis stroke="#5e7399" fontSize={11} />
                    <Tooltip contentStyle={{ background: '#101830', border: '1px solid rgba(56,90,150,0.18)', borderRadius: 8, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {metricKeys.slice(0, 4).map(k => (
                      <Bar key={k} dataKey={k} fill={METRIC_COLORS[k] || '#4ea8ff'} radius={[3, 3, 0, 0]} fillOpacity={0.8} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )
      })}

      {rows.length === 0 && (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">🧪</div>
            <div className="empty-text">No trained models found</div>
            <div className="empty-hint">Run the training scripts in backend/app/ml/ first (see README)</div>
          </div>
        </div>
      )}
    </div>
  )
}
