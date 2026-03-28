import Anthropic from '@anthropic-ai/sdk'
import type { Ad, BrandContext } from '@/lib/types'
import { analyzeVideoAdForDna, geminiAvailable } from '@/lib/gemini'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const SYSTEM_PROMPT = `You are a world-class direct-response copywriter with expertise across video scripts, static ad copy, and carousel formats. You write in concrete, conversion-focused language. Every word earns its place. You never pad, never use marketing clichés, and never write two variations that feel similar. When given a winning ad, you deconstruct why it works and rebuild it from 10 completely different angles without losing the core conversion intent. Always write the full copy — never abbreviate or outline.`

const ALL_ANGLES = [
  'Social Proof / Testimonial',
  'Fear / Loss Aversion',
  'Aspirational / Transformation',
  'Curiosity / Open Loop',
  'Authority / Facts & Stats',
  'Humor / Disarming',
  'Direct / No-Nonsense',
  'Story-Driven / Narrative',
  'Comparison / Us vs Them',
  'Urgency / Scarcity',
  'Exclusivity / For You Only',
  'Problem Agitation / Before & After',
  'Educational / How-To',
  'Community / Belonging',
  'Emotional / Heartfelt',
]

function buildPrompt(
  ad: Ad,
  brand: BrandContext,
  variationCount: number,
  creativeDirection: string,
  videoAnalysis?: string,
): string {
  const angles = ALL_ANGLES.slice(0, variationCount)

  const videoNote =
    ad.display_format === 'video' && ad.media?.[0]?.video_length
      ? `\nDuration: ${ad.media[0].video_length}s`
      : ''

  const brandSection = brand.brand_name
    ? `BRAND CONTEXT (write all variations for this brand):
Brand Name: ${brand.brand_name}
Product/Service: ${brand.product_description || 'Not specified'}
Target Audience: ${brand.target_audience || 'Not specified'}
Brand Voice: ${brand.brand_voice || 'Not specified'}`
    : `BRAND CONTEXT: Not configured. Adapt variations to match the source brand's voice.`

  const directionSection = creativeDirection.trim()
    ? `\nCREATIVE DIRECTION (apply across all variations):
${creativeDirection.trim()}\n`
    : ''

  const videoSection = videoAnalysis
    ? `GEMINI VIDEO ANALYSIS (what the AI actually saw when watching this ad):
${videoAnalysis}

---
`
    : ''

  return `Deconstruct this winning ad and create ${variationCount} completely distinct variations. Each must use a fundamentally different angle, emotional driver, and copy structure — not word swaps, but completely different strategic approaches.

SOURCE AD:
Brand: ${ad.brand.name}
Format: ${ad.display_format} · Platform: ${ad.platform}
Performance: ${ad.performance_score_title} · ${ad.days_active} days active · Used ${ad.used_count} times${videoNote}

Headline: ${ad.title ?? '(none)'}
Body Copy: ${ad.body ?? '(none)'}
CTA: ${ad.cta_text ?? '(none)'}

${brandSection}
${directionSection}
---

${videoSection}VARIATION REQUIREMENTS:
Write exactly ${variationCount} variations using these angles in this order:
${angles.map((a, i) => `${i + 1}. ${a}`).join('\n')}

For each variation, use this exact format:

---
**Variation [N]: [Angle Name]**

**Hook / Headline:**
[The first thing the audience sees or hears — write the actual words. For video: the opening line spoken or shown in the first 3 seconds.]

**Body Copy:**
[Complete copy — written in full, not outlined or summarized. For video ads, write this as a line-by-line script with action notes in [brackets]. For image ads, write the full ad copy as it would appear.]

**CTA:**
[Exact call-to-action text]

**Visual Direction:**
[For image ads: Describe the visual scene, composition, dominant colors, text overlay placement, and emotional mood in 2–3 sentences.]
[For video ads: Describe the opening shot, key visual beats at notable timestamps, text-on-screen moments, pacing style, and closing frame in 3–4 sentences.]

**Why This Angle:**
[One sentence explaining the strategic logic — who specifically it targets and why it converts.]

---

Write all ${variationCount}. Do not summarize, abbreviate, or skip any field. Every variation must be complete and ready to hand to a copywriter or creative director.`
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { ad, brand_context, creative_direction, variation_count } = body as {
      ad: Ad
      brand_context: BrandContext
      creative_direction?: string
      variation_count?: number
    }

    if (!ad) {
      return new Response('No ad data provided', { status: 400 })
    }

    const count = [5, 10, 15].includes(variation_count ?? 0) ? variation_count! : 10

    // Gemini video analysis (graceful degradation — null if unavailable or error)
    let videoAnalysis: string | undefined
    const isVideoAd = ad.display_format === 'video' || ad.media?.[0]?.type === 'video'
    const videoUrl = ad.media?.[0]?.url
    if (isVideoAd && videoUrl && geminiAvailable()) {
      const result = await analyzeVideoAdForDna(videoUrl)
      if (result) videoAnalysis = result
    }

    const userPrompt = buildPrompt(ad, brand_context ?? {}, count, creative_direction ?? '', videoAnalysis)

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const response = client.messages.stream({
            model: 'claude-sonnet-4-6',
            max_tokens: 16000,
            thinking: { type: 'enabled', budget_tokens: 10000 },
            system: SYSTEM_PROMPT,
            messages: [{ role: 'user', content: userPrompt }],
          })

          for await (const event of response) {
            if (
              event.type === 'content_block_delta' &&
              event.delta.type === 'text_delta'
            ) {
              controller.enqueue(new TextEncoder().encode(event.delta.text))
            }
          }
        } catch (err) {
          controller.error(err)
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  } catch (error) {
    console.error('DNA route error:', error)
    return new Response('Internal server error', { status: 500 })
  }
}
