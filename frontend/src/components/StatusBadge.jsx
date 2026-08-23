export default function StatusBadge({ level, size = 'default' }) {
  const cls = `badge ${level} ${size === 'large' ? 'badge-lg' : ''}`
  return <span className={cls}>{level}</span>
}
