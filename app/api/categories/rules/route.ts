import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getRules,
  createRule,
  testRule,
  checkPatternExists,
  getRuleStats,
} from '@/lib/categorisation/rules-manager';

// =============================================================================
// SCHEMAS
// =============================================================================

const createRuleSchema = z.object({
  pattern: z.string().min(1).max(500),
  categoryId: z.string().uuid(),
  matchType: z.enum(['exact', 'contains', 'regex']),
  confidence: z.number().min(0).max(1).optional(),
  notes: z.string().max(1000).optional(),
});

const testRuleSchema = z.object({
  pattern: z.string().min(1).max(500),
  matchType: z.enum(['exact', 'contains', 'regex']),
  categoryId: z.string().uuid(),
  limit: z.number().min(1).max(100).optional(),
});

// =============================================================================
// GET /api/categories/rules
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const categoryId = searchParams.get('categoryId');
    const isSystem = searchParams.get('isSystem');
    const stats = searchParams.get('stats');

    // Return stats if requested
    if (stats === 'true') {
      const ruleStats = await getRuleStats();
      return NextResponse.json(ruleStats);
    }

    const options: { categoryId?: string; isSystem?: boolean } = {};

    if (categoryId) {
      options.categoryId = categoryId;
    }

    if (isSystem !== null) {
      options.isSystem = isSystem === 'true';
    }

    const rules = await getRules(options);

    return NextResponse.json({ rules });
  } catch (error) {
    console.error('GET /api/categories/rules error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// =============================================================================
// POST /api/categories/rules
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action;

    // Handle test action
    if (action === 'test') {
      const validated = testRuleSchema.parse(body);

      const result = await testRule(
        validated.pattern,
        validated.matchType,
        validated.categoryId,
        validated.limit
      );

      return NextResponse.json(result);
    }

    // Handle check action (check if pattern exists)
    if (action === 'check') {
      const { pattern, matchType } = z
        .object({
          pattern: z.string(),
          matchType: z.enum(['exact', 'contains', 'regex']),
        })
        .parse(body);

      const existing = await checkPatternExists(pattern, matchType);

      return NextResponse.json({
        exists: !!existing,
        rule: existing,
      });
    }

    // Default: create rule
    const validated = createRuleSchema.parse(body);

    // Check if pattern already exists
    const existing = await checkPatternExists(validated.pattern, validated.matchType);
    if (existing) {
      return NextResponse.json(
        {
          error: 'Pattern already exists',
          existingRule: existing,
        },
        { status: 409 }
      );
    }

    const rule = await createRule(validated);

    if (!rule) {
      return NextResponse.json({ error: 'Failed to create rule' }, { status: 500 });
    }

    return NextResponse.json(rule, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    console.error('POST /api/categories/rules error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
