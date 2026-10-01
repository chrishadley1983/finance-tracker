import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { requireAgentOrUser } from '@/lib/api/require-agent';
import { applyAnswers } from '@/lib/categorisation/answers';
import { InvalidCategoryError } from '@/lib/categorisation/apply';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const answersSchema = z.object({
  answers: z
    .array(
      z.object({
        transaction_ids: z.array(z.string().uuid()).min(1).max(500),
        category_id: z.string().uuid(),
        always: z.boolean().optional(),
      })
    )
    .min(1)
    .max(100),
});

/**
 * POST /api/categorisation/answers
 * Body: { answers: [{ transaction_ids: uuid[], category_id: uuid, always?: boolean }] }
 * Auth: x-api-key = FINANCE_AGENT_KEY (or a logged-in session).
 *
 * Applies each answer as a manual categorisation (corrections recorded,
 * review flag cleared); `always` also creates/updates the rule so future
 * transactions follow it. An unknown category id rejects the whole batch
 * (400, nothing written).
 *
 * → { results: [{ index, category_id, requested, applied, missing[], corrections,
 *                 rule?: { status, ruleId?, pattern?, effective?, reason? } }],
 *     recategorised: { examined, changed, cleared } | null }
 */
export async function POST(request: NextRequest) {
  const unauthorized = await requireAgentOrUser(request);
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json().catch(() => ({}));
    const { answers } = answersSchema.parse(body);
    const response = await applyAnswers(answers);
    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.issues }, { status: 400 });
    }
    if (error instanceof InvalidCategoryError) {
      return NextResponse.json({ error: error.message, categoryIds: error.categoryIds }, { status: 400 });
    }
    console.error('POST /api/categorisation/answers error:', error);
    return NextResponse.json({ error: 'Failed to apply answers' }, { status: 500 });
  }
}
