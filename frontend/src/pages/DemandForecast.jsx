import { useEffect, useState } from 'react'
import api from '../services/api.js'
import ModelComparisonCard from '../components/ModelComparisonCard.jsx'
import AnimatedCounter from '../components/AnimatedCounter.jsx'

const MEDICINES = ['Paracetamol', 'ORS', 'Amoxicillin', 'Chloroquine/ACT', 'Insulin', 'IV Fluids', 'Doxycycline', 'Iron Folic Acid']
const HORIZONS = [1, 7, 14, 30]

export default function DemandForecast() {
  const [phcs, setPhcs] = useState([])
  const [phcId, setPhcId] = useState('')
  const [medicine, setMedicine] = useState(MEDICINES[0])
  const [horizon, setHorizon] = useState(7)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.getPHCs().then(data => { setPhcs(data); if (data.length) setPhcId(data[0].code) })
  }, [])

  const run = async () => {
    setLoading(true); setError(null); setResult(null)
    try {
      const res = await api.predictDemand({ phc_id: phcId, medicine, horizon_days: horizon })
      setResult(res)
    } catch (e) {
      setError(e?.response?.data?.detail || 'Prediction failed.')
    } finally { setLoading(false) }
  }

  return (
    <div>
      <div className="page-header">
        <h2>Demand Forecasting</h2>
        <div className="page-subtitle">Multi-horizon medicine demand prediction — XGBoost vs LightGBM vs LSTM</div>
      </div>

      <div className="card card-accent">
        <h2>Run Forecast</h2>
        <div className="form-group">
          <select value={phcId} onChange={e => setPhcId(e.target.value)}>
            {phcs.map(p => <option key={p.code} value={p.code}>{p.code} — {p.district}</option>)}
          </select>
          <select value={medicine} onChange={e => setMedicine(e.target.value)}>
            {MEDICINES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 500 }}>
            Forecast Horizon
          </div>
          <div className="pill-group">
            {HORIZONS.map(h => (
              <button key={h} className={`pill ${horizon === h ? 'active' : ''}`} onClick={() => setHorizon(h)}>
                {h} day{h > 1 ? 's' : ''}
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <button onClick={run} disabled={loading}>
            {loading ? '⏳ Forecasting...' : '📈 Forecast Demand'}
          </button>
        </div>
        {error && <p style={{ color: 'var(--critical)', marginTop: 12, fontSize: 13 }}>{error}</p>}
      </div>

      {result && (
        <>
          <div className="grid grid-3">
            <div className="card stat" style={{ gridColumn: 'span 1' }}>
              <div className="value"><AnimatedCounter value={result.final_prediction ?? 0} decimals={1} /></div>
              <div className="label">Predicted demand — {result.horizon_days} day{result.horizon_days > 1 ? 's' : ''}</div>
            </div>
            <div className="card stat">
              <div className="value" style={{ fontSize: 14, color: 'var(--low)' }}>🏆 {result.selected_model}</div>
              <div className="label">Best Model</div>
            </div>
            <div className="card stat">
              <div className="value" style={{ fontSize: 14, color: 'var(--accent)' }}>
                {result.all_model_outputs?.length || 0}
              </div>
              <div className="label">Models Compared</div>
            </div>
          </div>

          <ModelComparisonCard
            allModelOutputs={result.all_model_outputs}
            selectedModel={result.selected_model}
            selectionReason={result.selection_reason}
          />
        </>
      )}
    </div>
  )
}
