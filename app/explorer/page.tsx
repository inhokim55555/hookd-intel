'use client'

import { useState, useCallback } from 'react'
import type { Ad } from '@/lib/types'
import { cacheCredits } from '@/lib/utils'
import FilterPanel, { FilterState, DEFAULT_FILTERS } from '@/components/ui/FilterPanel'
import AdCard from '@/components/ui/AdCard'
import AdDetailModal from '@/components/ui/AdDetailModal'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

const PER_PAGE = 24

function buildQueryString(filters: FilterState, page: number): string {
  const params = new URLSearchParams()
  params.set('per_page', String(PER_PAGE))
  params.set('page', String(page))

  if (filters.query) params.set('query', filters.query)
  if (filters.niches.length) params.set('niche', filters.niches.join(','))
  if (filters.platforms.length) params.set('platform', filters.platforms.join(','))
  if (filters.performance_scores.length) params.set('performance_scores', filters.performance_scores.join(','))
  if (filters.ad_formats.length) params.set('ad-format', filters.ad_formats.join(','))
  if (filters.location) params.set('location', filters.location)
  if (filters.language) params.set('language', filters.language)
  if (filters.status) params.set('status', filters.status)
  if (filters.min_days) params.set('run-time', filters.min_days)
  if (filters.start_date) params.set('start-date', filters.start_date)
  if (filters.end_date) params.set('end-date', filters.end_date)

  const [col, dir] = filters.sort.split('|')
  params.set('sort_column', col)
  params.set('sort_direction', dir)

  return params.toString()
}

export default function ExplorerPage() {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS)
  const [ads, setAds] = useState<Ad[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedAd, setSelectedAd] = useState<Ad | null>(null)
  const [remainingCredits, setRemainingCredits] = useState<number | null>(null)
  const [searched, setSearched] = useState(false)

  const fetchAds = useCallback(async (currentFilters: FilterState, currentPage: number, append = false) => {
    const isLoading = append ? setLoadingMore : setLoading
    isLoading(true)
    setError(null)

    try {
      const qs = buildQueryString(currentFilters, currentPage)
      const res = await fetch(`/api/gethookd/explore?${qs}`)
      const data = await res.json()

      if (!res.ok) {
        setError(data.message ?? 'Failed to fetch ads')
        return
      }

      const newAds: Ad[] = data.data ?? []
      setAds(prev => append ? [...prev, ...newAds] : newAds)
      setHasMore(newAds.length === PER_PAGE)
      setRemainingCredits(data.remaining_credits)
      cacheCredits(data.remaining_credits)
      window.dispatchEvent(new CustomEvent('credits-updated', { detail: { remaining: data.remaining_credits } }))
      setSearched(true)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      isLoading(false)
    }
  }, [])

  function handleApply() {
    setPage(1)
    fetchAds(filters, 1, false)
  }

  function handleClear() {
    setFilters(DEFAULT_FILTERS)
    setAds([])
    setSearched(false)
    setPage(1)
  }

  function handleLoadMore() {
    const nextPage = page + 1
    setPage(nextPage)
    fetchAds(filters, nextPage, true)
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Filter Panel */}
      <FilterPanel
        filters={filters}
        onChange={setFilters}
        onApply={handleApply}
        onClear={handleClear}
        loading={loading}
      />

      {/* Results */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-app-border shrink-0 bg-surface-base/80 backdrop-blur-sm">
          <div>
            <h1 className="text-lg font-semibold text-white">Ad Explorer</h1>
            {searched && (
              <p className="text-xs text-zinc-500 mt-0.5">
                {ads.length} ads
                {remainingCredits !== null && (
                  <> · <span className="text-zinc-600">{remainingCredits.toLocaleString()} credits remaining</span></>
                )}
              </p>
            )}
          </div>
          {!searched && (
            <p className="text-xs text-zinc-600">Set filters and click Apply Filters to search</p>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <LoadingSpinner size="lg" />
              <p className="text-sm text-zinc-500">Searching ads...</p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <p className="text-sm text-red-400">{error}</p>
              <button onClick={handleApply} className="text-xs text-zinc-500 hover:text-zinc-300 underline">
                Try again
              </button>
            </div>
          )}

          {!loading && !error && searched && ads.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-600 text-xl">
                ∅
              </div>
              <p className="text-sm text-zinc-500">No ads found. Try adjusting your filters.</p>
            </div>
          )}

          {!loading && !error && ads.length > 0 && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                {ads.map(ad => (
                  <AdCard key={ad.id} ad={ad} onViewDetails={setSelectedAd} />
                ))}
              </div>

              {hasMore && (
                <div className="flex justify-center mt-8">
                  <button
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="flex items-center gap-2 px-6 py-3 bg-surface-card border border-app-border hover:border-app-border-strong text-sm text-zinc-400 hover:text-white rounded-xl transition-all disabled:opacity-50"
                  >
                    {loadingMore ? (
                      <><LoadingSpinner size="sm" /> Loading...</>
                    ) : (
                      'Load More'
                    )}
                  </button>
                </div>
              )}
            </>
          )}

          {!searched && !loading && (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.5">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                </svg>
              </div>
              <div>
                <p className="text-white font-medium mb-1">Search the Ad Library</p>
                <p className="text-sm text-zinc-500 max-w-xs">
                  Use the filters on the left to search 21M+ ads. Default shows Winning + Optimized ads sorted by longevity.
                </p>
              </div>
              <button
                onClick={handleApply}
                className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors"
              >
                Run Default Search
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Ad Detail Modal */}
      {selectedAd && (
        <AdDetailModal ad={selectedAd} onClose={() => setSelectedAd(null)} />
      )}
    </div>
  )
}
