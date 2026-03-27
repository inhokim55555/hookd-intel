import { NextResponse } from 'next/server'
import { getCloneAd, GethookdError } from '@/lib/gethookd'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const cloneId = parseInt(params.id, 10)
    if (isNaN(cloneId)) {
      return NextResponse.json({ errors: true, message: 'Invalid clone ID' }, { status: 400 })
    }
    const data = await getCloneAd(cloneId)
    return NextResponse.json(data)
  } catch (error) {
    if (error instanceof GethookdError) {
      return NextResponse.json({ errors: true, message: error.message }, { status: error.status })
    }
    return NextResponse.json({ errors: true, message: 'Failed to fetch clone ad' }, { status: 500 })
  }
}
