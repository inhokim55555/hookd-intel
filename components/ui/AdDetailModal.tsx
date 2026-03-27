'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { Ad } from '@/lib/types'
import { formatDate, getFormatLabel, getPlatformAbbr, formatNumber } from '@/lib/utils'
import { DNA_SOURCE_AD_KEY } from '@/lib/constants'
import PerformanceBadge from './PerformanceBadge'

interface Props {
  ad: Ad
  onClose: () => void
}

export default function AdDetailModal({ ad, onClose }: Props) {
  const router = useRouter()
  const overlayRef = useRef<HTMLDivElement>(null)
  const media = ad.media?.[0]
  const isVideo = media?.type === 'video' || ad.display_format === 'video'

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [onClose])

  function openInDna() {
    sessionStorage.setItem(DNA_SOURCE_AD_KEY, JSON.stringify(ad))
    onClose()
    router.push('/dna')
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start justify-center overflow-y-auto py-8 px-4"
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className="bg-surface-raised border border-app-border rounded-2xl w-full max-w-3xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-app-border">
          <div className="flex items-center gap-3">
            {ad.brand.logo_url && (
              <img src={ad.brand.logo_url} alt={ad.brand.name} className="w-8 h-8 rounded-full bg-white object-contain" />
            )}
            <div>
              <div className="text-sm font-semibold text-white">{ad.brand.name}</div>
              <div className="text-xs text-zinc-500">
                {getPlatformAbbr(ad.platform)} · {getFormatLabel(ad.display_format)}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <PerformanceBadge score={ad.performance_score_title} size="md" />
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-surface-hover transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Media */}
        <div className="bg-black aspect-video w-full overflow-hidden">
          {isVideo && media?.url ? (
            <video
              src={media.url}
              controls
              autoPlay
              muted
              loop
              className="w-full h-full object-contain"
              poster={media.thumbnail_url ?? undefined}
            />
          ) : media?.url ? (
            <img
              src={media.resized_url ?? media.url}
              alt={ad.title ?? ad.brand.name}
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-700 text-sm">
              No media available
            </div>
          )}
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-4 divide-x divide-app-border border-b border-app-border">
          {[
            { label: 'Days Active', value: ad.days_active.toString() },
            { label: 'Times Used', value: ad.used_count.toString() },
            { label: 'Spend Range', value: ad.ad_spend_range_score_title ?? '—' },
            {
              label: 'EU Reach',
              value: ad.eu_total_reach ? formatNumber(ad.eu_total_reach) : '—',
            },
          ].map(({ label, value }) => (
            <div key={label} className="px-4 py-3 text-center">
              <div className="text-xs text-zinc-500 mb-0.5">{label}</div>
              <div className="text-sm font-semibold text-white">{value}</div>
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Copy */}
          <div className="space-y-3">
            {ad.title && (
              <div>
                <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1.5">Headline</div>
                <p className="text-sm text-zinc-100 leading-relaxed">{ad.title}</p>
              </div>
            )}
            {ad.body && (
              <div>
                <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1.5">Body Copy</div>
                <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{ad.body}</p>
              </div>
            )}
            {ad.link_description && (
              <div>
                <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1.5">Link Description</div>
                <p className="text-sm text-zinc-400">{ad.link_description}</p>
              </div>
            )}
          </div>

          {/* Meta grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'CTA', value: ad.cta_text ?? '—' },
              { label: 'Platform', value: ad.platform },
              { label: 'Format', value: getFormatLabel(ad.display_format) },
              { label: 'Start Date', value: formatDate(ad.start_date) },
              { label: 'End Date', value: ad.end_date ? formatDate(ad.end_date) : 'Still active' },
              {
                label: 'Audience',
                value: [
                  ad.gender_audience,
                  ad.age_audience_min && ad.age_audience_max
                    ? `${ad.age_audience_min}–${ad.age_audience_max}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(', ') || '—',
              },
            ].map(({ label, value }) => (
              <div key={label} className="bg-surface-card border border-app-border rounded-lg px-3 py-2.5">
                <div className="text-xs text-zinc-500 mb-0.5">{label}</div>
                <div className="text-xs font-medium text-zinc-200 capitalize">{value}</div>
              </div>
            ))}
          </div>

          {/* Carousel cards */}
          {ad.ad_cards && ad.ad_cards.length > 0 && (
            <div>
              <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">
                Carousel Cards ({ad.ad_cards.length})
              </div>
              <div className="space-y-2">
                {ad.ad_cards.map((card, i) => (
                  <div key={i} className="bg-surface-card border border-app-border rounded-lg p-3">
                    <div className="text-xs font-medium text-zinc-300 mb-1">Card {i + 1}</div>
                    {card.title && <p className="text-xs text-zinc-400">{card.title}</p>}
                    {card.body && <p className="text-xs text-zinc-500 mt-1">{card.body}</p>}
                    {card.cta_text && (
                      <span className="inline-block text-[10px] bg-accent/10 text-accent border border-accent/20 px-1.5 py-0.5 rounded mt-1">
                        {card.cta_text}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-app-border flex items-center justify-between gap-3">
          <a
            href={ad.share_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-zinc-500 hover:text-zinc-300 underline underline-offset-2"
          >
            View on Gethookd →
          </a>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-zinc-400 hover:text-white rounded-lg border border-app-border hover:border-app-border-strong transition-colors"
            >
              Close
            </button>
            <button
              onClick={openInDna}
              className="px-4 py-2 text-sm font-medium text-white bg-accent hover:bg-accent-hover rounded-lg transition-colors"
            >
              Open in DNA Multiplier
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
