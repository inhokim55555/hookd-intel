export const NICHES: Array<{ id: string; label: string }> = [
  { id: '1', label: 'Accessories' },
  { id: '2', label: 'Alcohol' },
  { id: '3', label: 'App/Software' },
  { id: '4', label: 'Automotive' },
  { id: '5', label: 'Beauty' },
  { id: '6', label: 'Book/Publishing' },
  { id: '7', label: 'Business/Professional' },
  { id: '8', label: 'Charity/NFP' },
  { id: '9', label: 'Info' },
  { id: '10', label: 'Entertainment' },
  { id: '11', label: 'Fashion' },
  { id: '12', label: 'Finance' },
  { id: '13', label: 'Food/Drink' },
  { id: '14', label: 'Games' },
  { id: '15', label: 'Government' },
  { id: '16', label: 'Health/Wellness' },
  { id: '17', label: 'Home/Garden' },
  { id: '18', label: 'Insurance' },
  { id: '19', label: 'Jewelry/Watches' },
  { id: '20', label: 'Kids/Baby' },
  { id: '21', label: 'Media/News' },
  { id: '22', label: 'Medical' },
  { id: '23', label: 'Pets' },
  { id: '24', label: 'Real Estate' },
  { id: '25', label: 'Service Business' },
  { id: '26', label: 'Sports/Outdoors' },
  { id: '27', label: 'Tech' },
  { id: '28', label: 'Travel' },
  { id: '29', label: 'Other' },
  { id: '30', label: 'Supplements' },
]

export const PLATFORMS = [
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'twitter', label: 'Twitter' },
  { value: 'pinterest', label: 'Pinterest' },
  { value: 'snapchat', label: 'Snapchat' },
  { value: 'linkedin', label: 'LinkedIn' },
]

export const PERFORMANCE_SCORES = [
  { value: 'winning', label: 'Winning' },
  { value: 'optimized', label: 'Optimized' },
  { value: 'growing', label: 'Growing' },
  { value: 'scaling', label: 'Scaling' },
  { value: 'testing', label: 'Testing' },
]

export const AD_FORMATS = [
  { value: 'image', label: 'Image' },
  { value: 'video', label: 'Video' },
  { value: 'carousels', label: 'Carousel' },
  { value: 'multi_images', label: 'Multi-Image' },
  { value: 'multi_videos', label: 'Multi-Video' },
]

export const SORT_OPTIONS = [
  { value: 'days_active|desc', label: 'Days Active ↓' },
  { value: 'days_active|asc', label: 'Days Active ↑' },
  { value: 'start_date|desc', label: 'Start Date ↓' },
  { value: 'start_date|asc', label: 'Start Date ↑' },
  { value: 'used_count|desc', label: 'Times Used ↓' },
  { value: 'created_at|desc', label: 'Date Added ↓' },
]

export const PERF_COLORS: Record<string, string> = {
  Winning: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  Optimized: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  Growing: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  Scaling: 'text-violet-400 bg-violet-400/10 border-violet-400/20',
  Testing: 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20',
}

export const PLATFORM_ABBR: Record<string, string> = {
  facebook: 'FB',
  instagram: 'IG',
  tiktok: 'TT',
  youtube: 'YT',
  twitter: 'TW',
  pinterest: 'PIN',
  snapchat: 'SC',
  linkedin: 'LI',
}

export const FORMAT_LABELS: Record<string, string> = {
  image: 'Image',
  video: 'Video',
  carousels: 'Carousel',
  multi_images: 'Multi-Image',
  multi_videos: 'Multi-Video',
  dcos: 'DCO',
  dpas: 'DPA',
  events: 'Event',
  page_likes: 'Page Like',
  multi_medias: 'Multi-Media',
}

export const BRAND_CONTEXT_KEY = 'hookd_brand_context'
export const DNA_SOURCE_AD_KEY = 'dna_source_ad'
export const CREDITS_CACHE_KEY = 'hookd_remaining_credits'
