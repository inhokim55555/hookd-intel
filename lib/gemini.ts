import { GoogleGenAI } from '@google/genai'

export function geminiAvailable(): boolean {
  return !!process.env.GEMINI_API_KEY
}

function getClient(): GoogleGenAI {
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
}

const MAX_VIDEO_BYTES = 80 * 1024 * 1024 // 80 MB
const FETCH_TIMEOUT_MS = 30_000
const POLL_INTERVAL_MS = 3_000
const POLL_MAX_ATTEMPTS = 20

const DNA_PROMPT = `You are analyzing a winning video ad. Extract the following:

1. HOOK (first 3 seconds): Exact words spoken or shown. What visual appears first?
2. CORE MESSAGE: The primary benefit or claim being made.
3. SCRIPT STRUCTURE: Beat-by-beat narrative arc (hook → problem/setup → solution → proof → CTA).
4. TONE & ENERGY: Emotional register — aggressive, friendly, scientific, aspirational, etc.
5. VISUAL APPROACH: Camera style, b-roll, text overlays, transitions, production quality.
6. EMOTIONAL TRIGGERS: What fears, desires, or pain points does this ad activate?
7. SOCIAL PROOF: Any testimonials, stats, before/after shots, credentials, or reviews visible.
8. CTA: The exact call-to-action text and how it's delivered.
9. WHY IT WORKS: 2–3 specific reasons this ad likely sustains high performance.

Be concrete and specific — reference what you actually see and hear. This analysis directly informs generating new copy variations.`

const BRIEF_PROMPT = `Analyze this video ad for a creative brief. Be specific about what you see and hear.

1. HOOK TYPE & OPENING LINE: How it opens (question / bold claim / UGC testimonial / pattern interrupt) — include the exact first words or visuals.
2. COPY STRUCTURE: Narrative framework in 3–5 beats.
3. KEY BENEFITS SHOWN: What product benefits are demonstrated or stated?
4. TONE: 3–5 words describing the communication style.
5. VISUAL STRATEGY: Production approach and visual style.
6. EMOTIONAL CORE: Primary emotion this ad is designed to trigger.
7. CTA APPROACH: How it closes and what action is requested.
8. WHAT WORKS: 2–3 specific things that make this effective.`

const TRENDS_PROMPT = `Analyze this video ad for competitive intelligence. Return a concise 150-word analysis:

1. HOOK PATTERN: How it opens and why it would stop a scroll.
2. DOMINANT ANGLE: Primary persuasion angle (fear / aspiration / social proof / authority / humor / etc.).
3. PACING & LENGTH: Fast/slow, talking-head/voiceover/text-only.
4. PRODUCTION STYLE: Lo-fi authentic / polished / UGC-style / animated.
5. CREATIVE FORMULA: Any recognizable structure used.`

async function downloadVideo(url: string): Promise<Blob | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timer)

    if (!res.ok) return null

    const contentLength = res.headers.get('content-length')
    if (contentLength && parseInt(contentLength, 10) > MAX_VIDEO_BYTES) return null

    const buffer = await res.arrayBuffer()
    if (buffer.byteLength > MAX_VIDEO_BYTES) return null

    return new Blob([buffer], { type: 'video/mp4' })
  } catch {
    return null
  }
}

async function uploadAndAnalyze(
  videoUrl: string,
  mimeType: string,
  prompt: string,
): Promise<string | null> {
  const ai = getClient()

  const blob = await downloadVideo(videoUrl)
  if (!blob) return null

  let uploadedName: string | undefined

  try {
    const uploaded = await ai.files.upload({
      file: blob,
      config: { mimeType, displayName: 'ad-video' },
    })

    uploadedName = uploaded.name
    const fileUri = uploaded.uri

    // Poll until ACTIVE
    let attempts = 0
    let fileInfo = uploaded

    while (fileInfo.state !== 'ACTIVE') {
      if (fileInfo.state === 'FAILED' || attempts >= POLL_MAX_ATTEMPTS) {
        return null
      }
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))
      fileInfo = await ai.files.get({ name: uploadedName! })
      attempts++
    }

    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview',
      contents: [
        {
          role: 'user',
          parts: [
            { fileData: { mimeType, fileUri: fileUri! } },
            { text: prompt },
          ],
        },
      ],
    })

    return result.text ?? null
  } catch {
    return null
  } finally {
    if (uploadedName) {
      try {
        await ai.files.delete({ name: uploadedName })
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

export async function analyzeVideoAdForDna(
  videoUrl: string,
  mimeType = 'video/mp4',
): Promise<string | null> {
  if (!geminiAvailable()) return null
  try {
    return await uploadAndAnalyze(videoUrl, mimeType, DNA_PROMPT)
  } catch {
    return null
  }
}

export interface VideoRef {
  adId: number
  videoUrl: string
  mimeType?: string
}

export interface VideoAnalysis {
  adId: number
  analysis: string
}

export async function analyzeVideoAdsForBrief(
  videos: VideoRef[],
): Promise<VideoAnalysis[]> {
  if (!geminiAvailable()) return []
  const capped = videos.slice(0, 5)

  const results = await Promise.all(
    capped.map(async v => {
      const analysis = await uploadAndAnalyze(v.videoUrl, v.mimeType ?? 'video/mp4', BRIEF_PROMPT)
      return analysis ? { adId: v.adId, analysis } : null
    }),
  )

  return results.filter((r): r is VideoAnalysis => r !== null)
}

export async function analyzeVideoAdsForTrends(
  videos: VideoRef[],
): Promise<VideoAnalysis[]> {
  if (!geminiAvailable()) return []
  const capped = videos.slice(0, 5)

  const results = await Promise.all(
    capped.map(async v => {
      const analysis = await uploadAndAnalyze(v.videoUrl, v.mimeType ?? 'video/mp4', TRENDS_PROMPT)
      return analysis ? { adId: v.adId, analysis } : null
    }),
  )

  return results.filter((r): r is VideoAnalysis => r !== null)
}
