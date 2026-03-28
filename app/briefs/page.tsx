'use client'

import { useState, useEffect, useRef } from 'react'
import { BRAND_CONTEXT_KEY, NICHES, PERF_COLORS, AD_FORMATS } from '@/lib/constants'
import type { Ad, BrandContext } from '@/lib/types'
import { slimAd, cacheCredits, getFormatLabel, getPlatformAbbr } from '@/lib/utils'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import StreamingOutput from '@/components/ui/StreamingOutput'
import Link from 'next/link'

type Step = 'configure' | 'review' | 'output'

interface Config {
  query: string
  niche_id: string
  ad_formats: string[]
  platforms: string[]
  performance_scores: string[]
  per_page: number
  start_date: string
  end_date: string
}

const DEFAULT_CONFIG: Config = {
  query: '',
  niche_id: '',
  ad_formats: [],
  platforms: [],
  performance_scores: ['winning', 'optimized'],
  per_page: 20,
  start_date: '',
  end_date: '',
}

const PLATFORM_OPTIONS = ['facebook', 'instagram', 'tiktok', 'youtube', 'twitter']
const PERF_OPTIONS = ['winning', 'optimized', 'growing', 'scaling', 'testing']
const COUNT_OPTIONS = [20, 35, 50]

function toggleArr(arr: string[], val: string) {
  return arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val]
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}:${s.toString().padStart(2, '0')}` : `0:${s.toString().padStart(2, '0')}`
}

// Compact selectable ad card for the review step
function SelectableAdCard({
  ad,
  selected,
  onToggle,
}: {
  ad: Ad
  selected: boolean
  onToggle: () => void
}) {
  const thumbnail = ad.media?.[0]?.thumbnail_url ?? ad.media?.[0]?.url ?? null
  const isVideo = ad.display_format === 'video' || ad.media?.[0]?.type === 'video'
  const perfColor = PERF_COLORS[ad.performance_score_title] ?? 'text-zinc-400 bg-zinc-400/10 border-zinc-400/20'

  return (
    <button
      onClick={onToggle}
      className={`relative text-left rounded-xl border overflow-hidden transition-all duration-150 w-full ${
        selected
          ? 'border-accent/50 ring-1 ring-accent/30 opacity-100'
          : 'border-app-border opacity-40 hover:opacity-60'
      }`}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-surface-raised overflow-hidden">
        {thumbnail ? (
          <img src={thumbnail} alt="" className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full bg-surface-raised flex items-center justify-center text-zinc-700">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </div>
        )}

        {/* Video indicator */}
        {isVideo && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-7 h-7 rounded-full bg-black/60 flex items-center justify-center">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="white">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            </div>
          </div>
        )}

        {/* Checkmark */}
        <div
          className={`absolute top-2 right-2 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
            selected
              ? 'bg-accent border-accent'
              : 'bg-black/50 border-white/30'
          }`}
        >
          {selected && (
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </div>

        {/* Perf badge */}
        <div className="absolute bottom-1.5 left-1.5">
          <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full border ${perfColor}`}>
            {ad.performance_score_title}
          </span>
        </div>
      </div>

      {/* Meta */}
      <div className="p-2.5 bg-surface-card">
        <p className="text-[11px] font-medium text-zinc-200 leading-tight line-clamp-2 mb-1.5">
          {ad.title ?? ad.brand.name}
        </p>
        <div className="flex items-center gap-2 text-[10px] text-zinc-600">
          <span>{ad.brand.name}</span>
          <span>·</span>
          <span>{getPlatformAbbr(ad.platform)}</span>
          <span>·</span>
          <span>{ad.days_active}d</span>
          <span className="ml-auto">{getFormatLabel(ad.display_format)}</span>
        </div>
      </div>
    </button>
  )
}

