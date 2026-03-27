import { NextResponse } from 'next/server'

export async function GET() {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) {
    return NextResponse.json({ ok: false, error: 'ANTHROPIC_API_KEY not configured' })
  }
  if (!key.startsWith('sk-ant-')) {
    return NextResponse.json({ ok: false, error: 'API key format appears invalid' })
  }
  return NextResponse.json({ ok: true, model: 'claude-sonnet-4-6' })
}
