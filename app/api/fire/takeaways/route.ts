import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { z } from 'zod';
import { fireTakeawaySchema } from '@/lib/fire/ern/types';

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
- "tag": one of "strong" (positive/green), "watch" (caution/amber), or "idea" (actionable suggestion/blue)
- "title": short headline (max 60 chars)
- "body": 1-2 sentence explanation with specific numbers

Tag guidance:
- "strong": WR below ERN dynamic rate, MC survival ≥95%, FIRE target met, good savings rate
- "watch": MC survival <90%, WR above fail-safe SWR, high CAPE regime (>30), portfolio below target
- "idea": concrete suggestions to improve outcomes (e.g. "work 2 more years", "reduce spend by £X")

Respond with ONLY the JSON array, no markdown wrapping.`;

/**
 * Call Claude via the CLI using OAuth credentials (~/.claude/.credentials.json).
 * Clears ANTHROPIC_API_KEY from subprocess env to force OAuth usage.
 * Passes prompt via stdin to avoid shell escaping issues.
 */
function callClaudeCli(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const env = { ...process.env };
    delete env.ANTHROPIC_API_KEY;
    delete env.CLAUDECODE;

    const proc = spawn(
      'claude',
      ['-p', '--output-format', 'text', '--max-turns', '1', '--model', 'claude-sonnet-4-20250514'],
      { env, shell: true, timeout: 60_000 },
    );

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(`claude CLI exited with code ${code}: ${stderr.slice(0, 300)}`));
      }
    });

    proc.on('error', (err) => reject(err));

    // Write prompt to stdin and close
    proc.stdin.write(prompt);
    proc.stdin.end();
  });
}

/**
 * POST /api/fire/takeaways
 *
 * Generate AI-powered takeaways from FIRE simulation results using Claude CLI (OAuth).
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

    const fullPrompt = `${SYSTEM_PROMPT}\n\nSimulation results:\n${userMessage}`;

    let responseText: string;
    try {
      responseText = await callClaudeCli(fullPrompt);
    } catch (cliError) {
      console.error('Claude CLI error:', cliError);
      return NextResponse.json(
        { error: 'Claude CLI not available or OAuth not configured' },
        { status: 503 },
      );
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
      console.error('Failed to parse CLI response:', responseText.slice(0, 200));
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
