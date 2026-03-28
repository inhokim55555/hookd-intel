import { NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'

const DB_AVAILABLE = Boolean(process.env.DATABASE_URL)

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!DB_AVAILABLE) return NextResponse.json(null)
  const { id } = await params
  try {
    const rows = await dbQuery(
      `SELECT id, type, title, metadata, output, created_at FROM generation_history WHERE id = $1`,
      [id]
    )
    if (!rows[0]) return NextResponse.json(null)
    return NextResponse.json({ ...rows[0], id: String((rows[0] as Record<string, unknown>).id) })
  } catch {
    return NextResponse.json(null)
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!DB_AVAILABLE) return NextResponse.json({ ok: false }, { status: 503 })
  const { id } = await params
  try {
    await dbQuery(`DELETE FROM generation_history WHERE id = $1`, [id])
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
