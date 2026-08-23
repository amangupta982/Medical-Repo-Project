import { useEffect, useState, useRef } from 'react'

export default function AnimatedCounter({ value, duration = 800, prefix = '', suffix = '', decimals = 0 }) {
  const [display, setDisplay] = useState(0)
  const prev = useRef(0)

  useEffect(() => {
    const start = prev.current
    const end = typeof value === 'number' ? value : parseFloat(value) || 0
    if (start === end) return
    const startTime = performance.now()

    function tick(now) {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3) // easeOutCubic
      const current = start + (end - start) * eased
      setDisplay(current)
      if (progress < 1) requestAnimationFrame(tick)
      else prev.current = end
    }

    requestAnimationFrame(tick)
  }, [value, duration])

  const formatted = decimals > 0 ? display.toFixed(decimals) : Math.round(display).toLocaleString()
  return <>{prefix}{formatted}{suffix}</>
}
