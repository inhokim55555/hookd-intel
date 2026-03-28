import { NextResponse } from 'next/server'
import { dbQuery, initHistoryTable } from '@/lib/db'

const DB_AVAILABLE = Boolean(process.env.DATABASE_URL)

// GET /api/history?type=dna&limit=30
export async function GET(req: Request) {
  if (!DB_AVAILABLE) return NextResponse.json([])
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '30', 10), 100)
  try {
    await initHistoryTable()
    const rows = await dbQuery(
      `SELECT id, type, title, metadata, created_at FROM generation_history
       WHERE ($1::text IS NULL OR type = $1) ORDER BY created_at DESC LIMIT $2`,
      [type, limit]
    )
    // Stringify id to match localStorage interface
    return NextResponse.json(rows.map((r: Record<string, unknown>) => ({ ...r, id: String(r.id) })))
  } catch {
    return NextResponse.json([])
  }
}

// POST /api/history  body: { type, title, metadata, output }
export async function POST(req: Request) {
  if (!DB_AVAILABLE) return NextResponse.json({ ok: false, error: 'no_db' }, { status: 503 })
  try {
    const { type, title, metadata, output } = await req.json()
    await initHistoryTable()
    const rows = await dbQuery<{ id: number }>(
      `INSERT INTO generation_history (type, title, metadata, output)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [type, title, JSON.stringify(metadata ?? {}), output]
    )
    return NextResponse.json({ ok: true, id: String(rows[0].id) })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
