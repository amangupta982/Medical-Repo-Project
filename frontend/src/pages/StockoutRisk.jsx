import { useEffect, useState } from 'react'
import api from '../services/api.js'
import ModelComparisonCard from '../components/ModelComparisonCard.jsx'
import ExplanationDrivers from '../components/ExplanationDrivers.jsx'
import RiskGauge from '../components/RiskGauge.jsx'
import AnimatedCounter from '../components/AnimatedCounter.jsx'

const MEDICINES = ['Paracetamol', 'ORS', 'Amoxicillin', 'Chloroquine/ACT', 'Insulin', 'IV Fluids', 'Doxycycline', 'Iron Folic Acid']

export default function StockoutRisk() {
  const [phcs, setPhcs] = useState([])
  const [phcId, setPhcId] = useState('')
  const [medicine, setMedicine] = useState(MEDICINES[0])
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.getPHCs().then(data => {
      setPhcs(data)
      if (data.length) setPhcId(data[0].code)
    })
  }, [])

  const runPrediction = async () => {
    setLoading(true); setError(null); setResult(null)
    try {
      const res = await api.predictStockout({ phc_id: phcId, medicine })
      setResult(res)
    } catch (e) {
      setError(e?.response?.data?.detail || 'Prediction failed. Is the backend running and models trained?')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <h2>Stock-out Risk Prediction</h2>
        <div className="page-subtitle">7-day advance warning — XGBoost vs LightGBM with SHAP explanations</div>
      </div>

      <div className="card card-accent">
        <h2>Run Prediction</h2>
        <div className="form-group">
          <select value={phcId} onChange={e => setPhcId(e.target.value)}>
            {phcs.map(p => <option key={p.code} value={p.code}>{p.code} — {p.district}</option>)}
          </select>
          <select value={medicine} onChange={e => setMedicine(e.target.value)}>
            {MEDICINES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <button onClick={runPrediction} disabled={loading}>
            {loading ? '⏳ Running models...' : '🔍 Predict Stock-out Risk'}
          </button>
        </div>
        {error && <p style={{ color: 'var(--critical)', marginTop: 12, fontSize: 13 }}>{error}</p>}
      </div>

      {result && (
        <>
          <div className="grid grid-4">
            <div className="card stat" style={{ gridColumn: 'span 2' }}>
              <RiskGauge probability={result.stockout_probability} size={200} />
            </div>
            <div className="card stat">
              <div className="value"><AnimatedCounter value={result.current_stock} /></div>
              <div className="label">Current Stock</div>
            </div>
            <div className="card stat">
              <div className="value"><AnimatedCounter value={result.predicted_demand_per_day} decimals={1} /></div>
              <div className="label">Predicted Demand / Day</div>
            </div>
          </div>

          <div className="grid grid-3">
            <div className="card stat">
              <div className="value">{result.expected_stockout_days ?? '—'}</div>
              <div className="label">Days to Stock-out</div>
            </div>
            <div className="card stat">
              <div className="value" style={{ fontSize: 18 }}>
                <span className={`badge ${result.risk_level}`}>{result.risk_level}</span>
              </div>
              <div className="label">{(result.stockout_probability * 100).toFixed(0)}% probability</div>
            </div>
            <div className="card stat">
              <div className="value" style={{ fontSize: 14, color: 'var(--low)' }}>🏆 {result.selected_model}</div>
              <div className="label">Best Model</div>
            </div>
          </div>

          <ModelComparisonCard
            allModelOutputs={result.all_model_outputs}
            selectedModel={result.selected_model}
            selectionReason={result.selection_reason}
          />

          <ExplanationDrivers topDrivers={result.top_drivers} />
        </>
      )}
    </div>
  )
}
