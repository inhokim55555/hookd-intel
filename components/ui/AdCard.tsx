'use client'

import { useRouter } from 'next/navigation'
import { useState, useRef } from 'react'
import type { Ad } from '@/lib/types'
import { truncate, getPlatformAbbr, getFormatLabel } from '@/lib/utils'
import { DNA_SOURCE_AD_KEY } from '@/lib/constants'
import PerformanceBadge from './PerformanceBadge'

interface Props {
  ad: Ad
  onViewDetails: (ad: Ad) => void
}

export default function AdCard({ ad, onViewDetails }: Props) {
  const router = useRouter()
  const [playing, setPlaying] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  const media = ad.media?.[0]
  const thumbnail = media?.thumbnail_url ?? media?.url ?? null
  const videoUrl = media?.type === 'video' ? media.url : null
  const isVideo = ad.display_format === 'video' || media?.type === 'video'
  const videoLength = media?.video_length

  function handlePlayClick(e: React.MouseEvent) {
    e.stopPropagation()
    if (videoUrl) setPlaying(true)
  }

  function handleStop(e: React.MouseEvent) {
    e.stopPropagation()
    setPlaying(false)
    videoRef.current?.pause()
  }

  function openInDna() {
    sessionStorage.setItem(DNA_SOURCE_AD_KEY, JSON.stringify(ad))
    router.push('/dna')
  }

  return (
    <div className="bg-surface-card border border-app-border rounded-xl overflow-hidden hover:border-app-border-strong hover:bg-surface-hover transition-all duration-150 flex flex-col group">
      {/* Thumbnail / Video */}
      <div className="relative aspect-video bg-black overflow-hidden">
        {/* Inline video player — shown when playing */}
        {isVideo && videoUrl && (
          <video
            ref={videoRef}
            src={videoUrl}
            poster={thumbnail ?? undefined}
            controls
            autoPlay
            loop
            playsInline
            className={`w-full h-full object-contain transition-opacity duration-150 ${playing ? 'opacity-100' : 'opacity-0 absolute inset-0'}`}
            onClick={e => e.stopPropagation()}
          />
        )}

        {/* Thumbnail — hidden when playing */}
        {!playing && (
          <>
            {thumbnail ? (
              <img
                src={thumbnail}
                alt={ad.title ?? ad.brand.name}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-700 bg-surface-raised">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
              </div>
            )}

            {/* Play button overlay — video ads only */}
            {isVideo && videoUrl && (
              <button
                onClick={handlePlayClick}
                className="absolute inset-0 flex items-center justify-center group/play"
                aria-label="Play video"
              >
                <div className="flex flex-col items-center gap-1.5">
                  <div className="w-11 h-11 rounded-full bg-black/70 backdrop-blur-sm border border-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 group/play:opacity-100 transition-all duration-150 hover:bg-black/90 hover:scale-105">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                  </div>
                  {videoLength ? (
                    <span className="text-[10px] text-white/70 bg-black/50 px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                      {videoLength}s
                    </span>
                  ) : null}
                </div>
              </button>
            )}
          </>
        )}

        {/* Stop button — shown when playing */}
        {playing && (
          <button
            onClick={handleStop}
            className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-black/70 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white hover:bg-black/90 transition-colors"
            aria-label="Stop video"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
            </svg>
          </button>
        )}

        {/* Brand logo */}
        <div className="absolute top-2 left-2 flex items-center gap-1.5">
          {ad.brand.logo_url && (
            <img
              src={ad.brand.logo_url}
              alt={ad.brand.name}
              className="w-6 h-6 rounded-full bg-white object-contain border border-white/20"
            />
          )}
          <span className="text-[10px] font-medium text-white bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded max-w-[100px] truncate">
            {ad.brand.name}
          </span>
        </div>

        {/* Platform badge */}
        <div className="absolute top-2 right-2">
          <span className="text-[10px] font-bold text-white bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded">
            {getPlatformAbbr(ad.platform)}
          </span>
        </div>

        {/* Performance badge */}
        <div className="absolute bottom-2 left-2">
          <PerformanceBadge score={ad.performance_score_title} />
        </div>

        {/* Format badge */}
        <div className="absolute bottom-2 right-2">
          <span className="text-[10px] text-zinc-300 bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded">
            {getFormatLabel(ad.display_format)}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-3 flex flex-col flex-1 gap-2">
        {/* Stats row */}
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <span className="flex items-center gap-1">
            <ClockIcon /> {ad.days_active}d
          </span>
          <span className="flex items-center gap-1">
            <RefreshIcon /> {ad.used_count}x
          </span>
          {ad.cta_text && (
            <span className="ml-auto bg-surface-raised border border-app-border text-zinc-400 px-1.5 py-0.5 rounded text-[10px] font-medium truncate max-w-[80px]">
              {ad.cta_text}
            </span>
          )}
        </div>

        {/* Copy */}
        <div className="flex-1 min-h-0">
          {ad.title && (
            <p className="text-xs font-medium text-zinc-200 leading-snug mb-1 line-clamp-2">
              {ad.title}
            </p>
          )}
          {ad.body && (
            <p className="text-[11px] text-zinc-500 leading-relaxed line-clamp-3">
              {truncate(ad.body, 140)}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1 border-t border-app-border">
          <button
            onClick={() => onViewDetails(ad)}
            className="flex-1 text-xs text-zinc-400 hover:text-white py-1.5 rounded-md hover:bg-surface-raised transition-colors"
          >
            View Details
          </button>
          <button
            onClick={openInDna}
            className="flex-1 text-xs text-accent hover:text-white bg-accent/10 hover:bg-accent py-1.5 rounded-md transition-colors font-medium"
          >
            Open in DNA
          </button>
        </div>
      </div>
    </div>
  )
}

function ClockIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function RefreshIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  )
}
