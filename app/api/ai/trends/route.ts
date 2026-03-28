import Anthropic from '@anthropic-ai/sdk'
import type { TrendStats, SlimAd } from '@/lib/types'
import { analyzeVideoAdsForTrends, geminiAvailable, type VideoRef, type VideoAnalysis } from '@/lib/gemini'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const SYSTEM_PROMPT = `You are an expert advertising trend analyst who specializes in reading market signals from paid ad performance data. You translate raw statistics into clear, actionable intelligence. Be specific about what the numbers mean, not just what they are. Identify the "so what" behind every data point. Every recommendation must be directly grounded in the data provided.`

function buildPrompt(
  niche_label: string,
  date_range: { start: string; end: string },
  platform_filter: string,
  stats: TrendStats,
  top_performers: SlimAd[],
  videoAnalyses?: VideoAnalysis[],
): string {
  const videoSection =
    videoAnalyses && videoAnalyses.length > 0
      ? `\nGEMINI VIDEO ANALYSES (what the AI actually saw when watching top video ads):\n${videoAnalyses.map((a, i) => `Ad #${i + 1}: ${a.analysis}`).join('\n\n')}\n\n---\n`
      : ''

  return `Analyze advertising trends for the ${niche_label} niche based on the following data.

DATE RANGE ANALYZED: ${date_range.start} to ${date_range.end}
PLATFORM FILTER: ${platform_filter || 'All platforms'}
TOTAL ADS ANALYZED: ${stats.total_ads}

COMPUTED STATISTICS:
${JSON.stringify(stats, null, 2)}

TOP 15 PERFORMERS (by days active):
${JSON.stringify(top_performers, null, 2)}
${videoSection}
---

Generate a trend analysis with exactly these sections:

## Executive Summary
3–4 sentences: What is the headline story in this niche right now? What is the most important thing a creative team needs to know?

## Format & Length Trends
What do the format and duration numbers reveal? Which formats are sustaining longest and what does that tell us about what the algorithm and audience reward?

## What's Working (and Why)
Based on the top performers, what creative approaches, angles, and structures are generating the most longevity? Be specific — cite actual patterns from the data.

## CTA Intelligence
What does the CTA distribution reveal about buyer intent and funnel stage in this niche? Which CTAs correlate with longer-running ads?

## Competitive Landscape
What do the brand counts and spend distribution tell us about the competitive dynamics? Is this niche concentrated or fragmented?

## What's Missing (Opportunity Gaps)
Based on what you DON'T see in the data — underrepresented formats, CTAs, or approaches — where are the gaps a smart creative team could exploit?

## 5 Specific Recommendations
Numbered, concrete action items. Not vague advice — specific creative or strategic moves based directly on this data.`
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { niche_label, date_range, platform_filter, stats, top_performers, video_refs } = body as {
      niche_label: string
      date_range: { start: string; end: string }
      platform_filter: string
      stats: TrendStats
      top_performers: SlimAd[]
      video_refs?: VideoRef[]
    }

    // Gemini video analyses (graceful degradation)
    let videoAnalyses: VideoAnalysis[] | undefined
    if (video_refs && video_refs.length > 0 && geminiAvailable()) {
      videoAnalyses = await analyzeVideoAdsForTrends(video_refs)
    }

    const userPrompt = buildPrompt(niche_label, date_range, platform_filter, stats, top_performers, videoAnalyses)

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
    console.error('Trends route error:', error)
    return new Response('Internal server error', { status: 500 })
  }
}
