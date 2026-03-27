'use client'

import { useState } from 'react'
import { NICHES, PLATFORMS, AD_FORMATS } from '@/lib/constants'
import type { Ad, TrendStats } from '@/lib/types'
import { slimAd, computeTrendStats, cacheCredits } from '@/lib/utils'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import StreamingOutput from '@/components/ui/StreamingOutput'

type Step = 'configure' | 'fetching' | 'dashboard'

interface Config {
  query: string
  niche_id: string
  performance_scores: string[]
  ad_formats: string[]
  platform: string
  location: string
  language: string
  start_date: string
  end_date: string
  count: number
  status: string
}

const DEFAULT_CONFIG: Config = {
  query: '',
  niche_id: '',
  performance_scores: ['winning', 'optimized'],
  ad_formats: [],
  platform: '',
  location: '',
  language: '',
  start_date: '',
  end_date: '',
  count: 100,
  status: '',
}

const COUNT_OPTIONS = [
  { value: 100, label: '100 ads', credits: '~1 credit' },
  { value: 200, label: '200 ads', credits: '~2 credits' },
  { value: 300, label: '300 ads', credits: '~3 credits' },
]

const PERF_OPTIONS = [
  { value: 'winning',   label: 'Winning' },
  { value: 'optimized', label: 'Optimized' },
  { value: 'growing',   label: 'Growing' },
  { value: 'scaling',   label: 'Scaling' },
  { value: 'testing',   label: 'Testing' },
]

function toggleArr(arr: string[], val: string): string[] {
  return arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val]
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface-card border border-app-border rounded-xl p-5">
      <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">{title}</h3>
      {children}
    </div>
  )
}

