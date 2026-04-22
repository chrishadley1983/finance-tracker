/**
 * Count-based import dedup.
 *
 * The rule: inside the CSV's date range, the CSV is the source of truth.
 * For every (date, amount, normalised description) tuple, the DB should
 * contain exactly as many rows as the CSV does.
 *
 * This avoids two bugs that the old hash-based approach had:
 *   1. Legitimate repeat transactions (e.g. two £8.80 TFL fares on the
 *      same day) hash to the same value; the UNIQUE constraint on the
 *      hash table let the first through and silently dropped the second.
 *   2. If a past import failed to record a hash (e.g. because the same
 *      hash had been claimed elsewhere), a subsequent import saw "no
 *      match" and inserted a duplicate transaction row.
 *
 * The count-based approach cares only about the final DB state: N copies
 * in CSV → N copies in DB. It's robust to partial prior imports, legit
 * same-day duplicates, and re-imports of the same file.
 */

export interface CountableTx {
  rowNumber: number;
  date: string;
  amount: number;
  description: string;
}

export interface ExistingRow {
  date: string;
  amount: number;
  description: string;
}

export interface DedupPlan<T extends CountableTx> {
  toInsert: T[];
  toSkip: T[];
}

/**
 * Normalise description so CSV export variants collide. Mirrors the
 * suffix-strip rules HSBC uses (")))", VIS, CR, DD, BP, etc.).
 */
export function normalizeDescription(desc: string): string {
  let n = desc.toLowerCase().trim().replace(/\s+/g, ' ');
  n = n.replace(/\s+\)+\s*$/, '');
  n = n.replace(/\s+(vis|cr|dd|dr|bp|obp|atm)\s*$/i, '');
  n = n.replace(/\s*\*\s*/g, '*');
  return n;
}

export function tupleKey(date: string, amount: number, description: string): string {
  return `${date}|${amount.toFixed(2)}|${normalizeDescription(description)}`;
}

/**
 * Decide which incoming rows to insert vs skip, given the existing DB
 * rows in the CSV's date range.
 *
 * Preserves CSV order within each tuple: if a tuple appears 3 times in
 * the CSV and 1 is already in DB, the first 2 CSV occurrences insert
 * and the 3rd skips.
 */
export function planImport<T extends CountableTx>(
  incoming: T[],
  existing: ExistingRow[],
): DedupPlan<T> {
  const existingCount = new Map<string, number>();
  existing.forEach((r) => {
    const k = tupleKey(r.date, Number(r.amount), r.description);
    existingCount.set(k, (existingCount.get(k) || 0) + 1);
  });

  const seenInBatch = new Map<string, number>();
  const toInsert: T[] = [];
  const toSkip: T[] = [];

  for (const tx of incoming) {
    const k = tupleKey(tx.date, tx.amount, tx.description);
    const dbHas = existingCount.get(k) ?? 0;
    const csvPositionForThisTuple = (seenInBatch.get(k) ?? 0) + 1;
    // CSV position N of this tuple needs DB to hold at least N rows of
    // this tuple. If DB already has ≥ N, this row is redundant.
    if (dbHas >= csvPositionForThisTuple) {
      toSkip.push(tx);
    } else {
      toInsert.push(tx);
    }
    seenInBatch.set(k, csvPositionForThisTuple);
  }

  return { toInsert, toSkip };
}
