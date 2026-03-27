'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn, getCachedCredits } from '@/lib/utils'
import { CREDITS_CACHE_KEY } from '@/lib/constants'

const NAV_ITEMS = [
  { href: '/explorer', label: 'Ad Explorer', icon: SearchIcon },
  { href: '/briefs', label: 'Brief Generator', icon: DocumentIcon },
  { href: '/trends', label: 'Trend Radar', icon: TrendIcon },
  { href: '/dna', label: 'DNA Multiplier', icon: DnaIcon },
]

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
    </svg>
  )
}

function DocumentIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
    </svg>
  )
}

function TrendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
    </svg>
  )
}

function DnaIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 15c6.667-6 13.333 0 20-6" /><path d="M9 22c1.798-1.998 2.518-3.995 2.807-5.993" />
      <path d="M15 2c-1.798 1.998-2.518 3.995-2.807 5.993" /><path d="m2 9 20 6" /><path d="m2 21 20-6" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

export default function Sidebar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [credits, setCredits] = useState<number | null>(null)

  useEffect(() => {
    // Load cached credits immediately
    const cached = getCachedCredits()
    if (cached !== null) setCredits(cached)

    // Listen for credit updates from other parts of the app
    const handleStorage = (e: StorageEvent) => {
      if (e.key === CREDITS_CACHE_KEY && e.newValue) {
        setCredits(parseFloat(e.newValue))
      }
    }
    window.addEventListener('storage', handleStorage)

    // Also listen for custom credit update events
    const handleUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (typeof detail?.remaining === 'number') setCredits(detail.remaining)
    }
    window.addEventListener('credits-updated', handleUpdate)

    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('credits-updated', handleUpdate)
    }
  }, [])

  const creditColor =
    credits === null
      ? 'text-zinc-500'
      : credits > 500
        ? 'text-emerald-400'
        : credits > 100
          ? 'text-amber-400'
          : 'text-red-400'

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-app-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-white font-bold text-sm">H</div>
          <div>
            <div className="text-sm font-semibold text-white">Hookd Intel</div>
            <div className="text-xs text-zinc-500">Ad Intelligence</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <div className="text-xs font-medium text-zinc-600 uppercase tracking-wider px-3 mb-2">Features</div>
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150',
                active
                  ? 'bg-accent/10 text-accent border border-accent/20'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-surface-hover border border-transparent',
              )}
            >
              <Icon />
              <span>{label}</span>
            </Link>
          )
        })}

        <div className="pt-4 pb-1">
          <div className="h-px bg-app-border" />
        </div>

        <Link
          href="/settings"
          onClick={() => setMobileOpen(false)}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150',
            pathname === '/settings'
              ? 'bg-accent/10 text-accent border border-accent/20'
              : 'text-zinc-400 hover:text-zinc-100 hover:bg-surface-hover border border-transparent',
          )}
        >
          <SettingsIcon />
          <span>Settings</span>
        </Link>
      </nav>

      {/* Credits */}
      <div className="px-4 py-4 border-t border-app-border">
        <div className="text-xs text-zinc-600 mb-1">Gethookd Credits</div>
        <div className={cn('text-sm font-semibold', creditColor)}>
          {credits === null ? '—' : `${credits.toLocaleString()} remaining`}
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 w-9 h-9 bg-surface-card border border-app-border rounded-lg flex items-center justify-center text-zinc-400 hover:text-white"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {mobileOpen ? (
            <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
          ) : (
            <><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></>
          )}
        </svg>
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed top-0 left-0 h-screen w-60 flex-col bg-surface-raised border-r border-app-border z-30">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar */}
      <aside
        className={cn(
          'lg:hidden fixed top-0 left-0 h-screen w-64 flex-col bg-surface-raised border-r border-app-border z-50 flex transition-transform duration-200',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {sidebarContent}
      </aside>
    </>
  )
}
