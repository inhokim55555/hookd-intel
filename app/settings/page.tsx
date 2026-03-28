'use client'

import { useState, useEffect } from 'react'
import { BRAND_CONTEXT_KEY, NICHES } from '@/lib/constants'
import type { BrandContext } from '@/lib/types'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

const EMPTY_CONTEXT: BrandContext = {
  brand_name: '',
  product_description: '',
  target_audience: '',
  brand_voice: '',
  niche_id: '',
  niche_label: '',
}

type Status = 'idle' | 'loading' | 'ok' | 'error'
type SaveState = 'idle' | 'saving' | 'saved'

function StatusBadge({ status, label }: { status: Status; label: string }) {
  return (
    <div className="flex items-center gap-3">
      {status === 'loading' && <LoadingSpinner size="sm" />}
      {status === 'ok' && (
        <div className="w-5 h-5 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      )}
      {status === 'error' && (
        <div className="w-5 h-5 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="3">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </div>
      )}
      {status === 'idle' && (
        <div className="w-5 h-5 rounded-full border border-app-border" />
      )}
      <span className="text-sm text-zinc-300">{label}</span>
    </div>
  )
}

export default function SettingsPage() {
  const [brand, setBrand] = useState<BrandContext>(EMPTY_CONTEXT)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [dbAvailable, setDbAvailable] = useState(false)
  const [gethookdStatus, setGethookdStatus] = useState<Status>('idle')
  const [anthropicStatus, setAnthropicStatus] = useState<Status>('idle')
  const [geminiStatus, setGeminiStatus] = useState<Status>('idle')
  const [creditsInfo, setCreditsInfo] = useState<{ remaining: number } | null>(null)

  useEffect(() => {
    // Load brand context — try DB first, fall back to localStorage
    fetch('/api/settings/brand-context')
      .then(r => r.json())
      .then((data: BrandContext | null) => {
        if (data && data.brand_name !== undefined) {
          setDbAvailable(true)
          setBrand(data)
          // Keep localStorage in sync
          localStorage.setItem(BRAND_CONTEXT_KEY, JSON.stringify(data))
        } else {
          // DB not configured or empty — load from localStorage
          const stored = localStorage.getItem(BRAND_CONTEXT_KEY)
          if (stored) {
            try { setBrand(JSON.parse(stored)) } catch {}
          }
        }
      })
      .catch(() => {
        const stored = localStorage.getItem(BRAND_CONTEXT_KEY)
        if (stored) {
          try { setBrand(JSON.parse(stored)) } catch {}
        }
      })

    checkConnections()
  }, [])

  async function checkConnections() {
    setGethookdStatus('loading')
    setAnthropicStatus('loading')
    setGeminiStatus('loading')

    try {
      const res = await fetch('/api/credits')
      const data = await res.json()
      if (data.ok) {
        setGethookdStatus('ok')
        setCreditsInfo({ remaining: data.remaining_credits })
        localStorage.setItem('hookd_remaining_credits', String(data.remaining_credits))
        window.dispatchEvent(new CustomEvent('credits-updated', { detail: { remaining: data.remaining_credits } }))
      } else {
        setGethookdStatus('error')
      }
    } catch {
      setGethookdStatus('error')
    }

    try {
      const res = await fetch('/api/ai/status')
      const data = await res.json()
      setAnthropicStatus(data.ok ? 'ok' : 'error')
    } catch {
      setAnthropicStatus('error')
    }

    try {
      const res = await fetch('/api/ai/gemini-status')
      const data = await res.json()
      setGeminiStatus(data.ok ? 'ok' : 'error')
    } catch {
      setGeminiStatus('error')
    }
  }

  async function save() {
    setSaveState('saving')

    // Always write to localStorage as an offline fallback
    localStorage.setItem(BRAND_CONTEXT_KEY, JSON.stringify(brand))

    // Persist to database if configured
    try {
      await fetch('/api/settings/brand-context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(brand),
      })
      setDbAvailable(true)
    } catch {
      // DB unavailable — localStorage is already saved above
    }

    setSaveState('saved')
    setTimeout(() => setSaveState('idle'), 2000)
  }

  function updateNiche(id: string) {
    const niche = NICHES.find(n => n.id === id)
    setBrand(b => ({ ...b, niche_id: id, niche_label: niche?.label ?? '' }))
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">Settings</h1>
        <p className="text-sm text-zinc-500">Configure your API connections and brand context.</p>
      </div>

      {/* Connection Status */}
      <div className="bg-surface-card border border-app-border rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-white">API Connections</h2>
          <button
            onClick={checkConnections}
            className="text-xs text-zinc-500 hover:text-zinc-300 underline underline-offset-2 transition-colors"
          >
            Refresh
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <StatusBadge
              status={gethookdStatus}
              label={
                gethookdStatus === 'ok'
                  ? `Gethookd API · ${creditsInfo?.remaining.toLocaleString() ?? '—'} credits remaining`
                  : gethookdStatus === 'error'
                    ? 'Gethookd API · Not connected — check GETHOOKD_API_KEY'
                    : gethookdStatus === 'loading'
                      ? 'Gethookd API · Checking...'
                      : 'Gethookd API'
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <StatusBadge
              status={geminiStatus}
              label={
                geminiStatus === 'ok'
                  ? 'Gemini API · gemini-2.5-flash-preview · video analysis enabled'
                  : geminiStatus === 'error'
                    ? 'Gemini API · Not connected — check GEMINI_API_KEY'
                    : geminiStatus === 'loading'
                      ? 'Gemini API · Checking...'
                      : 'Gemini API'
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <StatusBadge
              status={anthropicStatus}
              label={
                anthropicStatus === 'ok'
                  ? 'Anthropic API · claude-sonnet-4-6 with extended thinking'
                  : anthropicStatus === 'error'
                    ? 'Anthropic API · Not connected — check ANTHROPIC_API_KEY'
                    : anthropicStatus === 'loading'
                      ? 'Anthropic API · Checking...'
                      : 'Anthropic API'
              }
            />
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-app-border">
          <p className="text-xs text-zinc-600">
            On Replit: add{' '}
            <code className="text-zinc-500 bg-surface-raised px-1 py-0.5 rounded">GETHOOKD_API_KEY</code>,{' '}
            <code className="text-zinc-500 bg-surface-raised px-1 py-0.5 rounded">ANTHROPIC_API_KEY</code>, and{' '}
            <code className="text-zinc-500 bg-surface-raised px-1 py-0.5 rounded">GEMINI_API_KEY</code>{' '}
            in the <strong className="text-zinc-500">Secrets</strong> tab (padlock icon).
            For local dev, copy{' '}
            <code className="text-zinc-500 bg-surface-raised px-1 py-0.5 rounded">.env.example</code> to{' '}
            <code className="text-zinc-500 bg-surface-raised px-1 py-0.5 rounded">.env.local</code>.
          </p>
        </div>
      </div>

      {/* Brand Context */}
      <div className="bg-surface-card border border-app-border rounded-xl p-6">
        <div className="mb-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white mb-1">Brand Context</h2>
              <p className="text-xs text-zinc-500">
                Injected into all AI prompts to personalize Brief Generator and DNA Multiplier output.
              </p>
            </div>
            {dbAvailable && (
              <span className="text-[10px] text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full shrink-0 ml-4">
                Synced to DB
              </span>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Brand Name</label>
            <input
              type="text"
              value={brand.brand_name}
              onChange={e => setBrand(b => ({ ...b, brand_name: e.target.value }))}
              placeholder="e.g., Bloom Nutrition"
              className="w-full bg-surface-raised border border-app-border rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Primary Niche</label>
            <select
              value={brand.niche_id}
              onChange={e => updateNiche(e.target.value)}
              className="w-full bg-surface-raised border border-app-border rounded-lg px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-accent"
            >
              <option value="">Select a niche...</option>
              {NICHES.map(n => (
                <option key={n.id} value={n.id}>{n.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Product / Service Description</label>
            <textarea
              value={brand.product_description}
              onChange={e => setBrand(b => ({ ...b, product_description: e.target.value }))}
              placeholder="What you sell, key differentiators, price point..."
              rows={3}
              className="w-full bg-surface-raised border border-app-border rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-accent resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Target Audience</label>
            <textarea
              value={brand.target_audience}
              onChange={e => setBrand(b => ({ ...b, target_audience: e.target.value }))}
              placeholder="Who buys it, demographics, psychographics, core pain points..."
              rows={2}
              className="w-full bg-surface-raised border border-app-border rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-accent resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Brand Voice</label>
            <input
              type="text"
              value={brand.brand_voice}
              onChange={e => setBrand(b => ({ ...b, brand_voice: e.target.value }))}
              placeholder="e.g., Bold, conversational, science-backed, no-nonsense"
              className="w-full bg-surface-raised border border-app-border rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={save}
            disabled={saveState === 'saving'}
            className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
          >
            {saveState === 'saving' ? 'Saving...' : 'Save Brand Context'}
          </button>
          {saveState === 'saved' && (
            <span className="text-sm text-emerald-400 flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Saved
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
