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
      monthly_distribution: [],
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

  // Monthly distribution (group by start_date year-month)
  const monthMap = new Map<string, { count: number; total_days: number }>()
  ads.forEach(ad => {
    if (!ad.start_date) return
    const month = ad.start_date.slice(0, 7) // "YYYY-MM"
    const existing = monthMap.get(month) ?? { count: 0, total_days: 0 }
    monthMap.set(month, { count: existing.count + 1, total_days: existing.total_days + ad.days_active })
  })
  const monthly_distribution = Array.from(monthMap.entries())
    .map(([month, { count, total_days }]) => ({
      month,
      count,
      avg_days_active: Math.round(total_days / count),
    }))
    .sort((a, b) => a.month.localeCompare(b.month))

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
    monthly_distribution,
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

export function markdownToHtml(md: string): string {
  // Inline formatting — applied inside block elements only
  function inline(s: string): string {
    return s
      .replace(/\*\*\*(.+?)\*\*\*/g, '<strong class="text-white font-bold"><em>$1</em></strong>')
      .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
      .replace(/\*(.+?)\*/g, '<em class="text-zinc-300 italic">$1</em>')
      .replace(/`([^`]+)`/g, '<code class="bg-surface-raised text-accent text-[13px] px-1.5 py-0.5 rounded font-mono">$1</code>')
  }

  // Pipe table renderer
  function renderTable(block: string[]): string {
    const parseRow = (line: string): string[] =>
      line.split('|').slice(1, -1).map(c => c.trim())
    const headers = parseRow(block[0])
    const dataRows = block.slice(2).filter(l => l.trim().startsWith('|'))
    const ths = headers
      .map(h => `<th class="px-4 py-2.5 text-left text-[11px] font-semibold text-zinc-500 uppercase tracking-wide whitespace-nowrap border-b border-app-border">${inline(h)}</th>`)
      .join('')
    const trs = dataRows
      .map((row, ri) => {
        const tds = parseRow(row)
          .map(c => `<td class="px-4 py-2.5 text-sm text-zinc-300 border-b border-app-border/40">${inline(c)}</td>`)
          .join('')
        return `<tr class="${ri % 2 === 1 ? 'bg-surface-raised/30' : ''}">${tds}</tr>`
      })
      .join('')
    return `<div class="overflow-x-auto my-5 rounded-xl border border-app-border"><table class="w-full text-left border-collapse"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table></div>`
  }

  const lines = md.split('\n')
  const out: string[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // blank line
    if (!line.trim()) { i++; continue }

    // headings
    const hm = line.match(/^(#{1,4})\s+(.+)$/)
    if (hm) {
      const n = hm[1].length
      const cls = [
        'text-2xl font-bold text-white mt-8 mb-4',
        'text-xl font-bold text-white mt-8 mb-3 pb-2 border-b border-app-border',
        'text-lg font-semibold text-white mt-6 mb-2',
        'text-base font-semibold text-zinc-100 mt-5 mb-1.5',
      ][n - 1]
      out.push(`<h${n} class="${cls}">${inline(hm[2])}</h${n}>`)
      i++; continue
    }

    // horizontal rule
    if (/^-{3,}$/.test(line.trim())) {
      out.push('<hr class="border-app-border my-6" />')
      i++; continue
    }

    // table — collect all contiguous pipe lines
    if (line.trim().startsWith('|')) {
      const block: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('|')) { block.push(lines[i]); i++ }
      if (block.length >= 2) out.push(renderTable(block))
      continue
    }

    // unordered list — collect consecutive items
    if (/^[-*]\s/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^[-*]\s/.test(lines[i])) {
        const m = lines[i].match(/^[-*]\s+(.+)$/)
        if (m) items.push(`<li class="mb-1">${inline(m[1])}</li>`)
        i++
      }
      out.push(`<ul class="list-disc list-outside ml-5 my-3 space-y-0.5 text-zinc-300">${items.join('')}</ul>`)
      continue
    }

    // ordered list — collect consecutive items
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        const m = lines[i].match(/^\d+\.\s+(.+)$/)
        if (m) items.push(`<li class="mb-1">${inline(m[1])}</li>`)
        i++
      }
      out.push(`<ol class="list-decimal list-outside ml-5 my-3 space-y-0.5 text-zinc-300">${items.join('')}</ol>`)
      continue
    }

    // paragraph — collect until blank or any block-level marker
    const para: string[] = []
    while (i < lines.length) {
      const l = lines[i]
      if (
        !l.trim() ||
        /^#{1,4}\s/.test(l) ||
        /^-{3,}$/.test(l.trim()) ||
        l.trim().startsWith('|') ||
        /^[-*]\s/.test(l) ||
        /^\d+\.\s/.test(l)
      ) break
      para.push(l); i++
    }
    if (para.length) {
      out.push(`<p class="text-zinc-300 mb-4 leading-relaxed">${inline(para.join('<br />'))}</p>`)
    }
  }

  return out.join('\n')
}
