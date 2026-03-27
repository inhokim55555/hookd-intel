import { NextResponse } from 'next/server'
import { createCloneAd, GethookdError } from '@/lib/gethookd'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const data = await createCloneAd({
      ad_id: body.ad_id,
      prompt: body.prompt,
      aspect_ratio: body.aspect_ratio,
      variations_count: body.variations_count ?? 10,
    })
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    if (error instanceof GethookdError) {
      return NextResponse.json({ errors: true, message: error.message }, { status: error.status })
    }
    return NextResponse.json({ errors: true, message: 'Failed to create clone ad' }, { status: 500 })
  }
}
