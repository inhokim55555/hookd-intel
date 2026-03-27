import { PERF_COLORS } from '@/lib/constants'
import { cn } from '@/lib/utils'

interface Props {
  score: string
  size?: 'sm' | 'md'
}

export default function PerformanceBadge({ score, size = 'sm' }: Props) {
  const colors = PERF_COLORS[score] ?? 'text-zinc-400 bg-zinc-400/10 border-zinc-400/20'

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium border rounded-full leading-none',
        colors,
        size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1',
      )}
    >
      {score}
    </span>
  )
}
