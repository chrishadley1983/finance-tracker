import { NextRequest, NextResponse } from 'next/server';
import { simulateRequestSchema } from '@/lib/types/fire';
import { runHistoricalSimulations } from '@/lib/fire/historical-simulator';

/**
 * POST /api/fire/simulate
 *
 * Run historical simulations with the provided configuration.
 * Returns success rates, percentiles, and individual simulation results.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body
    const parsed = simulateRequestSchema.safeParse(body);
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

    // Run simulations
    const results = runHistoricalSimulations(config);

    // Return results (excluding full yearly data to reduce payload)
    const response = {
      ...results,
      simulations: results.simulations.map(sim => ({
        startYear: sim.startYear,
        endYear: sim.endYear,
        success: sim.success,
        failureYear: sim.failureYear,
        yearsLasted: sim.yearsLasted,
        finalPortfolioValue: sim.finalPortfolioValue,
        finalPortfolioReal: sim.finalPortfolioReal,
        minimumPortfolioValue: sim.minimumPortfolioValue,
        minimumPortfolioYear: sim.minimumPortfolioYear,
        totalWithdrawals: sim.totalWithdrawals,
        averageAnnualWithdrawal: sim.averageAnnualWithdrawal,
        // Include yearly data only if specifically requested
        yearlyData: body.includeYearlyData ? sim.yearlyData : undefined,
      })),
    };

    return NextResponse.json(response);
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
 * Returns information about available simulation parameters.
 */
export async function GET() {
  return NextResponse.json({
    description: 'Historical FIRE simulation API',
    methods: {
      POST: {
        description: 'Run historical simulations',
        body: {
          config: {
            retirementDuration: 'number (1-60), default 30',
            stockAllocation: 'number (0-100), default 75',
            bondAllocation: 'number (0-100), default 25',
            withdrawalStrategy: "'constant_dollar' | 'percent_of_portfolio'",
            initialWithdrawalRate: 'number (0.5-15), default 4',
            initialPortfolio: 'number (required)',
            extraIncome: 'ExtraIncomeSource[]',
            currentAge: 'number (18-100, required)',
          },
          includeYearlyData: 'boolean (optional, include full yearly data)',
        },
      },
    },
    dataRange: {
      firstYear: 1928,
      lastYear: 2024,
      note: 'Data from NYU Stern (Damodaran) and US Inflation Calculator',
    },
  });
}
