import { NextResponse } from 'next/server'
import { exploreAds, GethookdError } from '@/lib/gethookd'

export async function GET() {
  if (!process.env.GETHOOKD_API_KEY) {
    return NextResponse.json(
      { ok: false, error: 'GETHOOKD_API_KEY not configured' },
      { status: 503 },
    )
  }

  try {
    // Minimal explore call to get remaining_credits
    const data = await exploreAds({ per_page: 1, page: 1 })
    return NextResponse.json({
      ok: true,
      remaining_credits: data.remaining_credits,
      used_credits: data.used_credits,
    })
  } catch (error) {
    if (error instanceof GethookdError) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: error.status },
      )
    }
    return NextResponse.json({ ok: false, error: 'Failed to fetch credits' }, { status: 500 })
  }
}
