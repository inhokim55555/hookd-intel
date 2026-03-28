export async function GET() {
  if (!process.env.GEMINI_API_KEY) {
    return Response.json({ ok: false, error: 'GEMINI_API_KEY not set' })
  }
  return Response.json({ ok: true, model: 'gemini-2.5-flash-preview-04-17' })
}
