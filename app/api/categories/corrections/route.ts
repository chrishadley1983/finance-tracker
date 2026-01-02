import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  recordCorrection,
  recordCorrectionsBatch,
  analyseCorrections,
  checkForSuggestions,
  getCorrectionsForDescription,
} from '@/lib/categorisation/learning';
import { createRuleFromSuggestion } from '@/lib/categorisation/rules-manager';

// =============================================================================
// SCHEMAS
// =============================================================================

const correctionSchema = z.object({
  description: z.string().min(1),
  originalCategoryId: z.string().uuid().nullable(),
  correctedCategoryId: z.string().uuid(),
  originalSource: z.string().nullable().optional().transform(val => val ?? null),
  importSessionId: z.string().uuid().optional(),
});

const batchCorrectionsSchema = z.object({
  corrections: z.array(correctionSchema),
});

const createRuleFromSuggestionSchema = z.object({
  pattern: z.string().min(1),
  matchType: z.enum(['exact', 'contains']),
  categoryId: z.string().uuid(),
  categoryName: z.string(),
  correctionCount: z.number(),
  confidence: z.number(),
  correctionIds: z.array(z.string().uuid()),
  notes: z.string().optional(),
});

// =============================================================================
// GET /api/categories/corrections
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');
    const description = searchParams.get('description');

    // Check for suggestions
    if (action === 'suggestions') {
      const analysis = await analyseCorrections();
      return NextResponse.json(analysis);
    }

    // Check if there are any pending suggestions (lightweight check)
    if (action === 'check') {
      const result = await checkForSuggestions();
      return NextResponse.json(result);
    }

    // Get corrections for a specific description
    if (description) {
      const corrections = await getCorrectionsForDescription(description);
      return NextResponse.json({ corrections });
    }

    // Default: return full analysis
    const analysis = await analyseCorrections();
    return NextResponse.json(analysis);
  } catch (error) {
    console.error('GET /api/categories/corrections error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// =============================================================================
// POST /api/categories/corrections
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action;

    // Handle create rule from suggestion
    if (action === 'createRule') {
      const validated = createRuleFromSuggestionSchema.parse(body);

      const rule = await createRuleFromSuggestion(
        {
          pattern: validated.pattern,
          matchType: validated.matchType,
          categoryId: validated.categoryId,
          categoryName: validated.categoryName,
          correctionCount: validated.correctionCount,
          confidence: validated.confidence,
          sampleDescriptions: [],
        },
        validated.correctionIds,
        validated.notes
      );

      if (!rule) {
        return NextResponse.json({ error: 'Failed to create rule' }, { status: 500 });
      }

      return NextResponse.json({ rule }, { status: 201 });
    }

    // Handle batch corrections
    if (body.corrections && Array.isArray(body.corrections)) {
      const validated = batchCorrectionsSchema.parse(body);

      const result = await recordCorrectionsBatch(validated.corrections);

      return NextResponse.json(result, { status: 201 });
    }

    // Handle single correction
    const validated = correctionSchema.parse(body);

    const result = await recordCorrection(validated);

    if (!result) {
      return NextResponse.json({ error: 'Failed to record correction' }, { status: 500 });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    console.error('POST /api/categories/corrections error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
