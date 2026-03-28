'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  getLocalHistory,
  getLocalHistoryItem,
  saveToLocalHistory,
  deleteFromLocalHistory,
  makeLocalId,
} from '@/lib/history'
import type { HistoryType, HistoryItem, HistoryListItem } from '@/lib/history'

export type SaveFn = (params: {
  title: string
  metadata: Record<string, unknown>
  output: string
}) => Promise<void>

interface HistoryPanelProps {
  type: HistoryType
  onLoad: (item: HistoryItem) => void
  saveRef: React.MutableRefObject<SaveFn | null>
}

function formatRelativeDate(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const CHIP_COLORS: string[] = [
  'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  'bg-violet-500/10 text-violet-400 border-violet-500/20',
  'bg-sky-500/10 text-sky-400 border-sky-500/20',
  'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'bg-amber-500/10 text-amber-400 border-amber-500/20',
]

function MetadataChip({ label, index }: { label: string; index: number }) {
  const colorClass = CHIP_COLORS[index % CHIP_COLORS.length]
  return (
    <span className={`inline-flex items-center text-[10px] px-1.5 py-0.5 rounded border ${colorClass} truncate max-w-[120px]`}>
      {label}
    </span>
  )
}

function SkeletonCard() {
  return (
    <div className="min-w-[180px] max-w-[240px] bg-surface-raised border border-app-border rounded-xl p-3 space-y-2 animate-pulse shrink-0">
      <div className="h-3 bg-zinc-700 rounded w-3/4" />
      <div className="h-2.5 bg-zinc-800 rounded w-1/2" />
      <div className="flex gap-1">
        <div className="h-4 bg-zinc-800 rounded w-12" />
        <div className="h-4 bg-zinc-800 rounded w-16" />
      </div>
    </div>
  )
}

function HistoryCard({
  item,
  onLoad,
  onDelete,
}: {
  item: HistoryListItem
  onLoad: () => void
  onDelete: () => void
}) {
  const metaEntries = Object.entries(item.metadata)
    .filter(([, v]) => v !== null && v !== undefined && v !== '' && v !== false)
    .slice(0, 4)
    .map(([k, v]) => {
      const label = String(v)
      const key = k.replace(/_/g, ' ')
      return `${key}: ${label}`
    })

  return (
    <button
      onClick={onLoad}
      className="group relative min-w-[180px] max-w-[240px] w-[200px] bg-surface-raised border border-app-border rounded-xl p-3 text-left transition-all hover:ring-1 hover:ring-accent/30 hover:border-accent/30 shrink-0"
    >
      {/* Delete button */}
      <button
        onClick={e => { e.stopPropagation(); onDelete() }}
        className="absolute top-1.5 right-1.5 w-5 h-5 flex items-center justify-center rounded text-zinc-600 hover:text-zinc-300 hover:bg-zinc-700/50 opacity-0 group-hover:opacity-100 transition-all"
        aria-label="Delete"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {/* Title */}
      <p className="text-xs font-semibold text-zinc-200 truncate pr-5 mb-0.5">{item.title}</p>

      {/* Date */}
      <p className="text-[10px] text-zinc-600 mb-2">{formatRelativeDate(item.created_at)}</p>

      {/* Metadata chips */}
      {metaEntries.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {metaEntries.map((entry, i) => (
            <MetadataChip key={entry} label={entry} index={i} />
          ))}
        </div>
      )}
    </button>
  )
}

