'use client'

import { useState } from 'react'
import { NICHES, PLATFORMS } from '@/lib/constants'
import type { Ad, TrendStats } from '@/lib/types'
import { slimAd, computeTrendStats, cacheCredits } from '@/lib/utils'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import StreamingOutput from '@/components/ui/StreamingOutput'

type Step = 'configure' | 'fetching' | 'dashboard'

interface Config {
  niche_id: string
  platform: string
  start_date: string
  end_date: string
  count: number
  status: string
}

const COUNT_OPTIONS = [
  { value: 100, label: '100 ads', credits: '~1' },
  { value: 200, label: '200 ads', credits: '~2' },
  { value: 300, label: '300 ads', credits: '~3' },
]

function StatCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface-card border border-app-border rounded-xl p-5">
      <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">{title}</h3>
      {children}
    </div>
  )
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

export default function TrendsPage() {
  const [step, setStep] = useState<Step>('configure')
  const [config, setConfig] = useState<Config>({
    niche_id: '',
    platform: '',
    start_date: '',
    end_date: '',
    count: 100,
    status: '',
  })
  const [ads, setAds] = useState<Ad[]>([])
  const [stats, setStats] = useState<TrendStats | null>(null)
  const [fetchProgress, setFetchProgress] = useState('')
  const [aiOutput, setAiOutput] = useState('')
  const [loadingAi, setLoadingAi] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [remainingCredits, setRemainingCredits] = useState<number | null>(null)

  async function fetchData() {
    if (!config.niche_id) return
    setStep('fetching')
    setError(null)
    setAds([])
    setStats(null)
    setAiOutput('')

    const pagesNeeded = Math.ceil(config.count / 100)
    const allAds: Ad[] = []

    try {
      for (let page = 1; page <= pagesNeeded; page++) {
        setFetchProgress(`Fetching page ${page} of ${pagesNeeded}...`)
        const params = new URLSearchParams({
          niche: config.niche_id,
          sort_column: 'days_active',
          sort_direction: 'desc',
          per_page: '100',
          page: String(page),
        })
        if (config.platform) params.set('platform', config.platform)
        if (config.start_date) params.set('start-date', config.start_date)
        if (config.end_date) params.set('end-date', config.end_date)
        if (config.status) params.set('status', config.status)

        const res = await fetch(`/api/gethookd/explore?${params}`)
        const data = await res.json()

        if (!res.ok) {
          setError(data.message ?? 'Failed to fetch ads')
          setStep('configure')
          return
        }

        const pageAds: Ad[] = data.data ?? []
        allAds.push(...pageAds)

        cacheCredits(data.remaining_credits)
        setRemainingCredits(data.remaining_credits)
        window.dispatchEvent(new CustomEvent('credits-updated', { detail: { remaining: data.remaining_credits } }))

        if (pageAds.length < 100) break // last page
      }

      if (allAds.length === 0) {
        setError('No ads found for this configuration.')
        setStep('configure')
        return
      }

      setFetchProgress(`Computing statistics for ${allAds.length} ads...`)
      const computed = computeTrendStats(allAds)
      setAds(allAds)
      setStats(computed)
      setStep('dashboard')
    } catch {
      setError('Network error. Please try again.')
      setStep('configure')
    }
  }

  async function generateAiInsights() {
    if (!stats) return
    setLoadingAi(true)
    setAiOutput('')

    const niche = NICHES.find(n => n.id === config.niche_id)
    const top15 = ads
      .sort((a, b) => b.days_active - a.days_active)
      .slice(0, 15)
      .map(slimAd)

    try {
      const res = await fetch('/api/ai/trends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          niche_label: niche?.label ?? config.niche_id,
          date_range: {
            start: config.start_date || 'all time',
            end: config.end_date || 'present',
          },
          platform_filter: config.platform || 'all',
          stats,
          top_performers: top15,
        }),
      })

      if (!res.ok) {
        setLoadingAi(false)
        return
      }

      const reader = res.body!.getReader()
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

  const niche = NICHES.find(n => n.id === config.niche_id)

  return (
    <div className="min-h-screen p-6 lg:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-1">Trend Radar</h1>
          <p className="text-sm text-zinc-500">
            Analyze 100–300 ads over a date range to surface format trends, CTA patterns, and AI-generated insights.
          </p>
        </div>

        {/* Configure */}
        {step === 'configure' && (
          <div className="bg-surface-card border border-app-border rounded-2xl p-6 max-w-lg">
            {error && (
              <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
                {error}
              </div>
            )}

            <div className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Niche <span className="text-red-400">*</span></label>
                <select
                  value={config.niche_id}
                  onChange={e => setConfig(c => ({ ...c, niche_id: e.target.value }))}
                  className="w-full bg-surface-raised border border-app-border rounded-lg px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-accent"
                >
                  <option value="">Select a niche...</option>
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

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">Date Range (optional)</label>
                <div className="flex gap-2">
                  <input type="date" value={config.start_date} onChange={e => setConfig(c => ({ ...c, start_date: e.target.value }))} className="flex-1 bg-surface-raised border border-app-border rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-accent" />
                  <input type="date" value={config.end_date} onChange={e => setConfig(c => ({ ...c, end_date: e.target.value }))} className="flex-1 bg-surface-raised border border-app-border rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-accent" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2">Number of Ads</label>
                <div className="space-y-1.5">
                  {COUNT_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setConfig(c => ({ ...c, count: opt.value }))}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-all ${config.count === opt.value ? 'bg-accent/10 border-accent/30 text-white' : 'border-app-border text-zinc-400 hover:text-zinc-200'}`}
                    >
                      <span>{opt.label}</span>
                      <span className="text-xs text-zinc-600">{opt.credits} credits</span>
                    </button>
                  ))}
                </div>
              </div>

              {remainingCredits !== null && (
                <p className="text-xs text-zinc-600">
                  You have {remainingCredits.toLocaleString()} credits remaining.
                </p>
              )}
            </div>

            <button
              onClick={fetchData}
              disabled={!config.niche_id}
              className="mt-6 w-full py-3 bg-accent hover:bg-accent-hover text-white font-medium rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Run Trend Radar
            </button>
          </div>
        )}

        {/* Fetching */}
        {step === 'fetching' && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <LoadingSpinner size="lg" />
            <p className="text-sm text-zinc-400">{fetchProgress}</p>
          </div>
        )}

        {/* Dashboard */}
        {step === 'dashboard' && stats && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-zinc-500 mb-0.5">
                  {niche?.label} · {config.platform || 'All platforms'} · {stats.total_ads} ads analyzed
                  {remainingCredits !== null && ` · ${remainingCredits.toLocaleString()} credits remaining`}
                </div>
                <h2 className="text-lg font-semibold text-white">Trend Dashboard</h2>
              </div>
              <button
                onClick={() => { setStep('configure'); setStats(null); setAds([]); setAiOutput('') }}
                className="text-sm text-zinc-500 hover:text-zinc-300 border border-app-border px-3 py-1.5 rounded-lg transition-colors"
              >
                New Analysis
              </button>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {/* Overview */}
              <StatCard title="Overview">
                <div className="space-y-3">
                  {[
                    { label: 'Total ads analyzed', value: stats.total_ads.toString() },
                    { label: 'Avg days active', value: `${stats.overall_avg_days_active}d` },
                    { label: 'Top format', value: stats.format_distribution[0]?.format ?? '—' },
                    { label: 'Top CTA', value: stats.cta_frequency[0]?.cta ?? '—' },
                  ].map(row => (
                    <div key={row.label} className="flex items-center justify-between">
                      <span className="text-xs text-zinc-500">{row.label}</span>
                      <span className="text-xs font-semibold text-zinc-200 capitalize">{row.value}</span>
                    </div>
                  ))}
                </div>
              </StatCard>

              {/* Format distribution */}
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

              {/* Performance distribution */}
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

              {/* CTA Frequency */}
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

              {/* Top Brands */}
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

              {/* Platform distribution */}
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
                {aiOutput && (
                  <button
                    onClick={() => navigator.clipboard.writeText(aiOutput)}
                    className="px-4 py-2 text-sm text-zinc-400 hover:text-white border border-app-border rounded-lg transition-colors"
                  >
                    Copy
                  </button>
                )}
              </div>

              <div className="p-6">
                {loadingAi && !aiOutput && (
                  <div className="flex items-center gap-3 text-zinc-500">
                    <LoadingSpinner size="sm" />
                    <span className="text-sm">Claude is analyzing trends...</span>
                  </div>
                )}
                {aiOutput && <StreamingOutput content={aiOutput} />}
                {!aiOutput && !loadingAi && (
                  <p className="text-sm text-zinc-600">
                    Click "Generate AI Insights" to have Claude analyze the statistics above and identify actionable opportunities.
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
