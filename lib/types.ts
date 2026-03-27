export interface AdMedia {
  type: string
  url: string
  resized_url: string | null
  thumbnail_url: string | null
  video_length: number
}

export interface AdCard {
  title: string | null
  body: string | null
  caption: string | null
  cta_text: string | null
  cta_type: string | null
  landing_page: string | null
  media: AdMedia[]
}

export interface Brand {
  external_id: string
  name: string
  logo_url: string | null
  active_ads: number
}

export interface Ad {
  id: number
  external_id: string
  platform: string
  display_format: string
  title: string | null
  body: string | null
  landing_page: string | null
  link_description: string | null
  cta_type: string | null
  cta_text: string | null
  start_date: string | null
  end_date: string | null
  days_active: number
  active_in_library: number
  used_count: number
  is_aaa_eligible: number
  age_audience_min: number | null
  age_audience_max: number | null
  gender_audience: string | null
  eu_total_reach: number | null
  ad_spend_range_score: number | null
  ad_spend_range_score_title: string | null
  performance_score: number
  performance_score_title: string
  share_url: string
  brand: Brand
  media: AdMedia[]
  ad_cards?: AdCard[]
}

export interface ExploreFilters {
  query?: string
  page?: number
  per_page?: number
  sort_column?: string
  sort_direction?: string
  'start-date'?: string
  'end-date'?: string
  status?: string
  'ad-format'?: string
  'run-time'?: number
  language?: string
  platform?: string
  niche?: string
  performance_scores?: string
  used_count?: number
  video_lengths?: string
  gender_audience?: string
  age_audience?: string
  location?: string
  creative_categories?: string
  cta_types?: string
  ads_per_brand_limit?: number
}

export interface ExploreResponse {
  errors: boolean
  data: Ad[]
  used_credits: number | null
  remaining_credits: number
  sorting: { column: string; direction: string }
  filters: Record<string, unknown>
}

export interface CloneMedia {
  id: number
  url: string
  aspect_ratio: string
  is_image_reference: boolean
  order: number
}

export interface ClonePrompt {
  id: number
  prompt: string
  aspect_ratio: string
  in_progress: boolean
  created_at: string
  media: CloneMedia[]
}

export interface CloneAd {
  id: number
  title: string
  created_at: string
  updated_at: string
  prompts: ClonePrompt[]
}

export interface CloneAdResponse {
  errors: boolean
  data: CloneAd
  used_credits: number | null
  remaining_credits: number
  message?: string
}

export interface BrandContext {
  brand_name: string
  product_description: string
  target_audience: string
  brand_voice: string
  niche_id: string
  niche_label: string
}

export interface SlimAd {
  brand: string
  format: string
  platform: string
  title: string | null
  body: string | null
  cta: string | null
  days_active: number
  used_count: number
  performance: string
  spend_range: string | null
  age_range: string
  gender: string | null
  video_length: number | null
}

export interface TrendStats {
  total_ads: number
  format_distribution: Array<{ format: string; count: number; pct: number; avg_days_active: number }>
  performance_distribution: Array<{ score: string; count: number; pct: number }>
  cta_frequency: Array<{ cta: string; count: number; pct: number; avg_days_active: number }>
  platform_distribution: Array<{ platform: string; count: number }>
  top_brands: Array<{ name: string; count: number; avg_days_active: number }>
  spend_distribution: Array<{ range: string; count: number; pct: number }>
  monthly_distribution: Array<{ month: string; count: number; avg_days_active: number }>
  overall_avg_days_active: number
}