function fmtMonth(ym: string): string {
  const [year, month] = ym.split('-')
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${names[parseInt(month, 10) - 1]} ${year}`
}

function BarRow({ label, value, max, extra }: { label: string; value: number; max: number; extra?: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-300 capitalize">{label}</span>
        <span className="text-zinc-500">{value}{extra ? ` · ${extra}` : ''}</span>
      </div>
      <div className="h-1.5 bg-surface-raised rounded-full overflow-hidden">
        <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ── Detailed fetch-progress display ──────────────────────────────────────────

type FetchStage = 'fetching' | 'computing' | 'done'

interface FetchProgress {
  stage: FetchStage
  page: number
  totalPages: number
  adsCollected: number
}

function ProgressDisplay({ progress }: { progress: FetchProgress }) {
  // Bar fills as pages complete; snaps to 95% when computing, 100% when done
  const barPct =
    progress.stage === 'done'      ? 100 :
    progress.stage === 'computing' ? 95  :
    Math.round(((progress.page - 1) / progress.totalPages) * 90)

  const stages: Array<{ key: FetchStage | 'fetching'; label: string; detail: string }> = [
    {
      key: 'fetching',
      label: 'Fetching ads from Gethookd',
      detail:
        progress.stage === 'fetching'
          ? `Page ${progress.page} of ${progress.totalPages} · ${progress.adsCollected} ads so far`
          : `${progress.adsCollected} ads fetched across ${progress.totalPages} page${progress.totalPages !== 1 ? 's' : ''}`,
    },
    {
      key: 'computing',
      label: 'Computing statistics',
      detail:
        progress.stage === 'computing' || progress.stage === 'done'
          ? 'Calculating distributions, CTAs, monthly trends…'
          : '',
    },
  ]

  const stageIndex = (s: FetchStage | 'fetching') =>
    stages.findIndex(x => x.key === s)
  const currentIndex = stageIndex(progress.stage === 'done' ? 'computing' : progress.stage)

  return (
    <div className="max-w-sm mx-auto py-16">
      <div className="bg-surface-card border border-app-border rounded-2xl p-8 space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <LoadingSpinner size="md" />
          <div>
            <p className="text-sm font-semibold text-white">Running Trend Radar</p>
            <p className="text-xs text-zinc-500 mt-0.5">
              {progress.stage === 'fetching'
                ? `Fetching page ${progress.page} of ${progress.totalPages}…`
                : progress.stage === 'computing'
                  ? 'Crunching the numbers…'
                  : 'Complete'}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex justify-between text-[11px] text-zinc-600 mb-1.5">
            <span>{progress.adsCollected.toLocaleString()} ads collected</span>
            <span>{barPct}%</span>
          </div>
          <div className="h-2 bg-surface-raised rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-700 ease-out"
              style={{ width: `${barPct}%` }}
            />
          </div>
        </div>

        {/* Stage checklist */}
        <div className="space-y-3.5">
          {stages.map((s, i) => {
            const isDone    = i < currentIndex || progress.stage === 'done'
            const isCurrent = i === currentIndex && progress.stage !== 'done'
            return (
              <div key={s.key} className="flex items-start gap-3">
                <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                  isDone    ? 'bg-emerald-500/20 border-emerald-500/50' :
                  isCurrent ? 'border-accent bg-accent/20' :
                              'border-app-border-strong'
                }`}>
                  {isDone ? (
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : isCurrent ? (
                    <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                  ) : null}
                </div>
                <div>
                  <p className={`text-xs font-medium ${isDone || isCurrent ? 'text-zinc-200' : 'text-zinc-600'}`}>
                    {s.label}
                  </p>
                  {s.detail && (
                    <p className="text-[11px] text-zinc-500 mt-0.5">{s.detail}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function TrendsPage() {
  const [step, setStep]               = useState<Step>('configure')
  const [config, setConfig]           = useState<Config>(DEFAULT_CONFIG)
  const [ads, setAds]                 = useState<Ad[]>([])
  const [stats, setStats]             = useState<TrendStats | null>(null)
  const [progress, setProgress]       = useState<FetchProgress>({ stage: 'fetching', page: 1, totalPages: 1, adsCollected: 0 })
  const [aiOutput, setAiOutput]       = useState('')
  const [loadingAi, setLoadingAi]     = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [remainingCredits, setRemainingCredits] = useState<number | null>(null)

  // ── Fetch ───────────────────────────────────────────────────────────────────

  async function fetchData() {
    if (!config.niche_id && !config.query) return

    const totalPages = Math.ceil(config.count / 100)
    setStep('fetching')
    setError(null)
    setAds([])
    setStats(null)
    setAiOutput('')
    setProgress({ stage: 'fetching', page: 1, totalPages, adsCollected: 0 })

    const allAds: Ad[] = []

    try {
      for (let page = 1; page <= totalPages; page++) {
        setProgress(p => ({ ...p, stage: 'fetching', page }))

        const params = new URLSearchParams({
          sort_column: 'days_active',
          sort_direction: 'desc',
          per_page: '100',
          page: String(page),
        })
        if (config.query)                     params.set('query', config.query)
        if (config.niche_id)                  params.set('niche', config.niche_id)
        if (config.performance_scores.length) params.set('performance_scores', config.performance_scores.join(','))
        if (config.ad_formats.length)         params.set('ad-format', config.ad_formats.join(','))
        if (config.platform)                  params.set('platform', config.platform)
        if (config.location)                  params.set('location', config.location)
        if (config.language)                  params.set('language', config.language)
        if (config.start_date)                params.set('start-date', config.start_date)
        if (config.end_date)                  params.set('end-date', config.end_date)
        if (config.status)                    params.set('status', config.status)

        const res  = await fetch(`/api/gethookd/explore?${params}`)
        const data = await res.json()

        if (!res.ok) {
          setError(data.message ?? 'Failed to fetch ads')
          setStep('configure')
          return
        }

        const pageAds: Ad[] = data.data ?? []
        allAds.push(...pageAds)
        setProgress(p => ({ ...p, adsCollected: allAds.length }))

        cacheCredits(data.remaining_credits)
        setRemainingCredits(data.remaining_credits)
        window.dispatchEvent(new CustomEvent('credits-updated', { detail: { remaining: data.remaining_credits } }))

        if (pageAds.length < 100) break
      }

      if (allAds.length === 0) {
        setError('No ads found for these filters. Try broadening your search.')
        setStep('configure')
        return
      }

      setProgress(p => ({ ...p, stage: 'computing', adsCollected: allAds.length }))
      // Small tick so the UI updates before the sync computation blocks
      await new Promise(r => setTimeout(r, 50))

      const computed = computeTrendStats(allAds)
      setAds(allAds)
      setStats(computed)
      setStep('dashboard')
    } catch {
      setError('Network error. Please try again.')
      setStep('configure')
    }
  }

  // ── AI insights ─────────────────────────────────────────────────────────────

  async function generateAiInsights() {
    if (!stats) return
    setLoadingAi(true)
    setAiOutput('')

    const niche  = NICHES.find(n => n.id === config.niche_id)
    const top15  = [...ads].sort((a, b) => b.days_active - a.days_active).slice(0, 15).map(slimAd)
    const filterParts = [
      config.query           ? `keyword: "${config.query}"` : null,
      niche?.label           ? `niche: ${niche.label}`      : null,
      config.performance_scores.length ? `performance: ${config.performance_scores.join(', ')}` : null,
      config.ad_formats.length         ? `format: ${config.ad_formats.join(', ')}`              : null,
      config.platform        ? `platform: ${config.platform}` : null,
      config.location        ? `country: ${config.location}`  : null,
      config.language        ? `language: ${config.language}` : null,
    ].filter(Boolean)

    try {
      const res = await fetch('/api/ai/trends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          niche_label:     niche?.label ?? config.query ?? 'General',
          date_range:      { start: config.start_date || 'all time', end: config.end_date || 'present' },
          platform_filter: config.platform || 'all',
          filters_applied: filterParts.join(' · '),
          stats,
          top_performers:  top15,
        }),
      })

      if (!res.ok) { setLoadingAi(false); return }

      const reader  = res.body!.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        setAiOutput(prev => prev + decoder.decode(value, { stream: true }))
      }
    } finally {
      setLoadingAi(false)
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function chip(label: string, active: boolean, onClick: () => void) {
    return (
      <button
        key={label}
        onClick={onClick}
        className={`text-xs px-3 py-1.5 rounded-full border capitalize transition-all ${
          active
            ? 'bg-accent/15 border-accent/40 text-accent'
            : 'border-app-border text-zinc-500 hover:text-zinc-300 hover:border-app-border-strong'
        }`}
      >
        {label}
      </button>
    )
  }

  const niche = NICHES.find(n => n.id === config.niche_id)

  // Summary line for dashboard header
  const summaryParts = [
    config.query ? `"${config.query}"` : null,
    niche?.label ?? null,
    config.performance_scores.length !== PERF_OPTIONS.length && config.performance_scores.length > 0
      ? config.performance_scores.join(' + ')
      : null,
    config.platform || null,
    config.location || null,
  ].filter(Boolean)

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen p-6 lg:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-1">Trend Radar</h1>
          <p className="text-sm text-zinc-500">
            Analyze 100–300 ads to surface format trends, CTA patterns, and AI-generated insights.
          </p>
        </div>

        {/* ── Configure ── */}
        {step === 'configure' && (
          <div className="bg-surface-card border border-app-border rounded-2xl p-6 max-w-2xl">
            {error && (
              <div className="mb-5 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
                {error}
              </div>
            )}

            <div className="space-y-5">

              {/* Keyword */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  Keyword Search
                  <span className="ml-1.5 font-normal text-zinc-600">(optional if niche selected)</span>
                </label>
                <input
                  type="text"
                  value={config.query}
                  onChange={e => setConfig(c => ({ ...c, query: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter' && (config.query || config.niche_id)) fetchData() }}
                  placeholder='e.g. "pre-workout" or "creatine"'
                  className="w-full bg-surface-raised border border-app-border rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-accent"
                />
              </div>

              {/* Niche + Platform */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                    Niche
                    <span className="ml-1.5 font-normal text-zinc-600">(optional if keyword entered)</span>
                  </label>
                  <select
                    value={config.niche_id}
                    onChange={e => setConfig(c => ({ ...c, niche_id: e.target.value }))}
                    className="w-full bg-surface-raised border border-app-border rounded-lg px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-accent"
                  >
                    <option value="">All niches…</option>
                    {NICHES.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">Platform</label>
                  <select
                    value={config.platform}
                    onChange={e => setConfig(c => ({ ...c, platform: e.target.value }))}
                    className="w-full bg-surface-raised border border-app-border rounded-lg px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-accent"
                  >
                    <option value="">All platforms</option>
                    {PLATFORMS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Performance */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2">
                  Performance Tier
                  <span className="ml-1.5 font-normal text-zinc-600">— select multiple to compare</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {PERF_OPTIONS.map(p =>
                    chip(p.label, config.performance_scores.includes(p.value), () =>
                      setConfig(c => ({ ...c, performance_scores: toggleArr(c.performance_scores, p.value) }))
                    )
                  )}
                </div>
              </div>

              {/* Format */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2">
                  Ad Format
                  <span className="ml-1.5 font-normal text-zinc-600">(leave blank for all)</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {AD_FORMATS.map(f =>
                    chip(f.label, config.ad_formats.includes(f.value), () =>
                      setConfig(c => ({ ...c, ad_formats: toggleArr(c.ad_formats, f.value) }))
                    )
                  )}
                </div>
              </div>

              {/* Country + Language */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">Country Code</label>
                  <input
                    type="text"
                    value={config.location}
                    onChange={e => setConfig(c => ({ ...c, location: e.target.value }))}
                    placeholder="US, GB, AU…"
                    className="w-full bg-surface-raised border border-app-border rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">Language Code</label>
                  <input
                    type="text"
                    value={config.language}
                    onChange={e => setConfig(c => ({ ...c, language: e.target.value }))}
                    placeholder="EN, ES, FR…"
                    className="w-full bg-surface-raised border border-app-border rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-accent"
                  />
                </div>
              </div>

              {/* Date range + Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">Date Range</label>
                  <div className="space-y-1.5">
                    <input
                      type="date"
                      value={config.start_date}
                      onChange={e => setConfig(c => ({ ...c, start_date: e.target.value }))}
                      className="w-full bg-surface-raised border border-app-border rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-accent"
                    />
                    <input
                      type="date"
                      value={config.end_date}
                      onChange={e => setConfig(c => ({ ...c, end_date: e.target.value }))}
                      className="w-full bg-surface-raised border border-app-border rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-accent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">Ad Status</label>
                  <div className="space-y-1.5">
                    {[
                      { value: '',         label: 'Active + Inactive' },
                      { value: 'active',   label: 'Active only' },
                      { value: 'inactive', label: 'Inactive only' },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setConfig(c => ({ ...c, status: opt.value }))}
                        className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition-all ${
                          config.status === opt.value
                            ? 'bg-accent/10 border-accent/30 text-white'
                            : 'border-app-border text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Number of ads */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2">Ads to Analyze</label>
                <div className="flex gap-2">
                  {COUNT_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setConfig(c => ({ ...c, count: opt.value }))}
                      className={`flex-1 flex flex-col items-center py-2.5 rounded-lg border text-sm transition-all ${
                        config.count === opt.value
                          ? 'bg-accent/10 border-accent/30 text-white'
                          : 'border-app-border text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <span className="font-medium">{opt.label.split(' ')[0]}</span>
                      <span className="text-[10px] text-zinc-600 mt-0.5">{opt.credits}</span>
                    </button>
                  ))}
                </div>
              </div>

              {remainingCredits !== null && (
                <p className="text-xs text-zinc-600">
                  {remainingCredits.toLocaleString()} credits remaining
                </p>
              )}
            </div>

            <button
              onClick={fetchData}
              disabled={!config.niche_id && !config.query}
              className="mt-6 w-full py-3 bg-accent hover:bg-accent-hover text-white font-medium rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Run Trend Radar →
            </button>
          </div>
        )}

        {/* ── Fetching (progress display) ── */}
        {step === 'fetching' && <ProgressDisplay progress={progress} />}

        {/* ── Dashboard ── */}
        {step === 'dashboard' && stats && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs text-zinc-500 mb-0.5 flex flex-wrap gap-x-2">
                  {summaryParts.length > 0 && (
                    <span>{summaryParts.join(' · ')}</span>
                  )}
                  <span>·</span>
                  <span>{stats.total_ads} ads</span>
                  {remainingCredits !== null && <><span>·</span><span>{remainingCredits.toLocaleString()} credits remaining</span></>}
                </div>
                <h2 className="text-lg font-semibold text-white">Trend Dashboard</h2>
              </div>
              <button
                onClick={() => { setStep('configure'); setStats(null); setAds([]); setAiOutput('') }}
                className="shrink-0 text-sm text-zinc-500 hover:text-zinc-300 border border-app-border px-3 py-1.5 rounded-lg transition-colors"
              >
                New Analysis
              </button>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">

              <StatCard title="Overview">
                <div className="space-y-3">
                  {[
                    { label: 'Total ads analyzed',  value: stats.total_ads.toString() },
                    { label: 'Avg days active',      value: `${stats.overall_avg_days_active}d` },
                    { label: 'Top format',           value: stats.format_distribution[0]?.format ?? '—' },
                    { label: 'Top CTA',              value: stats.cta_frequency[0]?.cta ?? '—' },
                  ].map(row => (
                    <div key={row.label} className="flex items-center justify-between">
                      <span className="text-xs text-zinc-500">{row.label}</span>
                      <span className="text-xs font-semibold text-zinc-200 capitalize">{row.value}</span>
                    </div>
                  ))}
                </div>
              </StatCard>

              <StatCard title="Format Distribution">
                <div className="space-y-3">
                  {stats.format_distribution.slice(0, 5).map(f => (
                    <BarRow
                      key={f.format}
                      label={`${f.format} (${f.pct}%)`}
                      value={f.count}
                      max={stats.format_distribution[0].count}
                      extra={`avg ${f.avg_days_active}d`}
                    />
                  ))}
                </div>
              </StatCard>

              <StatCard title="Performance Distribution">
                <div className="space-y-3">
                  {stats.performance_distribution.map(p => (
                    <BarRow
                      key={p.score}
                      label={`${p.score} (${p.pct}%)`}
                      value={p.count}
                      max={stats.total_ads}
                    />
                  ))}
                </div>
              </StatCard>

              <StatCard title="CTA Frequency">
                <div className="space-y-2.5">
                  {stats.cta_frequency.slice(0, 7).map(c => (
                    <BarRow
                      key={c.cta}
                      label={`${c.cta.replace(/_/g, ' ')} (${c.pct}%)`}
                      value={c.count}
                      max={stats.cta_frequency[0].count}
                      extra={`avg ${c.avg_days_active}d`}
                    />
                  ))}
                </div>
              </StatCard>

              <StatCard title="Top Brands">
                <div className="space-y-2">
                  {stats.top_brands.slice(0, 7).map((b, i) => (
                    <div key={b.name} className="flex items-center justify-between">
                      <span className="text-xs text-zinc-400 truncate max-w-[130px]">
                        <span className="text-zinc-600 mr-2">{i + 1}.</span>{b.name}
                      </span>
                      <div className="text-right shrink-0">
                        <span className="text-xs text-zinc-400">{b.count} ads</span>
                        <span className="text-xs text-zinc-600 ml-1.5">·</span>
                        <span className="text-xs text-zinc-600 ml-1.5">{b.avg_days_active}d avg</span>
                      </div>
                    </div>
                  ))}
                </div>
              </StatCard>

              <StatCard title="Platform Breakdown">
                <div className="space-y-3">
                  {stats.platform_distribution.map(p => (
                    <BarRow
                      key={p.platform}
                      label={p.platform}
                      value={p.count}
                      max={stats.platform_distribution[0].count}
                    />
                  ))}
                </div>
              </StatCard>

              <StatCard title="Monthly Distribution">
                <div className="space-y-3">
                  {stats.monthly_distribution.length === 0 ? (
                    <p className="text-xs text-zinc-600 py-2">
                      No start date data available. Try filtering by a date range to see monthly breakdowns.
                    </p>
                  ) : (
                    stats.monthly_distribution.map(m => (
                      <BarRow
                        key={m.month}
                        label={fmtMonth(m.month)}
                        value={m.count}
                        max={Math.max(...stats.monthly_distribution.map(x => x.count))}
                        extra={`avg ${m.avg_days_active}d`}
                      />
                    ))
                  )}
                </div>
              </StatCard>

            </div>

            {/* AI Insights */}
            <div className="bg-surface-card border border-app-border rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-app-border">
                <div>
                  <div className="text-sm font-semibold text-white">AI Trend Analysis</div>
                  <div className="text-xs text-zinc-500">claude-sonnet-4-6 · extended thinking</div>
                </div>
                {!aiOutput && !loadingAi && (
                  <button
                    onClick={generateAiInsights}
                    className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Generate AI Insights
                  </button>
                )}
                {(aiOutput || loadingAi) && (
                  <button
                    onClick={() => aiOutput && navigator.clipboard.writeText(aiOutput)}
                    disabled={!aiOutput}
                    className="px-4 py-2 text-sm text-zinc-400 hover:text-white border border-app-border rounded-lg transition-colors disabled:opacity-40"
                  >
                    Copy
                  </button>
                )}
              </div>

              <div className="p-6">
                {loadingAi && !aiOutput && (
                  <div className="flex items-center gap-3 text-zinc-500">
                    <LoadingSpinner size="sm" />
                    <div>
                      <p className="text-sm">Claude is analyzing trends…</p>
                      <p className="text-xs text-zinc-600 mt-0.5">Extended thinking in progress — typically 60–90 seconds before text appears.</p>
                    </div>
                  </div>
                )}
                {loadingAi && aiOutput && (
                  <div className="flex items-center gap-2 mb-4 text-xs text-zinc-500">
                    <LoadingSpinner size="sm" />
                    <span>Writing…</span>
                  </div>
                )}
                {aiOutput && <StreamingOutput content={aiOutput} autoScroll={loadingAi} />}
                {!aiOutput && !loadingAi && (
                  <p className="text-sm text-zinc-600">
                    Click "Generate AI Insights" to have Claude analyze the statistics above and surface actionable opportunities.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