export default function BriefsPage() {
  const [step, setStep] = useState<Step>('configure')
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG)
  const [brand, setBrand] = useState<BrandContext | null>(null)

  // Review step state
  const [fetchedAds, setFetchedAds] = useState<Ad[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [fetching, setFetching] = useState(false)
  const [remainingCredits, setRemainingCredits] = useState<number | null>(null)

  // Output step state
  const [output, setOutput] = useState('')
  const [generating, setGenerating] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [done, setDone] = useState(false)
  const [activeVideoRefs, setActiveVideoRefs] = useState<Array<{ adId: number; videoUrl: string; mimeType: string }>>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem(BRAND_CONTEXT_KEY)
    if (stored) {
      try {
        const ctx = JSON.parse(stored) as BrandContext
        setBrand(ctx)
        if (ctx.niche_id) setConfig(c => ({ ...c, niche_id: ctx.niche_id }))
      } catch {}
    }
  }, [])

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  // ── Step 1: Fetch ads ──────────────────────────────────────────────────────

  async function fetchAds() {
    if ((!config.niche_id && !config.query) || config.performance_scores.length === 0) return
    setFetching(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        performance_scores: config.performance_scores.join(','),
        sort_column: 'days_active',
        sort_direction: 'desc',
        per_page: String(config.per_page),
        page: '1',
      })
      if (config.query) params.set('query', config.query)
      if (config.niche_id) params.set('niche', config.niche_id)
      if (config.ad_formats.length) params.set('ad-format', config.ad_formats.join(','))
      if (config.platforms.length) params.set('platform', config.platforms.join(','))
      if (config.start_date) params.set('start-date', config.start_date)
      if (config.end_date) params.set('end-date', config.end_date)

      const res = await fetch(`/api/gethookd/explore?${params}`)
      const data = await res.json()

      if (!res.ok) {
        setError(data.message ?? 'Failed to fetch ads')
        return
      }

      const ads: Ad[] = data.data ?? []
      if (ads.length === 0) {
        setError('No ads found. Try adjusting your filters.')
        return
      }

      cacheCredits(data.remaining_credits)
      setRemainingCredits(data.remaining_credits)
      window.dispatchEvent(new CustomEvent('credits-updated', { detail: { remaining: data.remaining_credits } }))

      setFetchedAds(ads)
      setSelectedIds(new Set(ads.map(a => a.id))) // all selected by default
      setStep('review')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setFetching(false)
    }
  }

  // ── Step 2: Generate brief from selected ads ───────────────────────────────

  async function generateBrief() {
    const selected = fetchedAds.filter(a => selectedIds.has(a.id))
    if (selected.length === 0) return

    setStep('output')
    setOutput('')
    setDone(false)
    setGenerating(true)
    setElapsed(0)
    setError(null)

    // Build video refs for Gemini analysis
    const videoRefs = selected
      .filter(ad => (ad.display_format === 'video' || ad.media?.[0]?.type === 'video') && ad.media?.[0]?.url)
      .slice(0, 5)
      .map(ad => ({ adId: ad.id, videoUrl: ad.media[0].url, mimeType: 'video/mp4' }))
    setActiveVideoRefs(videoRefs)

    // Start elapsed timer
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)

    try {
      const niche = NICHES.find(n => n.id === config.niche_id)
      const filterParts = [
        config.query ? `"${config.query}"` : null,
        niche?.label ?? null,
        config.ad_formats.length ? config.ad_formats.map(f => AD_FORMATS.find(af => af.value === f)?.label ?? f).join(', ') : null,
        config.platforms.length ? config.platforms.join(', ') : 'all platforms',
        config.performance_scores.join(', '),
        config.start_date ? `${config.start_date} – ${config.end_date || 'now'}` : 'all time',
      ].filter(Boolean)

      const res = await fetch('/api/ai/brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slimAds: selected.map(slimAd),
          niche_label: niche?.label ?? config.query ?? 'General',
          filters_summary: filterParts.join(' · '),
          brand_context: brand ?? {},
          video_refs: videoRefs,
        }),
      })

      if (!res.ok) {
        setError('AI analysis failed. Please try again.')
        setStep('review')
        return
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done: streamDone, value } = await reader.read()
        if (streamDone) break
        setOutput(prev => prev + decoder.decode(value, { stream: true }))
      }

      setDone(true)
    } catch {
      setError('Something went wrong. Please try again.')
      setStep('review')
    } finally {
      setGenerating(false)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }

  function reset() {
    if (timerRef.current) clearInterval(timerRef.current)
    setStep('configure')
    setFetchedAds([])
    setSelectedIds(new Set())
    setOutput('')
    setDone(false)
    setError(null)
    setActiveVideoRefs([])
  }

  const selectedNiche = NICHES.find(n => n.id === config.niche_id)
  const briefLabel = config.query
    ? `"${config.query}"${selectedNiche ? ` · ${selectedNiche.label}` : ''}`
    : selectedNiche?.label ?? 'All niches'
  const selectedCount = selectedIds.size

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen p-6 lg:p-8">
      <div className="max-w-5xl mx-auto">

        {/* Page header + step indicator */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Brief Generator</h1>
            <p className="text-sm text-zinc-500">
              Pull top ads, review and curate them, then generate a full creative brief.
            </p>
          </div>

          {/* Step breadcrumb */}
          <div className="flex items-center gap-2 shrink-0 pt-1">
            {(['configure', 'review', 'output'] as Step[]).map((s, i) => {
              const labels: Record<Step, string> = { configure: '1. Configure', review: '2. Review Ads', output: '3. Brief' }
              const isActive = step === s
              const isPast =
                (s === 'configure' && (step === 'review' || step === 'output')) ||
                (s === 'review' && step === 'output')
              return (
                <div key={s} className="flex items-center gap-2">
                  {i > 0 && <div className="w-4 h-px bg-app-border" />}
                  <span
                    className={`text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${
                      isActive
                        ? 'bg-accent/15 text-accent border border-accent/30'
                        : isPast
                          ? 'text-zinc-400'
                          : 'text-zinc-600'
                    }`}
                  >
                    {labels[s]}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── STEP 1: Configure ── */}
        {step === 'configure' && (
          <div className="bg-surface-card border border-app-border rounded-2xl p-6 max-w-xl">
            {error && (
              <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
                {error}
              </div>
            )}

            <div className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Keyword Search
                  <span className="ml-1.5 text-zinc-600 font-normal">(optional if niche selected)</span>
                </label>
                <input
                  type="text"
                  value={config.query}
                  onChange={e => setConfig(c => ({ ...c, query: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter' && (config.query || config.niche_id)) fetchAds() }}
                  placeholder='e.g. "pre-workout" or "creatine supplement"'
                  className="w-full bg-surface-raised border border-app-border rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Niche
                  <span className="ml-1.5 text-zinc-600 font-normal">(optional if keyword entered)</span>
                </label>
                <select
                  value={config.niche_id}
                  onChange={e => setConfig(c => ({ ...c, niche_id: e.target.value }))}
                  className="w-full bg-surface-raised border border-app-border rounded-lg px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-accent"
                >
                  <option value="">All niches...</option>
                  {NICHES.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2">Platform (optional)</label>
                <div className="flex flex-wrap gap-1.5">
                  {PLATFORM_OPTIONS.map(p => {
                    const active = config.platforms.includes(p)
                    return (
                      <button
                        key={p}
                        onClick={() => setConfig(c => ({ ...c, platforms: toggleArr(c.platforms, p) }))}
                        className={`text-xs px-3 py-1.5 rounded-full border capitalize transition-all ${active ? 'bg-accent/15 border-accent/40 text-accent' : 'border-app-border text-zinc-500 hover:text-zinc-300'}`}
                      >
                        {p}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2">Performance Tiers</label>
                <div className="flex flex-wrap gap-1.5">
                  {PERF_OPTIONS.map(p => {
                    const active = config.performance_scores.includes(p)
                    return (
                      <button
                        key={p}
                        onClick={() => setConfig(c => ({ ...c, performance_scores: toggleArr(c.performance_scores, p) }))}
                        className={`text-xs px-3 py-1.5 rounded-full border capitalize transition-all ${active ? 'bg-accent/15 border-accent/40 text-accent' : 'border-app-border text-zinc-500 hover:text-zinc-300'}`}
                      >
                        {p}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2">
                  Ad Format
                  <span className="ml-1.5 text-zinc-600 font-normal">(optional — leave blank for all)</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {AD_FORMATS.map(f => {
                    const active = config.ad_formats.includes(f.value)
                    return (
                      <button
                        key={f.value}
                        onClick={() => setConfig(c => ({ ...c, ad_formats: toggleArr(c.ad_formats, f.value) }))}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-all ${active ? 'bg-accent/15 border-accent/40 text-accent' : 'border-app-border text-zinc-500 hover:text-zinc-300'}`}
                      >
                        {f.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2">Ads to Fetch</label>
                <div className="flex gap-2">
                  {COUNT_OPTIONS.map(n => (
                    <button
                      key={n}
                      onClick={() => setConfig(c => ({ ...c, per_page: n }))}
                      className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${config.per_page === n ? 'bg-accent/15 border-accent/40 text-accent' : 'border-app-border text-zinc-500 hover:text-zinc-300'}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Date Range (optional)</label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={config.start_date}
                    onChange={e => setConfig(c => ({ ...c, start_date: e.target.value }))}
                    className="flex-1 bg-surface-raised border border-app-border rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-accent"
                  />
                  <input
                    type="date"
                    value={config.end_date}
                    onChange={e => setConfig(c => ({ ...c, end_date: e.target.value }))}
                    className="flex-1 bg-surface-raised border border-app-border rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-accent"
                  />
                </div>
              </div>

              {brand?.brand_name ? (
                <div className="px-3 py-2.5 bg-surface-raised border border-app-border rounded-lg">
                  <div className="text-xs text-zinc-500 mb-0.5">Using brand context</div>
                  <div className="text-xs text-zinc-300 font-medium">{brand.brand_name}</div>
                </div>
              ) : (
                <div className="px-3 py-2.5 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                  <p className="text-xs text-amber-400">
                    No brand context.{' '}
                    <Link href="/settings" className="underline">Add it in Settings</Link>
                    {' '}for personalized concepts.
                  </p>
                </div>
              )}
            </div>

            <button
              onClick={fetchAds}
              disabled={fetching || (!config.niche_id && !config.query) || config.performance_scores.length === 0}
              className="mt-6 w-full py-3 bg-accent hover:bg-accent-hover text-white font-medium rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {fetching ? (
                <><LoadingSpinner size="sm" /> Fetching ads...</>
              ) : (
                'Fetch Ads →'
              )}
            </button>
          </div>
        )}

        {/* ── STEP 2: Review ads ── */}
        {step === 'review' && (
          <div>
            {/* Toolbar */}
            <div className="flex items-center justify-between mb-5 gap-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => { setStep('configure'); setError(null) }}
                  className="text-sm text-zinc-500 hover:text-zinc-300 flex items-center gap-1.5 transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                  Back
                </button>
                <div className="h-4 w-px bg-app-border" />
                <span className="text-sm text-zinc-400">
                  <span className="text-white font-semibold">{selectedCount}</span>
                  <span className="text-zinc-600"> of {fetchedAds.length} ads selected</span>
                </span>
                {remainingCredits !== null && (
                  <span className="text-xs text-zinc-600">{remainingCredits.toLocaleString()} credits remaining</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedIds(new Set(fetchedAds.map(a => a.id)))}
                  className="text-xs text-zinc-500 hover:text-zinc-300 px-3 py-1.5 rounded-lg border border-app-border hover:border-app-border-strong transition-colors"
                >
                  Select All
                </button>
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="text-xs text-zinc-500 hover:text-zinc-300 px-3 py-1.5 rounded-lg border border-app-border hover:border-app-border-strong transition-colors"
                >
                  Deselect All
                </button>
                <button
                  onClick={generateBrief}
                  disabled={selectedCount === 0}
                  className="px-5 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Generate Brief from {selectedCount} ad{selectedCount !== 1 ? 's' : ''}
                </button>
              </div>
            </div>

            {/* Instruction */}
            <p className="text-xs text-zinc-600 mb-4">
              Click any ad to deselect it. Dimmed ads will be excluded from the brief.
            </p>

            {/* Ad grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {fetchedAds.map(ad => (
                <SelectableAdCard
                  key={ad.id}
                  ad={ad}
                  selected={selectedIds.has(ad.id)}
                  onToggle={() => {
                    setSelectedIds(prev => {
                      const next = new Set(prev)
                      next.has(ad.id) ? next.delete(ad.id) : next.add(ad.id)
                      return next
                    })
                  }}
                />
              ))}
            </div>

            {/* Sticky bottom bar */}
            <div className="sticky bottom-0 mt-6 -mx-6 px-6 py-4 bg-surface-base/90 backdrop-blur-sm border-t border-app-border flex items-center justify-between">
              <span className="text-sm text-zinc-500">
                {selectedCount === 0 ? (
                  <span className="text-amber-400">Select at least one ad to continue</span>
                ) : (
                  <><span className="text-white font-medium">{selectedCount}</span> ads selected for analysis</>
                )}
              </span>
              <button
                onClick={generateBrief}
                disabled={selectedCount === 0}
                className="px-6 py-2.5 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Generate Brief →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Output ── */}
        {step === 'output' && (
          <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-6 gap-4">
              <div>
                <div className="text-xs text-zinc-500 mb-0.5">
                  {briefLabel} · {selectedCount} ads analyzed · {new Date().toLocaleDateString()}
                </div>
                <h2 className="text-lg font-semibold text-white">Creative Brief</h2>
              </div>
              <div className="flex items-center gap-2">
                {done && (
                  <button
                    onClick={() => navigator.clipboard.writeText(output)}
                    className="px-4 py-2 text-sm text-zinc-400 hover:text-white border border-app-border rounded-lg transition-colors flex items-center gap-2"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    Copy
                  </button>
                )}
                <button
                  onClick={() => setStep('review')}
                  disabled={generating}
                  className="px-4 py-2 text-sm text-zinc-400 hover:text-white border border-app-border rounded-lg transition-colors disabled:opacity-40"
                >
                  ← Back to Ads
                </button>
                <button
                  onClick={reset}
                  className="px-4 py-2 text-sm text-zinc-400 hover:text-white border border-app-border rounded-lg transition-colors"
                >
                  New Brief
                </button>
              </div>
            </div>

            {/* Progress indicator — shown while Claude is working */}
            {generating && (
              <div className="mb-6 px-5 py-4 bg-surface-card border border-app-border rounded-xl flex items-center gap-4">
                <div className="relative shrink-0">
                  <LoadingSpinner size="md" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-white">
                      {output ? 'Writing brief...' : 'Claude is thinking...'}
                    </span>
                    <span className="text-xs text-zinc-600 font-mono">{formatElapsed(elapsed)}</span>
                  </div>
                  {activeVideoRefs.length > 0 && !output && (
                    <p className="text-xs text-violet-400 mb-0.5">
                      Analyzing {activeVideoRefs.length} video{activeVideoRefs.length !== 1 ? 's' : ''} with Gemini first...
                    </p>
                  )}
                  <p className="text-xs text-zinc-600">
                    {output
                      ? 'Text is streaming below — scroll down to read as it generates.'
                      : 'Extended thinking is in progress. This typically takes 60–90 seconds before text begins appearing.'}
                  </p>
                </div>
                {/* Animated dots to show activity */}
                <div className="flex gap-1 shrink-0">
                  {[0, 1, 2].map(i => (
                    <div
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s`, animationDuration: '1s' }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Done indicator */}
            {done && (
              <div className="mb-6 px-5 py-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl flex items-center gap-3">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span className="text-sm text-emerald-400">
                  Brief complete · generated in {formatElapsed(elapsed)}
                </span>
              </div>
            )}

            {/* Output area */}
            <div className="bg-surface-card border border-app-border rounded-2xl p-8">
              {!output ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                  <div className="flex gap-1.5">
                    {[0, 1, 2, 3].map(i => (
                      <div
                        key={i}
                        className="w-2 h-2 rounded-full bg-zinc-700 animate-pulse"
                        style={{ animationDelay: `${i * 0.2}s` }}
                      />
                    ))}
                  </div>
                  <p className="text-sm text-zinc-600 max-w-xs">
                    Claude is processing {selectedCount} ads. The brief will appear here as soon as text starts generating.
                  </p>
                </div>
              ) : (
                <StreamingOutput content={output} autoScroll={generating} />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