export default function HistoryPanel({ type, onLoad, saveRef }: HistoryPanelProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [items, setItems] = useState<HistoryListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [savedIndicator, setSavedIndicator] = useState(false)
  const savedTimerRef = useRef<NodeJS.Timeout | null>(null)
  const loadedRef = useRef(false)

  // Merge local + DB items, dedup by id, sort newest first, max 30
  const mergeItems = useCallback((local: HistoryListItem[], db: HistoryListItem[]): HistoryListItem[] => {
    const map = new Map<string, HistoryListItem>()
    for (const item of [...local, ...db]) {
      if (!map.has(item.id)) map.set(item.id, item)
    }
    return Array.from(map.values())
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 30)
  }, [])

  const loadHistory = useCallback(async () => {
    if (loadedRef.current) return
    loadedRef.current = true
    setLoading(true)

    // Load localStorage immediately for instant display
    const local = getLocalHistory(type)
    setItems(local)

    // Then fetch from DB and merge
    try {
      const res = await fetch(`/api/history?type=${type}&limit=30`)
      if (res.ok) {
        const dbItems: HistoryListItem[] = await res.json()
        setItems(prev => mergeItems(local, dbItems.length > 0 ? dbItems : prev))
      }
    } catch {
      // DB unavailable, local items already shown
    } finally {
      setLoading(false)
    }
  }, [type, mergeItems])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  // Set up saveRef
  useEffect(() => {
    saveRef.current = async ({ title, metadata, output }) => {
      const now = new Date().toISOString()

      // Always save to localStorage
      const localItem: HistoryItem = {
        id: makeLocalId(),
        type,
        title,
        metadata,
        output,
        created_at: now,
      }
      saveToLocalHistory(localItem)

      // Attempt to save to DB
      let savedId = localItem.id
      try {
        const res = await fetch('/api/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, title, metadata, output }),
        })
        if (res.ok) {
          const data = await res.json()
          if (data.ok && data.id) {
            savedId = data.id
          }
        }
      } catch {
        // DB unavailable, local save is the fallback
      }

      // Update the in-component items list
      const listItem: HistoryListItem = {
        id: savedId,
        type,
        title,
        metadata,
        created_at: now,
      }
      setItems(prev => {
        const filtered = prev.filter(i => i.id !== listItem.id)
        return [listItem, ...filtered].slice(0, 30)
      })

      // Show "Saved ✓" indicator for 2.5s
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
      setSavedIndicator(true)
      savedTimerRef.current = setTimeout(() => setSavedIndicator(false), 2500)
    }

    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    }
  }, [type, saveRef])

  async function handleLoad(item: HistoryListItem) {
    let fullItem: HistoryItem | null = null

    if (item.id.startsWith('local_')) {
      fullItem = getLocalHistoryItem(type, item.id)
    } else {
      try {
        const res = await fetch(`/api/history/${item.id}`)
        if (res.ok) {
          fullItem = await res.json()
        }
      } catch {
        // fall through to null
      }
    }

    if (fullItem) {
      onLoad(fullItem)
      setIsOpen(false)
    }
  }

  async function handleDelete(item: HistoryListItem) {
    setItems(prev => prev.filter(i => i.id !== item.id))

    if (item.id.startsWith('local_')) {
      deleteFromLocalHistory(type, item.id)
    } else {
      try {
        await fetch(`/api/history/${item.id}`, { method: 'DELETE' })
      } catch {
        // silently ignore
      }
      // Also delete from localStorage in case it was mirrored
      deleteFromLocalHistory(type, item.id)
    }
  }

  const count = items.length

  return (
    <div className="mb-4">
      {/* Toggle button */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setIsOpen(o => !o)}
          className="text-xs text-zinc-500 hover:text-zinc-300 border border-app-border px-3 py-1.5 rounded-lg flex items-center gap-2 transition-colors"
        >
          {/* Clock icon */}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          History
          {count > 0 && (
            <span className="bg-zinc-700 text-zinc-300 text-[10px] px-1.5 py-0.5 rounded-full font-medium">
              {count}
            </span>
          )}
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {/* Saved indicator */}
        {savedIndicator && (
          <span className="text-xs text-emerald-400 flex items-center gap-1 animate-fade-in">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Saved
          </span>
        )}
      </div>

      {/* Panel */}
      {isOpen && (
        <div className="mt-2 p-3 bg-surface-card border border-app-border rounded-xl">
          {loading ? (
            <div className="flex gap-3 overflow-x-auto pb-1">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : items.length === 0 ? (
            <p className="text-xs text-zinc-600 text-center py-4">
              No history yet. Past generations appear here automatically.
            </p>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-1">
              {items.map(item => (
                <HistoryCard
                  key={item.id}
                  item={item}
                  onLoad={() => handleLoad(item)}
                  onDelete={() => handleDelete(item)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
