export default function ExplanationDrivers({ topDrivers }) {
  if (!topDrivers || topDrivers.length === 0) return null

  return (
    <div className="card">
      <h2>Why is this PHC at risk? (Explainable AI)</h2>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 14 }}>
        SHAP-based feature attribution — top factors driving this prediction
      </div>
      {topDrivers.map((d, i) => (
        <div key={i} className="driver-item">
          <div className="driver-label">
            <span className="driver-name">{d.factor}</span>
            <span className={`driver-value ${d.direction === 'increases_risk' ? 'increases' : 'decreases'}`}>
              {d.direction === 'increases_risk' ? '▲' : '▼'} {d.contribution_pct}%
            </span>
          </div>
          <div className="driver-bar-track">
            <div
              className="driver-bar-fill"
              style={{
                width: `${d.contribution_pct}%`,
                background: d.direction === 'increases_risk' ? 'var(--critical)' : 'var(--low)',
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
