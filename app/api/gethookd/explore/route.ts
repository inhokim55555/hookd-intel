import { NextResponse } from 'next/server'
import { exploreAds, GethookdError } from '@/lib/gethookd'
import type { ExploreFilters } from '@/lib/types'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)

  const filters: ExploreFilters = {}

  const stringParams = [
    'query',
    'sort_column',
    'sort_direction',
    'start-date',
    'end-date',
    'status',
    'ad-format',
    'language',
    'platform',
    'niche',
    'performance_scores',
    'video_lengths',
    'gender_audience',
    'age_audience',
    'location',
    'creative_categories',
    'cta_types',
  ]

  const intParams = ['page', 'per_page', 'run-time', 'used_count', 'ads_per_brand_limit']

  stringParams.forEach(key => {
    const val = searchParams.get(key)
    if (val) (filters as Record<string, unknown>)[key] = val
  })

  intParams.forEach(key => {
    const val = searchParams.get(key)
    if (val) (filters as Record<string, unknown>)[key] = parseInt(val, 10)
  })

  try {
    const data = await exploreAds(filters)
    return NextResponse.json(data)
  } catch (error) {
    if (error instanceof GethookdError) {
      return NextResponse.json({ errors: true, message: error.message }, { status: error.status })
    }
    return NextResponse.json({ errors: true, message: 'Internal server error' }, { status: 500 })
  }
}
