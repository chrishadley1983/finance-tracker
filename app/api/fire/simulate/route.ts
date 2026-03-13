import { NextRequest, NextResponse } from 'next/server';
import { ernSimulateRequestSchema } from '@/lib/fire/ern/types';
import { runExhaustiveHistoricalSim } from '@/lib/fire/ern/historical-sim';
import {
  computeErnDynamicWr,
  generateCapeWithdrawalCurve,
  computeCapeImpliedReturn,
  computeConditionalFailureTable,
} from '@/lib/fire/ern/cape-analysis';
import { getLatestCape, getDataVintage } from '@/lib/fire/ern/live-cape';
import { projectPortfolioAtRetirement } from '@/lib/fire/ern/accumulation';

/**
 * POST /api/fire/simulate
 *
 * Run ERN-grade historical simulation with the provided configuration.
 * Returns fail-safe SWR, CAPE analysis, conditional failure tables, and per-cohort data.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const parsed = ernSimulateRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { config } = parsed.data;

    // Compute CAPE-based analysis (latest from Shiller dataset)
    const currentCape = getLatestCape();
    const capeImpliedReturn = computeCapeImpliedReturn(currentCape);

    // Accumulation: project portfolio forward if retirement is in the future
    const retirementAge = config.retirementAge ?? config.currentAge;
    const yearsToRetirement = Math.max(0, retirementAge - config.currentAge);
    let simPortfolio = config.portfolio;
    let projectedPortfolio: number | undefined;

    if (yearsToRetirement > 0) {
      projectedPortfolio = projectPortfolioAtRetirement(
        config.portfolio,
        config.annualSavings ?? 0,
        yearsToRetirement,
        capeImpliedReturn,
      );
      simPortfolio = projectedPortfolio;
    }

    // Adjust config for historical sim: use projected portfolio, drawdown-only horizon
    const drawdownYears = config.horizonYears - yearsToRetirement;
    const simConfig = {
      ...config,
      portfolio: simPortfolio,
      horizonYears: Math.max(10, drawdownYears),
    };

    // Run exhaustive historical simulation on projected retirement portfolio
    const historical = runExhaustiveHistoricalSim(simConfig);

    const ernDynamicWr = computeErnDynamicWr(currentCape);
    const capeWithdrawalCurve = generateCapeWithdrawalCurve();
    const conditionalFailureTable = computeConditionalFailureTable(historical.cohorts);
    const personalWr = (config.annualSpend / simPortfolio) * 100;

    return NextResponse.json({
      historical: {
        ...historical,
        // Exclude full cohort array from default response to reduce payload
        cohorts: body.includeCohorts ? historical.cohorts : undefined,
      },
      ernDynamicWr,
      capeImpliedReturn,
      personalWr,
      currentCape,
      capeWithdrawalCurve,
      conditionalFailureTable,
      config,
      // Accumulation metadata (only present when retirementAge > currentAge)
      ...(projectedPortfolio !== undefined && {
        accumulation: {
          projectedPortfolio: Math.round(projectedPortfolio),
          yearsToRetirement,
          drawdownYears: Math.max(10, drawdownYears),
          growthRateUsed: capeImpliedReturn,
        },
      }),
    });
  } catch (error) {
    console.error('Simulation error:', error);
    return NextResponse.json(
      { error: 'Failed to run simulation' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/fire/simulate
 *
 * Returns information about the ERN simulation API.
 */
export async function GET() {
  return NextResponse.json({
    description: 'ERN-grade SWR simulation API (monthly resolution)',
    methodology: 'Closed-form SWR per ERN Part 8, exhaustive historical simulation',
    currentCape: getLatestCape(),
    dataVintage: getDataVintage(),
    dataRange: {
      firstMonth: '1871-02',
      source: 'Shiller monthly real returns (S&P 500 + 10yr Treasury)',
    },
    methods: {
      POST: {
        description: 'Run ERN historical simulation',
        body: {
          config: {
            equityAllocation: 'number (0.4-1.0), default 0.8',
            horizonYears: 'number (20-60), default 48',
            preserveFraction: 'number (0-1), default 0.5',
            glidepathEnabled: 'boolean, default false',
            annualSpend: 'number, default 50000',
            portfolio: 'number, default 1538050',
            statePensionAnnual: 'number, default 23000',
            statePensionStartAge: 'number, default 67',
            currentAge: 'number, default 42',
            gogoEnabled: 'boolean, default true',
            guardrailEnabled: 'boolean, default false',
            mcPaths: 'number (100-2000), default 500',
          },
          includeCohorts: 'boolean (optional, include per-cohort data)',
        },
      },
    },
  });
}
