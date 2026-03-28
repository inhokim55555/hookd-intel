'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { BRAND_CONTEXT_KEY, DNA_SOURCE_AD_KEY } from '@/lib/constants'
import type { Ad, BrandContext, CloneAd } from '@/lib/types'
import { cacheCredits, getPlatformAbbr, getFormatLabel } from '@/lib/utils'
import { geminiAvailable } from '@/lib/gemini'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import StreamingOutput from '@/components/ui/StreamingOutput'
import PerformanceBadge from '@/components/ui/PerformanceBadge'
import AdCard from '@/components/ui/AdCard'
import HistoryPanel from '@/components/ui/HistoryPanel'
import type { SaveFn } from '@/components/ui/HistoryPanel'
import type { HistoryItem } from '@/lib/history'

type Step = 'select' | 'configure' | 'results'

const ASPECT_OPTIONS = [
  { value: 'Square', label: 'Square (1:1)', hint: 'Feed posts' },
  { value: 'Portrait', label: 'Portrait (4:5)', hint: 'Stories / Reels' },
  { value: 'Landscape', label: 'Landscape (16:9)', hint: 'YouTube / Banner' },
]

export default function DnaPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('select')
  const [sourceAd, setSourceAd] = useState<Ad | null>(null)
  const [brand, setBrand] = useState<BrandContext | null>(null)

  // Configure state
  const [aspectRatio, setAspectRatio] = useState('Square')
  const [customPrompt, setCustomPrompt] = useState('')
  const [creativeDirection, setCreativeDirection] = useState('')
  const [variationCount, setVariationCount] = useState<5 | 10 | 15>(10)

  // Results state
  const [copyOutput, setCopyOutput] = useState('')
  const [loadingCopy, setLoadingCopy] = useState(false)
  const [cloneId, setCloneId] = useState<number | null>(null)
  const [cloneData, setCloneData] = useState<CloneAd | null>(null)
  const [loadingClone, setLoadingClone] = useState(false)
  const [cloneError, setCloneError] = useState<string | null>(null)
  const [pollSeconds, setPollSeconds] = useState(0)
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  // History state
  const saveRef = useRef<SaveFn | null>(null)
  const copyAccumRef = useRef('')
  const [historyTitle, setHistoryTitle] = useState<string | null>(null)

  // Mini search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Ad[]>([])
  const [searching, setSearching] = useState(false)
  const [detailAd, setDetailAd] = useState<Ad | null>(null)

  useEffect(() => {
    // Load brand context
    const stored = localStorage.getItem(BRAND_CONTEXT_KEY)
    if (stored) {
      try { setBrand(JSON.parse(stored)) } catch {}
    }

    // Check for ad passed from Explorer
    const passedAd = sessionStorage.getItem(DNA_SOURCE_AD_KEY)
    if (passedAd) {
      try {
        setSourceAd(JSON.parse(passedAd))
        sessionStorage.removeItem(DNA_SOURCE_AD_KEY)
        setStep('configure')
      } catch {}
    }
  }, [])

  // Cleanup poll on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  async function searchAds() {
    if (!searchQuery.trim()) return
    setSearching(true)
    try {
      const params = new URLSearchParams({
        query: searchQuery,
        performance_scores: 'winning,optimized',
        sort_column: 'days_active',
        sort_direction: 'desc',
        per_page: '12',
      })
      const res = await fetch(`/api/gethookd/explore?${params}`)
      const data = await res.json()
      setSearchResults(data.data ?? [])
    } finally {
      setSearching(false)
    }
  }

  function selectAd(ad: Ad) {
    setSourceAd(ad)
    setStep('configure')
  }

  async function generate() {
    if (!sourceAd) return
    setStep('results')
    setCopyOutput('')
    setCloneData(null)
    setCloneId(null)
    setCloneError(null)
    setPollSeconds(0)
    setHistoryTitle(null)

    // Start both in parallel
    streamCopyVariations()
    triggerVisualClone()
  }

  async function streamCopyVariations() {
    setLoadingCopy(true)
    copyAccumRef.current = ''
    try {
      const res = await fetch('/api/ai/dna', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ad: sourceAd,
          brand_context: brand ?? {},
          creative_direction: creativeDirection,
          variation_count: variationCount,
        }),
      })

      if (!res.ok) { setLoadingCopy(false); return }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const decoded = decoder.decode(value, { stream: true })
        copyAccumRef.current += decoded
        setCopyOutput(copyAccumRef.current)
      }

      // Save to history after streaming completes
      if (copyAccumRef.current && sourceAd) {
        const isVideoAd = sourceAd.display_format === 'video' || sourceAd.media?.[0]?.type === 'video'
        saveRef.current?.({
          title: `${sourceAd.brand.name} · ${variationCount} Variations`,
          metadata: {
            brand: sourceAd.brand.name,
            platform: sourceAd.platform,
            format: sourceAd.display_format,
            variation_count: variationCount,
            source_ad_title: sourceAd.title,
            has_gemini: isVideoAd && geminiAvailable(),
          },
          output: copyAccumRef.current,
        })
      }
    } finally {
      setLoadingCopy(false)
    }
  }

  async function triggerVisualClone() {
    if (!sourceAd) return
    setLoadingClone(true)

    try {
      const body: Record<string, unknown> = {
        ad_id: sourceAd.id,
        aspect_ratio: aspectRatio,
        variations_count: 10,
      }
      if (customPrompt.trim()) body.prompt = customPrompt.trim()

      const res = await fetch('/api/gethookd/clone-ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok) {
        setCloneError(data.message ?? 'Failed to start visual cloning')
        setLoadingClone(false)
        return
      }

      cacheCredits(data.remaining_credits)
      window.dispatchEvent(new CustomEvent('credits-updated', { detail: { remaining: data.remaining_credits } }))

      const id = data.data?.id
      if (!id) {
        setCloneError('No clone ID returned')
        setLoadingClone(false)
        return
      }

      setCloneId(id)
      startPolling(id)
    } catch {
      setCloneError('Network error during visual cloning')
      setLoadingClone(false)
    }
  }

  function startPolling(id: number) {
    const start = Date.now()
    pollRef.current = setInterval(async () => {
      const elapsed = Math.round((Date.now() - start) / 1000)
      setPollSeconds(elapsed)

      // Timeout after 3 minutes
      if (elapsed > 180) {
        clearInterval(pollRef.current!)
        setCloneError('Timed out waiting for visual clones. Try again later.')
        setLoadingClone(false)
        return
      }

      try {
        const res = await fetch(`/api/gethookd/clone-ads/${id}`)
        const data = await res.json()
        if (!res.ok) {
          clearInterval(pollRef.current!)
          setCloneError(data.message ?? 'Failed to poll clone status')
          setLoadingClone(false)
          return
        }

        const clone: CloneAd = data.data
        const allDone = clone.prompts.every((p: { in_progress: boolean }) => !p.in_progress)

        if (allDone) {
          clearInterval(pollRef.current!)
          setCloneData(clone)
          setLoadingClone(false)

          if (data.remaining_credits !== undefined) {
            cacheCredits(data.remaining_credits)
            window.dispatchEvent(new CustomEvent('credits-updated', { detail: { remaining: data.remaining_credits } }))
          }
        }
      } catch {
        // Keep polling on transient errors
      }
    }, 5000)
  }

  function reset() {
    if (pollRef.current) clearInterval(pollRef.current)
    setStep('select')
    setSourceAd(null)
    setCopyOutput('')
    setCloneData(null)
    setCloneId(null)
    setCloneError(null)
    setSearchResults([])
    setSearchQuery('')
    setHistoryTitle(null)
  }

  function loadFromHistory(item: HistoryItem) {
    setSourceAd(null)
    setCopyOutput(item.output)
    setCloneData(null)
    setCloneError(null)
    setCloneId(null)
    setLoadingClone(false)
    setLoadingCopy(false)
    setHistoryTitle(item.title)
    setStep('results')
  }

  const isVideoAd = sourceAd?.display_format === 'video' || sourceAd?.media?.[0]?.type === 'video'

  // Suppress unused variable warning for detailAd
  void detailAd

  return (
    <div className="min-h-screen p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-1">DNA Multiplier</h1>
          <p className="text-sm text-zinc-500">
            Take one winning ad and generate 10 distinct copy variations + AI visual clones.
          </p>
        </div>

        {/* History Panel */}
        <HistoryPanel type="dna" onLoad={loadFromHistory} saveRef={saveRef} />

        {/* Step 1: Select */}
        {step === 'select' && (
          <div className="space-y-6">
            <div className="bg-surface-card border border-app-border rounded-2xl p-6">
              <h2 className="text-sm font-semibold text-white mb-4">Search for a Source Ad</h2>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') searchAds() }}
                  placeholder="Search by keyword or brand name (e.g. 'pre-workout')"
                  className="flex-1 bg-surface-raised border border-app-border rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-accent"
                />
                <button
                  onClick={searchAds}
                  disabled={searching || !searchQuery.trim()}
                  className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40"
                >
                  {searching ? <LoadingSpinner size="sm" /> : 'Search'}
                </button>
              </div>
              <p className="text-xs text-zinc-600 mt-2">
                For best results, use the{' '}
                <button onClick={() => router.push('/explorer')} className="text-accent underline underline-offset-2">
                  Ad Explorer
                </button>
                {' '}and click "Open in DNA" on any ad — the full ad data transfers automatically.
              </p>
            </div>

            {searchResults.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
                  Select a source ad
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {searchResults.map(ad => (
                    <div
                      key={ad.id}
                      className="cursor-pointer ring-transparent hover:ring-2 hover:ring-accent/50 rounded-xl transition-all"
                      onClick={() => selectAd(ad)}
                    >
                      <AdCard ad={ad} onViewDetails={() => selectAd(ad)} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Configure */}
        {step === 'configure' && sourceAd && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Source ad preview */}
            <div className="bg-surface-card border border-app-border rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-app-border">
                <div className="text-xs text-zinc-500 mb-0.5">Source Ad</div>
                <div className="flex items-center gap-2">
                  {sourceAd.brand.logo_url && (
                    <img src={sourceAd.brand.logo_url} alt="" className="w-5 h-5 rounded-full bg-white object-contain" />
                  )}
                  <span className="text-sm font-semibold text-white">{sourceAd.brand.name}</span>
                  <span className="text-xs text-zinc-600">·</span>
                  <span className="text-xs text-zinc-500">{getPlatformAbbr(sourceAd.platform)}</span>
                  <span className="text-xs text-zinc-500">·</span>
                  <span className="text-xs text-zinc-500">{getFormatLabel(sourceAd.display_format)}</span>
                </div>
              </div>

              {/* Thumbnail */}
              <div className="aspect-video bg-surface-raised relative overflow-hidden">
                {sourceAd.media?.[0]?.thumbnail_url || sourceAd.media?.[0]?.url ? (
                  <img
                    src={sourceAd.media[0].thumbnail_url ?? sourceAd.media[0].url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-700">No preview</div>
                )}
                <div className="absolute bottom-2 left-2">
                  <PerformanceBadge score={sourceAd.performance_score_title} />
                </div>
                <div className="absolute bottom-2 right-2">
                  <span className="text-xs text-zinc-300 bg-black/60 px-1.5 py-0.5 rounded">
                    {sourceAd.days_active}d active · {sourceAd.used_count}x used
                  </span>
                </div>
              </div>

              <div className="p-5 space-y-3">
                {sourceAd.title && (
                  <div>
                    <div className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">Headline</div>
                    <p className="text-sm text-zinc-200">{sourceAd.title}</p>
                  </div>
                )}
                {sourceAd.body && (
                  <div>
                    <div className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">Body</div>
                    <p className="text-xs text-zinc-400 leading-relaxed line-clamp-5">{sourceAd.body}</p>
                  </div>
                )}
                {sourceAd.cta_text && (
                  <span className="inline-block text-xs bg-accent/10 text-accent border border-accent/20 px-2 py-0.5 rounded">
                    {sourceAd.cta_text}
                  </span>
                )}
              </div>

              <div className="px-5 pb-4">
                <button
                  onClick={() => setStep('select')}
                  className="text-xs text-zinc-600 hover:text-zinc-400 underline underline-offset-2"
                >
                  Choose a different ad
                </button>
              </div>
            </div>

            {/* Configure */}
            <div className="bg-surface-card border border-app-border rounded-2xl p-6 flex flex-col gap-5">
              <h2 className="text-sm font-semibold text-white">Configure Generation</h2>

              {/* Brand context card */}
              {brand?.brand_name ? (
                <div className="rounded-xl border border-app-border bg-surface-raised overflow-hidden">
                  <div className="px-3 py-2 border-b border-app-border flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">Brand Voice Active</span>
                  </div>
                  <div className="p-3 space-y-2">
                    <div>
                      <div className="text-[10px] text-zinc-600 uppercase tracking-wider mb-0.5">Brand</div>
                      <div className="text-xs text-white font-medium">{brand.brand_name}</div>
                    </div>
                    {brand.product_description && (
                      <div>
                        <div className="text-[10px] text-zinc-600 uppercase tracking-wider mb-0.5">Product</div>
                        <div className="text-xs text-zinc-300">{brand.product_description}</div>
                      </div>
                    )}
                    {brand.target_audience && (
                      <div>
                        <div className="text-[10px] text-zinc-600 uppercase tracking-wider mb-0.5">Audience</div>
                        <div className="text-xs text-zinc-300">{brand.target_audience}</div>
                      </div>
                    )}
                    {brand.brand_voice && (
                      <div>
                        <div className="text-[10px] text-zinc-600 uppercase tracking-wider mb-0.5">Tone / Voice</div>
                        <div className="text-xs text-zinc-300">{brand.brand_voice}</div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="px-3 py-2.5 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                  <p className="text-xs text-amber-400">
                    No brand context configured. Variations will match the source brand&apos;s style.
                  </p>
                </div>
              )}

              {/* Creative Direction */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Creative Direction <span className="text-zinc-600 font-normal">(optional)</span>
                </label>
                <textarea
                  value={creativeDirection}
                  onChange={e => setCreativeDirection(e.target.value)}
                  placeholder={'e.g., "Focus on the pre-workout angle" or "Make the tone more aggressive and punchy"'}
                  rows={3}
                  className="w-full bg-surface-raised border border-app-border rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-accent resize-none"
                />
                <p className="text-xs text-zinc-600 mt-1">Applied across all copy variations.</p>
              </div>

              {/* Variation count */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2">Number of Variations</label>
                <div className="flex gap-2">
                  {([5, 10, 15] as const).map(n => (
                    <button
                      key={n}
                      onClick={() => setVariationCount(n)}
                      className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${variationCount === n ? 'bg-accent/10 border-accent/30 text-white' : 'border-app-border text-zinc-400 hover:text-zinc-200'}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Aspect ratio */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2">Aspect Ratio for Visual Clones</label>
                <div className="space-y-2">
                  {ASPECT_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setAspectRatio(opt.value)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-all ${aspectRatio === opt.value ? 'bg-accent/10 border-accent/30 text-white' : 'border-app-border text-zinc-400 hover:text-zinc-200'}`}
                    >
                      <span>{opt.label}</span>
                      <span className="text-xs text-zinc-600">{opt.hint}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Visual prompt */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Visual Generation Prompt <span className="text-zinc-600 font-normal">(optional)</span>
                </label>
                <textarea
                  value={customPrompt}
                  onChange={e => setCustomPrompt(e.target.value)}
                  placeholder="e.g., Make it feel premium and minimalist with a dark background..."
                  rows={2}
                  className="w-full bg-surface-raised border border-app-border rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-accent resize-none"
                />
                <p className="text-xs text-zinc-600 mt-1">Leave blank to auto-generate from the source ad.</p>
              </div>

              {isVideoAd && (
                <div className="px-3 py-2.5 bg-amber-500/5 border border-amber-500/15 rounded-lg">
                  <p className="text-xs text-amber-400">
                    Video ad detected. Gethookd will analyze the video before generating images — this can take 60–90s. Visual clones are generated from the thumbnail.
                  </p>
                </div>
              )}

              <div className="text-xs text-zinc-600">
                Visual generation uses approximately 1.5–2 Gethookd credits.
              </div>

              <button
                onClick={generate}
                className="w-full py-3 bg-accent hover:bg-accent-hover text-white font-medium rounded-xl transition-colors"
              >
                Generate {variationCount} Variations
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Results */}
        {step === 'results' && (
          <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                {sourceAd ? (
                  <div className="text-xs text-zinc-500 mb-0.5">
                    Source: {sourceAd.brand.name} · {sourceAd.performance_score_title}
                  </div>
                ) : historyTitle ? (
                  <div className="text-xs text-zinc-500 mb-0.5">
                    Loaded from history: {historyTitle}
                  </div>
                ) : null}
                <h2 className="text-lg font-semibold text-white">{variationCount} Ad Variations</h2>
              </div>
              <div className="flex gap-2">
                {copyOutput && (
                  <button
                    onClick={() => navigator.clipboard.writeText(copyOutput)}
                    className="px-4 py-2 text-sm text-zinc-400 hover:text-white border border-app-border rounded-lg transition-colors flex items-center gap-2"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    Copy All
                  </button>
                )}
                <button
                  onClick={reset}
                  className="px-4 py-2 text-sm text-zinc-400 hover:text-white border border-app-border rounded-lg transition-colors"
                >
                  New Source Ad
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Copy Variations (Claude) */}
              <div className="bg-surface-card border border-app-border rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-app-border flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${loadingCopy ? 'bg-accent animate-pulse' : 'bg-emerald-400'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white">Copy Variations</div>
                    <div className="text-xs text-zinc-500">claude-sonnet-4-6 · extended thinking</div>
                  </div>
                  {loadingCopy && !copyOutput && (
                    <div className="text-xs text-zinc-500 tabular-nums">thinking...</div>
                  )}
                  {loadingCopy && copyOutput && (
                    <div className="text-xs text-zinc-500">writing...</div>
                  )}
                </div>
                <div className="p-6 max-h-[70vh] overflow-y-auto">
                  {loadingCopy && !copyOutput && (
                    <div className="flex flex-col items-center justify-center py-12 gap-5 text-center">
                      <div className="relative">
                        <LoadingSpinner size="lg" />
                        {isVideoAd && (
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center">
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" className="text-black">
                              <polygon points="5 3 19 12 5 21 5 3" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div>
                        {isVideoAd ? (
                          <>
                            <p className="text-sm font-medium text-white mb-1">Analyzing video ad...</p>
                            <p className="text-xs text-zinc-500 max-w-xs">
                              Claude is deconstructing the video creative and building {variationCount} distinct angles. This takes 20–40s for video ads.
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-sm font-medium text-white mb-1">Analyzing ad...</p>
                            <p className="text-xs text-zinc-500 max-w-xs">
                              Claude is deconstructing the ad and planning {variationCount} distinct angles. Extended thinking active.
                            </p>
                          </>
                        )}
                        {creativeDirection && (
                          <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 bg-accent/10 border border-accent/20 rounded-full">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-accent">
                              <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                            </svg>
                            <span className="text-[10px] text-accent">Creative direction applied</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {copyOutput && <StreamingOutput content={copyOutput} autoScroll={loadingCopy} />}
                </div>
              </div>

              {/* Visual Clones (Gethookd) */}
              <div className="bg-surface-card border border-app-border rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-app-border flex items-center gap-3">
                  {loadingClone && <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />}
                  {!loadingClone && cloneData && <div className="w-2 h-2 rounded-full bg-emerald-400" />}
                  {!loadingClone && cloneError && <div className="w-2 h-2 rounded-full bg-red-400" />}
                  <div>
                    <div className="text-sm font-semibold text-white">Visual Clones</div>
                    <div className="text-xs text-zinc-500">Gethookd AI image generation</div>
                  </div>
                </div>
                <div className="p-6 max-h-[70vh] overflow-y-auto">
                  {/* History-loaded state */}
                  {!sourceAd && !loadingClone && !cloneData && !cloneError && (
                    <div className="flex items-center justify-center py-12">
                      <div className="px-4 py-3 bg-zinc-800/50 border border-app-border rounded-lg text-xs text-zinc-500 text-center max-w-xs">
                        Visual clones are not available for history-loaded generations. Open the source ad in DNA to generate new clones.
                      </div>
                    </div>
                  )}

                  {loadingClone && (
                    <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
                      <LoadingSpinner size="lg" />
                      <div>
                        {isVideoAd && pollSeconds < 15 ? (
                          <>
                            <p className="text-sm font-medium text-white mb-1">Analyzing video...</p>
                            <p className="text-xs text-zinc-500">Gethookd is processing the video before generating images.</p>
                          </>
                        ) : (
                          <p className="text-sm text-zinc-400">Generating visual variations...</p>
                        )}
                        <p className="text-xs text-zinc-600 mt-1.5">{pollSeconds}s elapsed · up to {isVideoAd ? '90' : '60'}s</p>
                      </div>
                    </div>
                  )}

                  {cloneError && (
                    <div className="flex flex-col items-center justify-center py-12 gap-3">
                      <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400 text-center">
                        {cloneError}
                      </div>
                      <button onClick={triggerVisualClone} className="text-xs text-zinc-500 hover:text-zinc-300 underline">
                        Try again
                      </button>
                    </div>
                  )}

                  {cloneData && (
                    <div className="space-y-6">
                      {cloneData.prompts.map((prompt) => (
                        <div key={prompt.id}>
                          {prompt.media.length > 0 ? (
                            <div className="grid grid-cols-2 gap-2">
                              {prompt.media
                                .sort((a, b) => a.order - b.order)
                                .map(m => (
                                  <div key={m.id} className="aspect-square rounded-lg overflow-hidden bg-surface-raised">
                                    <img
                                      src={m.url}
                                      alt={`Clone ${m.order}`}
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                ))}
                            </div>
                          ) : (
                            <div className="text-xs text-zinc-600 py-4 text-center">No images generated for this prompt.</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {sourceAd && !loadingClone && !cloneData && !cloneError && (
                    <div className="flex items-center justify-center py-12">
                      <div className="flex items-center gap-3 text-zinc-600">
                        <LoadingSpinner size="sm" />
                        <span className="text-sm">Starting visual generation...</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
