import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { fireTakeawaySchema } from '@/lib/fire/ern/types';
import { logAiUsage, usageFields } from '@/lib/ai-usage-audit';

const TAKEAWAYS_MODEL = 'claude-sonnet-5';

const takeawaysRequestSchema = z.object({
  failSafeSwr: z.number(),
  medianSwr: z.number(),
  ernDynamicWr: z.number(),
  personalWr: z.number(),
  currentCape: z.number(),
  mcSurvivalRate: z.number().nullable(),
  config: z.object({
    portfolio: z.number(),
    annualSpend: z.number(),
    horizonYears: z.number(),
    currentAge: z.number(),
    retirementAge: z.number().optional(),
    annualSavings: z.number().optional(),
    partialEarningsAnnual: z.number().optional(),
    partialEarningsYears: z.number().optional(),
    statePensionAnnual: z.number().optional(),
    statePensionStartAge: z.number().optional(),
  }),
  accumulation: z.object({
    projectedPortfolio: z.number(),
    yearsToRetirement: z.number(),
    drawdownYears: z.number(),
    growthRateUsed: z.number(),
  }).nullable().optional(),
});

const SYSTEM_PROMPT = `You are a UK-focused FIRE (Financial Independence, Retire Early) analyst. You analyse simulation results from an ERN-grade Safe Withdrawal Rate model and produce concise, actionable takeaways.

Rules:
- Focus on UK context (ISA, SIPP, GIA, state pension, UK tax bands). Never mention US-specific concepts (401k, Roth IRA, Social Security).
- Use GBP (£) for all amounts.
- Be direct and specific. Reference actual numbers from the results.
- Each takeaway should be self-contained and useful on its own.

Output exactly 4-6 takeaways as a JSON array. Each takeaway has:
- "tag": one of "strong" (a strength), "watch" (a caution), or "idea" (an actionable suggestion)
- "title": short headline in sentence case (max 60 chars)
- "body": 1-2 plain sentences with specific numbers. Start straight in with the point: no label or prefix such as "Example:", "Note:" or "Tip:".

Tag guidance:
- "strong": WR below ERN dynamic rate, MC survival ≥95%, FIRE target met, good savings rate
- "watch": MC survival <90%, WR above fail-safe SWR, high CAPE regime (>30), portfolio below target
- "idea": concrete suggestions to improve outcomes, such as working two more years or reducing spending by a stated amount

Respond with ONLY the JSON array, no markdown wrapping.`;

/**
 * Ask Claude for takeaways through the Anthropic API, the same way the
 * categoriser does. (This used to shell out to a local `claude` CLI with
 * OAuth credentials, which doesn't exist on Vercel, so it always failed.)
 */
async function callClaude(userMessage: string): Promise<string> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 60_000 });
  const started = Date.now();
  try {
    const message = await client.messages.create({
      model: TAKEAWAYS_MODEL,
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Simulation results:\n${userMessage}` }],
    });
    void logAiUsage({
      feature: 'fire-takeaways',
      model: message.model,
      status: 'success',
      request_ms: Date.now() - started,
      anthropic_message_id: message.id,
      ...usageFields(message.usage),
    });
    const text = message.content.find((c) => c.type === 'text');
    if (!text || text.type !== 'text') throw new Error('No text in response');
    return text.text.trim();
  } catch (error) {
    void logAiUsage({
      feature: 'fire-takeaways',
      model: TAKEAWAYS_MODEL,
      status: 'error',
      request_ms: Date.now() - started,
      error: error instanceof Error ? error.message.slice(0, 300) : String(error),
    });
    throw error;
  }
}

/**
 * POST /api/fire/takeaways
 *
 * Generate AI-powered takeaways from FIRE simulation results.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = takeawaysRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const data = parsed.data;

    const userMessage = JSON.stringify({
      failSafeSwr: data.failSafeSwr,
      medianSwr: data.medianSwr,
      ernDynamicWr: data.ernDynamicWr,
      personalWr: data.personalWr,
      currentCape: data.currentCape,
      mcSurvivalRate: data.mcSurvivalRate,
      portfolio: data.config.portfolio,
      annualSpend: data.config.annualSpend,
      horizonYears: data.config.horizonYears,
      currentAge: data.config.currentAge,
      retirementAge: data.config.retirementAge ?? data.config.currentAge,
      annualSavings: data.config.annualSavings ?? 0,
      partialEarningsAnnual: data.config.partialEarningsAnnual ?? 0,
      partialEarningsYears: data.config.partialEarningsYears ?? 0,
      statePensionAnnual: data.config.statePensionAnnual ?? 23000,
      statePensionStartAge: data.config.statePensionStartAge ?? 67,
      accumulation: data.accumulation ?? null,
    }, null, 2);

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'AI takeaways are not configured (ANTHROPIC_API_KEY missing)' }, { status: 503 });
    }

    let responseText: string;
    try {
      responseText = await callClaude(userMessage);
    } catch (aiError) {
      console.error('Takeaways AI error:', aiError);
      return NextResponse.json({ error: 'AI takeaways are temporarily unavailable' }, { status: 503 });
    }

    // Parse and validate response
    let rawTakeaways: unknown;
    try {
      let text = responseText;
      // Strip markdown code blocks if present
      if (text.startsWith('```json')) text = text.slice(7);
      else if (text.startsWith('```')) text = text.slice(3);
      if (text.endsWith('```')) text = text.slice(0, -3);
      rawTakeaways = JSON.parse(text.trim());
    } catch {
      console.error('Failed to parse takeaways response:', responseText.slice(0, 200));
      return NextResponse.json(
        { error: 'Failed to parse AI response' },
        { status: 502 },
      );
    }

    const takeawaysResult = z.array(fireTakeawaySchema).safeParse(rawTakeaways);
    if (!takeawaysResult.success) {
      return NextResponse.json(
        { error: 'AI response did not match expected format' },
        { status: 502 },
      );
    }

    return NextResponse.json({
      takeaways: takeawaysResult.data.slice(0, 6),
    });
  } catch (error) {
    console.error('Takeaways error:', error);
    return NextResponse.json(
      { error: 'Failed to generate takeaways' },
      { status: 500 },
    );
  }
}
