'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { NICHES, PLATFORMS, PERFORMANCE_SCORES, AD_FORMATS, SORT_OPTIONS } from '@/lib/constants'

export interface FilterState {
  query: string
  niches: string[]
  platforms: string[]
  performance_scores: string[]
  ad_formats: string[]
  sort: string
  location: string
  language: string
  status: string
  min_days: string
  start_date: string
  end_date: string
}

export const DEFAULT_FILTERS: FilterState = {
  query: '',
  niches: [],
  platforms: [],
  performance_scores: ['winning', 'optimized'],
  ad_formats: [],
  sort: 'days_active|desc',
  location: '',
  language: '',
  status: '',
  min_days: '',
  start_date: '',
  end_date: '',
}

interface Props {
  filters: FilterState
  onChange: (filters: FilterState) => void
  onApply: () => void
  onClear: () => void
  loading?: boolean
}

export default function FilterPanel({ filters, onChange, onApply, onClear, loading }: Props) {
  const [collapsed, setCollapsed] = useState(false)

  function toggle<K extends keyof FilterState>(key: K, value: string) {
    const current = filters[key] as string[]
    const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value]
    onChange({ ...filters, [key]: next })
  }

  function set(key: keyof FilterState, value: string) {
    onChange({ ...filters, [key]: value })
  }

  return (
    <div
      className={cn(
        'bg-surface-raised border-r border-app-border h-full flex flex-col transition-all duration-200',
        collapsed ? 'w-12' : 'w-72',
      )}
    >
      {/* Collapse toggle */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-app-border shrink-0">
        {!collapsed && <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Filters</span>}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="w-7 h-7 rounded-md flex items-center justify-center text-zinc-500 hover:text-white hover:bg-surface-hover transition-colors ml-auto"
          title={collapsed ? 'Expand filters' : 'Collapse filters'}
        >
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            className={cn('transition-transform', collapsed ? 'rotate-180' : '')}
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      </div>

      {collapsed && (
        <div className="flex-1 flex flex-col items-center py-4 gap-4">
          {/* Collapsed icons */}
          {[
            { label: 'Sort', icon: '↕' },
            { label: 'Niche', icon: '🏷' },
            { label: 'Perf', icon: '⚡' },
          ].map(({ label, icon }) => (
            <div key={label} className="flex flex-col items-center gap-0.5">
              <span className="text-base">{icon}</span>
              <span className="text-[9px] text-zinc-600">{label}</span>
            </div>
          ))}
        </div>
      )}

      {!collapsed && (
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {/* Search */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Keyword</label>
              <input
                type="text"
                value={filters.query}
                onChange={e => set('query', e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') onApply() }}
                placeholder="Search ads..."
                className="w-full bg-surface-card border border-app-border rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-accent"
              />
            </div>

            {/* Sort */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Sort By</label>
              <select
                value={filters.sort}
                onChange={e => set('sort', e.target.value)}
                className="w-full bg-surface-card border border-app-border rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-accent"
              >
                {SORT_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Performance */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-2">Performance Score</label>
              <div className="flex flex-wrap gap-1.5">
                {PERFORMANCE_SCORES.map(s => {
                  const active = filters.performance_scores.includes(s.value)
                  return (
                    <button
                      key={s.value}
                      onClick={() => toggle('performance_scores', s.value)}
                      className={cn(
                        'text-xs px-2.5 py-1 rounded-full border transition-all',
                        active
                          ? 'bg-accent/15 border-accent/40 text-accent'
                          : 'border-app-border text-zinc-500 hover:border-app-border-strong hover:text-zinc-300',
                      )}
                    >
                      {s.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Niche */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-2">Niche</label>
              <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                {NICHES.map(n => {
                  const active = filters.niches.includes(n.id)
                  return (
                    <label key={n.id} className="flex items-center gap-2 cursor-pointer group">
                      <div
                        className={cn(
                          'w-3.5 h-3.5 rounded border flex items-center justify-center transition-all shrink-0',
                          active ? 'bg-accent border-accent' : 'border-app-border-strong group-hover:border-zinc-500',
                        )}
                        onClick={() => toggle('niches', n.id)}
                      >
                        {active && (
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </div>
                      <span
                        className={cn('text-xs', active ? 'text-zinc-200' : 'text-zinc-500 group-hover:text-zinc-300')}
                        onClick={() => toggle('niches', n.id)}
                      >
                        {n.label}
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>

            {/* Platform */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-2">Platform</label>
              <div className="flex flex-wrap gap-1.5">
                {PLATFORMS.map(p => {
                  const active = filters.platforms.includes(p.value)
                  return (
                    <button
                      key={p.value}
                      onClick={() => toggle('platforms', p.value)}
                      className={cn(
                        'text-xs px-2.5 py-1 rounded-full border transition-all',
                        active
                          ? 'bg-accent/15 border-accent/40 text-accent'
                          : 'border-app-border text-zinc-500 hover:border-app-border-strong hover:text-zinc-300',
                      )}
                    >
                      {p.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Format */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-2">Format</label>
              <div className="flex flex-wrap gap-1.5">
                {AD_FORMATS.map(f => {
                  const active = filters.ad_formats.includes(f.value)
                  return (
                    <button
                      key={f.value}
                      onClick={() => toggle('ad_formats', f.value)}
                      className={cn(
                        'text-xs px-2.5 py-1 rounded-full border transition-all',
                        active
                          ? 'bg-accent/15 border-accent/40 text-accent'
                          : 'border-app-border text-zinc-500 hover:border-app-border-strong hover:text-zinc-300',
                      )}
                    >
                      {f.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Country */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Country Codes</label>
              <input
                type="text"
                value={filters.location}
                onChange={e => set('location', e.target.value)}
                placeholder="US, GB, AU"
                className="w-full bg-surface-card border border-app-border rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-accent"
              />
            </div>

            {/* Language */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Language Codes</label>
              <input
                type="text"
                value={filters.language}
                onChange={e => set('language', e.target.value)}
                placeholder="EN, ES, FR"
                className="w-full bg-surface-card border border-app-border rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-accent"
              />
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-2">Status</label>
              <div className="flex gap-1.5">
                {[
                  { value: '', label: 'Both' },
                  { value: 'active', label: 'Active' },
                  { value: 'inactive', label: 'Inactive' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => set('status', opt.value)}
                    className={cn(
                      'flex-1 text-xs py-1.5 rounded-lg border transition-all',
                      filters.status === opt.value
                        ? 'bg-accent/15 border-accent/40 text-accent'
                        : 'border-app-border text-zinc-500 hover:text-zinc-300',
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Min days */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Min Days Active</label>
              <input
                type="number"
                value={filters.min_days}
                onChange={e => set('min_days', e.target.value)}
                placeholder="e.g. 7"
                min="0"
                className="w-full bg-surface-card border border-app-border rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-accent"
              />
            </div>

            {/* Date range */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Date Range</label>
              <div className="space-y-1.5">
                <input
                  type="date"
                  value={filters.start_date}
                  onChange={e => set('start_date', e.target.value)}
                  className="w-full bg-surface-card border border-app-border rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-accent"
                />
                <input
                  type="date"
                  value={filters.end_date}
                  onChange={e => set('end_date', e.target.value)}
                  className="w-full bg-surface-card border border-app-border rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-accent"
                />
              </div>
            </div>
          </div>

          {/* Apply/Clear */}
          <div className="p-4 border-t border-app-border space-y-2 shrink-0">
            <button
              onClick={onApply}
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Searching...' : 'Apply Filters'}
            </button>
            <button
              onClick={onClear}
              className="w-full py-2 rounded-lg text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
            >
              Clear All
            </button>
          </div>
        </>
      )}
    </div>
  )
}
