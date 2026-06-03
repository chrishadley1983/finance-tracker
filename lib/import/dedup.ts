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
 * suffix-strip rules HSBC uses (")))", VIS, CR, DD, BP, etc.) and
 * strips a trailing user annotation of the form " - <note>" so that
 * a DB row hand-edited to "AMAZON UK* NB3T26C LONDON VIS - Mouse"
 * still matches the canonical CSV row "AMAZON UK* NB3T26C LONDON VIS".
 */
export function normalizeDescription(desc: string): string {
  let n = desc.toLowerCase().trim().replace(/\s+/g, ' ');
  // Strip trailing " - <annotation>" before suffix strips, since the
  // annotation typically follows VIS/)))/etc.
  n = n.replace(/\s+-\s+.+$/, '');
  n = n.replace(/\s+\)+\s*$/, '');
  n = n.replace(/\s+(vis|cr|dd|dr|bp|obp|atm)\s*$/i, '');
  n = n.replace(/\s*\*\s*/g, '*');
  return n;
}

export function tupleKey(date: string, amount: number, description: string): string {
  return `${date}|${amount.toFixed(2)}|${normalizeDescription(description)}`;
}

/**
 * Core count-based planner, keyed on opaque strings. Callers supply the
 * key for each incoming row and the keys of the existing DB rows. As long
 * as both sides live in the same key space, the planner is agnostic about
 * how the keys are derived.
 *
 * Preserves CSV order within each key: if a key appears 3 times in the CSV
 * and 1 is already in DB, the first 2 CSV occurrences insert and the 3rd
 * skips.
 */
export function planImportWithKeys<T extends CountableTx>(
  incoming: T[],
  incomingKeyOf: (tx: T) => string,
  existingKeys: string[],
): DedupPlan<T> {
  const existingCount = new Map<string, number>();
  for (const k of existingKeys) {
    existingCount.set(k, (existingCount.get(k) || 0) + 1);
  }

  const seenInBatch = new Map<string, number>();
  const toInsert: T[] = [];
  const toSkip: T[] = [];

  for (const tx of incoming) {
    const k = incomingKeyOf(tx);
    const dbHas = existingCount.get(k) ?? 0;
    const csvPositionForThisTuple = (seenInBatch.get(k) ?? 0) + 1;
    // CSV position N of this key needs DB to hold at least N rows of this
    // key. If DB already has ≥ N, this row is redundant.
    if (dbHas >= csvPositionForThisTuple) {
      toSkip.push(tx);
    } else {
      toInsert.push(tx);
    }
    seenInBatch.set(k, csvPositionForThisTuple);
  }

  return { toInsert, toSkip };
}

/**
 * Decide which incoming rows to insert vs skip, given the existing DB
 * rows in the CSV's date range. Keys both sides on the live
 * (date, amount, normalised description) tuple.
 *
 * NOTE: keying on the live description means a DB row that the user has
 * renamed (e.g. "BCA Remarketing So BN22 YFL BP" → "Car Purchase") will
 * no longer match its CSV counterpart, so a re-import duplicates it. The
 * import route avoids this by keying existing rows on their *original*
 * import hash (see planImportWithKeys); this tuple-keyed variant is kept
 * for callers/tests that work purely from descriptions.
 */
export function planImport<T extends CountableTx>(
  incoming: T[],
  existing: ExistingRow[],
): DedupPlan<T> {
  return planImportWithKeys(
    incoming,
    (tx) => tupleKey(tx.date, tx.amount, tx.description),
    existing.map((r) => tupleKey(r.date, Number(r.amount), r.description)),
  );
}
