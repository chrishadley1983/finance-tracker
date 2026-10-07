import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({ supabaseAdmin: {} }));
import { importCategoryFields } from '@/lib/import/category-fields';
import { CONFIDENCE_REVIEW_THRESHOLD } from '@/lib/categorisation/engine';

const CAT = '00000000-0000-4000-8000-000000000003';

describe('importCategoryFields', () => {
  it('uncategorised rows need review', () => {
    expect(importCategoryFields({})).toEqual({
      category_id: null,
      categorisation_source: 'import',
      engine_source: null,
      categorisation_confidence: null,
      needs_review: true,
    });
  });

  it('uses the engine review threshold for automatic guesses', () => {
    const below = CONFIDENCE_REVIEW_THRESHOLD - 0.01;
    expect(importCategoryFields({ categoryId: CAT, categorisationSource: 'ai', categorisationConfidence: below }).needs_review).toBe(true);
    expect(
      importCategoryFields({ categoryId: CAT, categorisationSource: 'ai', categorisationConfidence: CONFIDENCE_REVIEW_THRESHOLD })
        .needs_review
    ).toBe(false);
  });

  it("respects the engine's own decision when sent", () => {
    expect(
      importCategoryFields({ categoryId: CAT, categorisationSource: 'policy_ask', categorisationConfidence: 0.99, needsReview: true })
    ).toMatchObject({ needs_review: true, categorisation_source: 'rule' });
  });

  it('maps policy sources to rule, like the sync paths do', () => {
    expect(importCategoryFields({ categoryId: CAT, categorisationSource: 'policy', categorisationConfidence: 0.95 })).toMatchObject({
      categorisation_source: 'rule',
      engine_source: 'policy',
      needs_review: false,
    });
  });

  it('manual choices are settled with full confidence', () => {
    expect(importCategoryFields({ categoryId: CAT, categorisationSource: 'manual' })).toMatchObject({
      needs_review: false,
      categorisation_confidence: 1,
      categorisation_source: 'manual',
    });
  });
});
