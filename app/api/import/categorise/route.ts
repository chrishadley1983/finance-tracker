import { NextRequest, NextResponse } from 'next/server';
import {
  categoriseMultiple,
  calculateStats,
  type CategorisationResult,
  type CategorisationStats,
} from '@/lib/categorisation';
import type { ParsedTransaction } from '@/lib/types/import';

// =============================================================================
// TYPES
// =============================================================================

interface CategoriseRequest {
  sessionId: string;
  transactions: ParsedTransaction[];
}

interface CategoriseResponse {
  results: CategorisationResult[];
  stats: CategorisationStats;
}

// =============================================================================
// POST /api/import/categorise
// =============================================================================

/**
 * Categorise a batch of transactions using the multi-strategy engine.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: CategoriseRequest = await request.json();

    // Validate request
    if (!body.sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    if (!body.transactions || !Array.isArray(body.transactions)) {
      return NextResponse.json(
        { error: 'Transactions array is required' },
        { status: 400 }
      );
    }

    if (body.transactions.length === 0) {
      return NextResponse.json({
        results: [],
        stats: {
          total: 0,
          categorised: 0,
          uncategorised: 0,
          bySource: {
            rule_exact: 0,
            rule_pattern: 0,
            similar: 0,
            ai: 0,
            none: 0,
          },
          highConfidence: 0,
          lowConfidence: 0,
          aiUsed: 0,
        },
      } as CategoriseResponse);
    }

    // Convert ParsedTransaction to engine's format
    const engineTransactions = body.transactions.map((tx) => ({
      date: tx.date,
      description: tx.description,
      amount: tx.amount,
      reference: tx.reference,
    }));

    // Run categorisation engine
    const results = await categoriseMultiple(engineTransactions);
    const stats = calculateStats(results);

    const response: CategoriseResponse = {
      results,
      stats,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('POST /api/import/categorise error:', error);
    return NextResponse.json(
      { error: 'Failed to categorise transactions' },
      { status: 500 }
    );
  }
}
