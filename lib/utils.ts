import type { Ad, SlimAd, TrendStats } from './types'
import { FORMAT_LABELS, PLATFORM_ABBR, CREDITS_CACHE_KEY } from './constants'

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function truncate(str: string | null | undefined, length: number): string {
  if (!str) return ''
  if (str.length <= length) return str
  return str.slice(0, length) + '...'
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function getPlatformAbbr(platform: string): string {
  return PLATFORM_ABBR[platform.toLowerCase()] ?? platform.toUpperCase().slice(0, 2)
}

export function getFormatLabel(format: string): string {
  return FORMAT_LABELS[format.toLowerCase()] ?? format
}

export function getAgeRange(min: number | null, max: number | null): string {
  if (!min && !max) return 'All ages'
  if (!max || max >= 65) return `${min}+`
  return `${min}–${max}`
}

export function slimAd(ad: Ad): SlimAd {
  return {
    brand: ad.brand.name,
    format: ad.display_format,
    platform: ad.platform,
    title: ad.title,
    body: ad.body,
    cta: ad.cta_text,
    days_active: ad.days_active,
    used_count: ad.used_count,
    performance: ad.performance_score_title,
    spend_range: ad.ad_spend_range_score_title,
    age_range: getAgeRange(ad.age_audience_min, ad.age_audience_max),
    gender: ad.gender_audience,
    video_length: ad.media?.[0]?.video_length ?? null,
  }
}

export function computeTrendStats(ads: Ad[]): TrendStats {
  const total = ads.length
  if (total === 0) {
    return {
      total_ads: 0,
      format_distribution: [],
      performance_distribution: [],
      cta_frequency: [],
      platform_distribution: [],
      top_brands: [],
      spend_distribution: [],
      overall_avg_days_active: 0,
    }
  }

  const overall_avg_days_active = Math.round(ads.reduce((s, a) => s + a.days_active, 0) / total)

  // Format distribution
  const formatMap = new Map<string, { count: number; total_days: number }>()
  ads.forEach(ad => {
    const f = ad.display_format
    const existing = formatMap.get(f) ?? { count: 0, total_days: 0 }
    formatMap.set(f, { count: existing.count + 1, total_days: existing.total_days + ad.days_active })
  })
  const format_distribution = Array.from(formatMap.entries())
    .map(([format, { count, total_days }]) => ({
      format,
      count,
      pct: Math.round((count / total) * 100),
      avg_days_active: Math.round(total_days / count),
    }))
    .sort((a, b) => b.count - a.count)

  // Performance distribution
  const perfOrder = ['Winning', 'Optimized', 'Growing', 'Scaling', 'Testing']
  const perfMap = new Map<string, number>()
  ads.forEach(ad => {
    const p = ad.performance_score_title
    perfMap.set(p, (perfMap.get(p) ?? 0) + 1)
  })
  const performance_distribution = perfOrder
    .filter(score => perfMap.has(score))
    .map(score => ({
      score,
      count: perfMap.get(score)!,
      pct: Math.round(((perfMap.get(score) ?? 0) / total) * 100),
    }))

  // CTA frequency
  const ctaMap = new Map<string, { count: number; total_days: number }>()
  ads.forEach(ad => {
    const cta = ad.cta_type ?? 'NONE'
    const existing = ctaMap.get(cta) ?? { count: 0, total_days: 0 }
    ctaMap.set(cta, { count: existing.count + 1, total_days: existing.total_days + ad.days_active })
  })
  const cta_frequency = Array.from(ctaMap.entries())
    .map(([cta, { count, total_days }]) => ({
      cta,
      count,
      pct: Math.round((count / total) * 100),
      avg_days_active: Math.round(total_days / count),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  // Platform distribution
  const platformMap = new Map<string, number>()
  ads.forEach(ad => platformMap.set(ad.platform, (platformMap.get(ad.platform) ?? 0) + 1))
  const platform_distribution = Array.from(platformMap.entries())
    .map(([platform, count]) => ({ platform, count }))
    .sort((a, b) => b.count - a.count)

  // Top brands
  const brandMap = new Map<string, { count: number; total_days: number }>()
  ads.forEach(ad => {
    const name = ad.brand.name
    const existing = brandMap.get(name) ?? { count: 0, total_days: 0 }
    brandMap.set(name, { count: existing.count + 1, total_days: existing.total_days + ad.days_active })
  })
  const top_brands = Array.from(brandMap.entries())
    .map(([name, { count, total_days }]) => ({
      name,
      count,
      avg_days_active: Math.round(total_days / count),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  // Spend distribution
  const spendMap = new Map<string, number>()
  ads.forEach(ad => {
    const range = ad.ad_spend_range_score_title ?? 'Unknown'
    spendMap.set(range, (spendMap.get(range) ?? 0) + 1)
  })
  const spend_distribution = Array.from(spendMap.entries())
    .map(([range, count]) => ({
      range,
      count,
      pct: Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.count - a.count)

  return {
    total_ads: total,
    format_distribution,
    performance_distribution,
    cta_frequency,
    platform_distribution,
    top_brands,
    spend_distribution,
    overall_avg_days_active,
  }
}

export function cacheCredits(remaining: number) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(CREDITS_CACHE_KEY, String(remaining))
  }
}

export function getCachedCredits(): number | null {
  if (typeof window === 'undefined') return null
  const val = localStorage.getItem(CREDITS_CACHE_KEY)
  return val ? parseFloat(val) : null
}

export function markdownToHtml(text: string): string {
  return text
    .replace(/^#### (.+)$/gm, '<h4 class="text-base font-semibold text-zinc-100 mt-5 mb-2">$1</h4>')
    .replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold text-white mt-6 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold text-white mt-8 mb-3 pb-2 border-b border-app-border">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold text-white mt-8 mb-4">$1</h1>')
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong class="text-white font-bold"><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="text-zinc-300">$1</em>')
    .replace(/`([^`]+)`/g, '<code class="bg-surface-raised text-accent text-sm px-1.5 py-0.5 rounded font-mono">$1</code>')
    .replace(/^---$/gm, '<hr class="border-app-border my-6" />')
    .replace(/^- (.+)$/gm, '<li class="text-zinc-300 ml-5 list-disc mb-1">$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li class="text-zinc-300 ml-5 list-decimal mb-1">$1</li>')
    .replace(/(<li[\s\S]+?<\/li>(\n|$))+/g, (match) => `<ul class="my-3 space-y-1">${match}</ul>`)
    .replace(/\n\n/g, '</p><p class="text-zinc-300 mb-4 leading-relaxed">')
    .replace(/\n/g, '<br />')
    .replace(/^/, '<p class="text-zinc-300 mb-4 leading-relaxed">')
    .replace(/$/, '</p>')
}
