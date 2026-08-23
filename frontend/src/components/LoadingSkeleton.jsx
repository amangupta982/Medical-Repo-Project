export default function LoadingSkeleton({ type = 'card', count = 1 }) {
  if (type === 'stats') {
    return (
      <div className="grid grid-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card stat">
            <div className="skeleton skeleton-heading" style={{ width: '50%', margin: '0 auto 8px' }} />
            <div className="skeleton skeleton-text" style={{ width: '70%', margin: '0 auto' }} />
          </div>
        ))}
      </div>
    )
  }

  if (type === 'table') {
    return (
      <div className="card">
        <div className="skeleton skeleton-heading" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton skeleton-text" style={{ width: `${85 - i * 5}%`, marginBottom: 10 }} />
        ))}
      </div>
    )
  }

  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card">
          <div className="skeleton skeleton-heading" />
          <div className="skeleton skeleton-text" style={{ width: '90%' }} />
          <div className="skeleton skeleton-text" style={{ width: '75%' }} />
          <div className="skeleton skeleton-text" style={{ width: '60%' }} />
        </div>
      ))}
    </>
  )
}
