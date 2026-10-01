/**
 * Apply manual categorisations
 *
 * The one path every human decision goes through (inline edit, bulk edit,
 * review queue, Peter's answers): set the category, promote the row to
 * `manual`, clear the review flag, and record a correction for every row
 * whose auto-assigned category was overridden — that is what the learning
 * loop (rule supersession, AI context, correction-rate metric) reads.
 */

import { supabaseAdmin } from '@/lib/supabase/server';

export interface ApplyItem {
  transactionIds: string[];
  categoryId: string;
}

export interface ApplyOptions {
  /**
   * Also mark the rows `is_validated = true` — Chris has confirmed them
   * (Peter's digest answers, the finance-recategorise skill). A row whose
   * category already matches is then a pure confirmation: validated, no
   * correction recorded.
   */
  validate?: boolean;
}

export interface ApplyItemResult {
  categoryId: string;
  requested: number;
  applied: number;
  /** Requested ids that don't exist. */
  missing: string[];
  /** Corrections recorded (auto category overridden). */
  corrections: number;
  /** Rows marked validated (only with `validate`). */
  validated: number;
}

export class InvalidCategoryError extends Error {
  constructor(public readonly categoryIds: string[]) {
    super(`Unknown category id(s): ${categoryIds.join(', ')}`);
    this.name = 'InvalidCategoryError';
  }
}

interface BeforeRow {
  id: string;
  description: string;
  category_id: string | null;
  categorisation_source: string | null;
}

const CHUNK = 200;

function chunks<T>(arr: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Throws InvalidCategoryError if any id isn't a real category. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function assertCategoriesExist(categoryIds: string[]): Promise<void> {
  const unique = Array.from(new Set(categoryIds));
  if (unique.length === 0) return;
  // A non-UUID would make Postgres reject the whole query — it's simply unknown.
  const malformed = unique.filter((id) => !UUID_RE.test(id));
  if (malformed.length > 0) throw new InvalidCategoryError(malformed);
  const { data, error } = await supabaseAdmin.from('categories').select('id').in('id', unique);
  if (error) throw new Error(`Failed to read categories: ${error.message}`);
  const found = new Set((data ?? []).map((c) => c.id));
  const missing = unique.filter((id) => !found.has(id));
  if (missing.length > 0) throw new InvalidCategoryError(missing);
}

async function readBefore(ids: string[]): Promise<Map<string, BeforeRow>> {
  const out = new Map<string, BeforeRow>();
  for (const part of chunks(ids)) {
    const { data, error } = await supabaseAdmin
      .from('transactions')
      .select('id, description, category_id, categorisation_source')
      .in('id', part);
    if (error) throw new Error(`Failed to read transactions: ${error.message}`);
    for (const r of (data ?? []) as BeforeRow[]) out.set(r.id, r);
  }
  return out;
}

/**
 * Validate everything first (all categories must exist), then apply. An
 * invalid category rejects the whole batch with nothing written.
 */
export async function applyManualCategories(items: ApplyItem[], opts: ApplyOptions = {}): Promise<ApplyItemResult[]> {
  await assertCategoriesExist(items.map((i) => i.categoryId));

  const allIds = Array.from(new Set(items.flatMap((i) => i.transactionIds)));
  const before = await readBefore(allIds);

  const results: ApplyItemResult[] = [];
  for (const item of items) {
    const ids = Array.from(new Set(item.transactionIds));
    const present = ids.filter((id) => before.has(id));
    const missing = ids.filter((id) => !before.has(id));

    let applied = 0;
    for (const part of chunks(present)) {
      const { data, error } = await supabaseAdmin
        .from('transactions')
        .update({
          category_id: item.categoryId,
          categorisation_source: 'manual',
          needs_review: false,
          ...(opts.validate ? { is_validated: true } : {}),
        })
        .in('id', part)
        .select('id');
      if (error) throw new Error(`Failed to update transactions: ${error.message}`);
      applied += data?.length ?? 0;
    }

    const corrections = present
      .map((id) => before.get(id)!)
      .filter((r) => r.categorisation_source !== 'manual' && r.category_id !== item.categoryId)
      .map((r) => ({
        transaction_id: r.id,
        description: r.description,
        original_category_id: r.category_id,
        corrected_category_id: item.categoryId,
        original_source: r.categorisation_source,
      }));
    let recorded = 0;
    if (corrections.length > 0) {
      const { data, error } = await supabaseAdmin.from('category_corrections').insert(corrections).select('id');
      if (error) {
        // The user's change stands; a lost correction only weakens learning.
        console.warn('Failed to record corrections:', error.message);
      } else {
        recorded = data?.length ?? 0;
      }
    }

    // Keep the in-memory snapshot current so a later item touching the same
    // row sees it as manual (no double correction).
    for (const id of present) {
      const r = before.get(id)!;
      before.set(id, { ...r, category_id: item.categoryId, categorisation_source: 'manual' });
    }

    results.push({
      categoryId: item.categoryId,
      requested: ids.length,
      applied,
      missing,
      corrections: recorded,
      validated: opts.validate ? applied : 0,
    });
  }
  return results;
}
