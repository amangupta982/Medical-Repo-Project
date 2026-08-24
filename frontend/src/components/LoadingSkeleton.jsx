import { useTheme } from './ThemeContext.jsx'

export default function LoadingSkeleton({ type = 'card', count = 1 }) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const cardCls = isDark
    ? 'bg-[#111a30] border border-blue-900/20 shadow-sm'
    : 'bg-white border border-slate-200 shadow-sm'

  const skeletonBar = isDark
    ? 'bg-slate-800 animate-pulse rounded-lg'
    : 'bg-slate-200 animate-pulse rounded-lg'

  if (type === 'stats') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={`rounded-2xl p-5 ${cardCls} space-y-3`}>
            <div className={`h-3 w-1/3 ${skeletonBar}`} />
            <div className={`h-8 w-2/3 ${skeletonBar}`} />
            <div className={`h-3 w-1/2 ${skeletonBar}`} />
          </div>
        ))}
      </div>
    )
  }

  if (type === 'table') {
    return (
      <div className={`rounded-2xl p-5 ${cardCls} space-y-4`}>
        <div className={`h-4 w-1/4 ${skeletonBar}`} />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={`h-10 w-full ${skeletonBar}`} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`rounded-2xl p-5 ${cardCls} space-y-3`}>
          <div className={`h-4 w-1/3 ${skeletonBar}`} />
          <div className={`h-3 w-5/6 ${skeletonBar}`} />
          <div className={`h-3 w-2/3 ${skeletonBar}`} />
          <div className={`h-16 w-full ${skeletonBar}`} />
        </div>
      ))}
    </div>
  )
}
