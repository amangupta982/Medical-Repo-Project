export default function ModelComparisonCard({ allModelOutputs, selectedModel, selectionReason }) {
  if (!allModelOutputs || allModelOutputs.length === 0) return null

  const metricKeys = Object.keys(allModelOutputs[0]?.metrics || {}).filter(
    k => typeof allModelOutputs[0].metrics[k] !== 'object'
  )

  return (
    <div className="card">
      <h2>Model Comparison</h2>
      <table>
        <thead>
          <tr>
            <th>Model</th>
            <th>Prediction</th>
            {metricKeys.map(k => <th key={k}>{k.toUpperCase()}</th>)}
          </tr>
        </thead>
        <tbody>
          {allModelOutputs.map(m => (
            <tr key={m.model} style={{
              background: m.model === selectedModel ? 'rgba(54,216,154,0.06)' : 'transparent',
            }}>
              <td style={{ fontWeight: m.model === selectedModel ? 700 : 400 }}>
                {m.model === selectedModel ? '🏆 ' : ''}{m.model}
              </td>
              <td style={{ fontWeight: 600 }}>
                {m.prediction !== null && m.prediction !== undefined ? m.prediction : '—'}
              </td>
              {metricKeys.map(k => (
                <td key={k} style={{
                  color: m.model === selectedModel ? 'var(--low)' : 'var(--text-secondary)',
                }}>
                  {m.metrics?.[k] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {selectionReason && (
        <div className="champion-banner">
          🏆 <strong>Best model: {selectedModel}</strong> — {selectionReason}
        </div>
      )}
    </div>
  )
}
