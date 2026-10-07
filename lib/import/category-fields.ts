import {
  CONFIDENCE_REVIEW_THRESHOLD,
  toDbCategorisationSource,
} from '@/lib/categorisation/engine';
import type { ParsedTransaction } from '@/lib/validations/import';

/**
 * Category columns for a row being imported, matching what the bank-sync and
 * re-categorisation paths write via `toTransactionCategoryFields`:
 * low-confidence or policy-"ask" guesses land in the review queue instead of
 * being treated as settled, and the confidence is kept for later review.
 */
export function importCategoryFields(
  tx: Pick<
    ParsedTransaction,
    'categoryId' | 'categorisationSource' | 'categorisationConfidence' | 'needsReview'
  >
) {
  const categoryId = tx.categoryId || null;
  const source = tx.categorisationSource;
  const isManual = source === 'manual';
  const confidence = categoryId
    ? isManual
      ? 1
      : tx.categorisationConfidence ?? null
    : null;

  const needsReview =
    !categoryId ||
    (!isManual &&
      (tx.needsReview ?? (confidence === null || confidence < CONFIDENCE_REVIEW_THRESHOLD)));

  return {
    category_id: categoryId,
    categorisation_source: isManual ? ('manual' as const) : source ? toDbCategorisationSource(source) : 'import',
    engine_source: source ?? null,
    categorisation_confidence: confidence,
    needs_review: needsReview,
  };
}
