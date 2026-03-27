import { cn } from '@/lib/utils'

interface Props {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export default function LoadingSpinner({ size = 'md', className }: Props) {
  const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-10 h-10' }
  return (
    <div
      className={cn(
        'border-2 border-zinc-700 border-t-accent rounded-full animate-spin',
        sizes[size],
        className,
      )}
    />
  )
}
