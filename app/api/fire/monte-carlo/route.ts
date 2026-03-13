import { NextRequest, NextResponse } from 'next/server';
import { runMonteCarlo, createMcConfigFromErn } from '@/lib/fire/ern/monte-carlo';
import { ernSimConfigSchema } from '@/lib/fire/ern/types';

/**
 * POST /api/fire/monte-carlo
 *
 * Run 500-path block-bootstrap Monte Carlo simulation.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = ernSimConfigSchema.safeParse(body.config);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid config', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const ernConfig = parsed.data;
    const mcConfig = createMcConfigFromErn(ernConfig);
    const results = runMonteCarlo(mcConfig);

    const retirementAge = ernConfig.retirementAge ?? ernConfig.currentAge;
    const retirementYear = Math.max(0, retirementAge - ernConfig.currentAge);

    return NextResponse.json({
      survivalRate: results.survivalRate,
      percentiles: results.percentiles,
      worstPath: results.worstPath,
      worstPathIndex: results.worstPathIndex,
      pathCount: results.paths.length,
      retirementYear: retirementYear > 0 ? retirementYear : undefined,
    });
  } catch (error) {
    console.error('Monte Carlo error:', error);
    return NextResponse.json(
      { error: 'Failed to run Monte Carlo simulation' },
      { status: 500 },
    );
  }
}
