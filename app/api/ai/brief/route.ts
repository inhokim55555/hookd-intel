import Anthropic from '@anthropic-ai/sdk'
import type { SlimAd, BrandContext } from '@/lib/types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const SYSTEM_PROMPT = `You are an expert direct-response advertising strategist and creative director. You specialize in analyzing high-performing ads and extracting actionable creative intelligence that real teams can execute immediately. Be specific, concrete, and ruthlessly practical. No vague marketing speak. Every insight must be directly traceable to the data provided.`

function buildPrompt(
  slimAds: SlimAd[],
  niche_label: string,
  filters_summary: string,
  brand: BrandContext,
): string {
  const brandSection = brand.brand_name
    ? `BRAND CONTEXT:
- Brand Name: ${brand.brand_name}
- Product/Service: ${brand.product_description || 'Not specified'}
- Target Audience: ${brand.target_audience || 'Not specified'}
- Brand Voice: ${brand.brand_voice || 'Not specified'}`
    : `BRAND CONTEXT: Not configured. Generate generic insights for this niche.`

  return `Analyze the following ${slimAds.length} top-performing ads from the ${niche_label} niche and generate a comprehensive creative brief.

FILTERS APPLIED: ${filters_summary}

${brandSection}

AD DATA:
${JSON.stringify(slimAds, null, 2)}

---

Generate a creative brief using exactly these sections:

## Market Snapshot
- Top 5 most active brands in this data set and what they're doing
- Format breakdown (what % is video vs image vs carousel)
- Average days active for Winning-tier ads
- Spend range distribution across top performers

## Winning Hook Patterns
List the 6–8 most common hook structures and opening lines found in top performers. For each, show the structural pattern and 1–2 real examples from the data. Be specific about the actual words and phrases used.

## Script & Copy Structures
Identify 3–4 proven copy frameworks visible in these ads. For each framework:
- Name it
- Describe the structure (e.g., Problem → Agitate → Solve → CTA)
- Show a real example from the data
- Note which performance tier it appears in

## Visual Strategies
Based on the format data, video lengths, and any visual cues in the copy, describe what visual approaches dominate and why they likely work.

## CTA Intelligence
Which CTAs appear most in top performers, in which contexts, and what that signals about buyer intent in this niche.

## Audience Signals
What do the targeting patterns (age, gender, reach) reveal about who is most responsive to ads in this niche.

## 3 Ready-to-Produce Concepts
For each concept, provide:

**Concept [N]: [Name]**

Hook (first 3 seconds / headline):
[Write the actual opening line or headline]

Script/Copy Outline:
[Full structural outline — not just labels, write the actual copy beats]

Visual Direction:
[Specific shot/visual descriptions]

CTA:
[Exact CTA text]

Why This Will Work for ${brand.brand_name || 'Your Brand'}:
[1–2 sentences connecting to their brand context]`
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { slimAds, niche_label, filters_summary, brand_context } = body as {
      slimAds: SlimAd[]
      niche_label: string
      filters_summary: string
      brand_context: BrandContext
    }

    if (!slimAds || slimAds.length === 0) {
      return new Response('No ad data provided', { status: 400 })
    }

    const userPrompt = buildPrompt(slimAds, niche_label, filters_summary, brand_context ?? {})

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
    console.error('Brief route error:', error)
    return new Response('Internal server error', { status: 500 })
  }
}
