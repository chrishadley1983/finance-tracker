import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { previewRuleApply, applyRuleToExisting, RuleNotFoundError } from '@/lib/categorisation/rule-apply';
import { InvalidCategoryError } from '@/lib/categorisation/apply';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const idSchema = z.string().uuid();
type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/categories/rules/[id]/apply
 * Preview: how many uncategorised / in-review transactions this rule would
 * categorise (manual and validated rows are never counted).
 * → { rule, eligible, uncategorised, inReview, sample[], applicable }
 */
export async function GET(_request: NextRequest, { params }: Params) {
  const parsed = idSchema.safeParse((await params).id);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid rule id' }, { status: 400 });
  try {
    return NextResponse.json(await previewRuleApply(parsed.data));
  } catch (error) {
    if (error instanceof RuleNotFoundError) return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    console.error('GET /api/categories/rules/[id]/apply error:', error);
    return NextResponse.json({ error: 'Could not check this rule' }, { status: 500 });
  }
}

/**
 * POST /api/categories/rules/[id]/apply
 * Applies the rule to the same set the preview counts (re-checked here), via
 * the answers path: rows become manual + validated, review flag cleared.
 * → { applied, categoryId, categoryName }
 */
export async function POST(_request: NextRequest, { params }: Params) {
  const parsed = idSchema.safeParse((await params).id);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid rule id' }, { status: 400 });
  try {
    return NextResponse.json(await applyRuleToExisting(parsed.data));
  } catch (error) {
    if (error instanceof RuleNotFoundError) return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    if (error instanceof InvalidCategoryError) {
      return NextResponse.json({ error: "The rule's category no longer exists" }, { status: 400 });
    }
    console.error('POST /api/categories/rules/[id]/apply error:', error);
    return NextResponse.json({ error: 'Could not apply the rule' }, { status: 500 });
  }
}
