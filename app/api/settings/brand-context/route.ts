import { NextResponse } from 'next/server'
import { dbQuery, initBrandContextTable } from '@/lib/db'
import type { BrandContext } from '@/lib/types'

const DB_AVAILABLE = Boolean(process.env.DATABASE_URL)

async function ensureTable() {
  await initBrandContextTable()
}

export async function GET() {
  if (!DB_AVAILABLE) {
    // No database configured — client will fall back to localStorage
    return NextResponse.json(null)
  }
  try {
    await ensureTable()
    const rows = await dbQuery<BrandContext>(`SELECT * FROM brand_context WHERE id = 'default'`)
    return NextResponse.json(rows[0] ?? null)
  } catch {
    return NextResponse.json(null)
  }
}

export async function POST(req: Request) {
  if (!DB_AVAILABLE) {
    return NextResponse.json({ ok: false, error: 'Database not configured' }, { status: 503 })
  }
  try {
    const body: BrandContext = await req.json()
    await ensureTable()
    await dbQuery(
      `INSERT INTO brand_context
         (id, brand_name, niche_id, niche_label, product_description, target_audience, brand_voice, updated_at)
       VALUES ('default', $1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (id) DO UPDATE SET
         brand_name          = $1,
         niche_id            = $2,
         niche_label         = $3,
         product_description = $4,
         target_audience     = $5,
         brand_voice         = $6,
         updated_at          = NOW()`,
      [
        body.brand_name ?? '',
        body.niche_id ?? '',
        body.niche_label ?? '',
        body.product_description ?? '',
        body.target_audience ?? '',
        body.brand_voice ?? '',
      ]
    )
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, error: 'Database error' }, { status: 500 })
  }
}
