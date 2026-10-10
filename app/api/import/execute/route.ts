import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { executeImportRequestSchema } from '@/lib/validations/import';
import { deleteSessionData } from '@/lib/import';
import { planImportWithKeys, importHash, matchAgainstBankFeed } from '@/lib/import/dedup';
import { pageAll } from '@/lib/supabase/page-all';
import { importCategoryFields } from '@/lib/import/category-fields';
import { ZodError } from 'zod';

interface ImportError {
  row: number;
  error: string;
}

interface VerificationMismatch {
  date: string;
  amount: number;
  description: string;
  csvCount: number;
  dbCount: number;
  kind: 'surplus' | 'missing';
}

const hashFor = importHash;

/** Bank-feed rows can be dated up to this many days from the statement's booking date. */
const FEED_TOLERANCE_DAYS = 3;
const shiftDays = (d: string, days: number) =>
  new Date(new Date(`${d}T00:00:00Z`).getTime() + days * 86_400_000).toISOString().slice(0, 10);

/**
 * Populate `into` with transactionId → original import hash for the given
 * transaction ids. Batched to stay within PostgREST's URL length limits.
 * Where a transaction has multiple hash rows (re-hashes), the first wins —
 * they share the same date/amount/description so the hash is identical.
 */
async function loadOriginalHashes(ids: string[], into: Map<string, string>): Promise<void> {
  const CHUNK = 500;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const batch = ids.slice(i, i + CHUNK);
    if (batch.length === 0) continue;
    const { data: hashRows, error: hashErr } = await supabaseAdmin
      .from('imported_transaction_hashes')
      .select('transaction_id, hash')
      .in('transaction_id', batch);
    if (hashErr) {
      // Without original hashes, dedup silently falls back to keying on the
      // (editable) live description — reintroducing the duplicate-on-rename
      // bug this lookup exists to prevent. Surface it rather than degrade quietly.
      console.warn(`loadOriginalHashes: failed to fetch original import hashes: ${hashErr.message}`);
    }
    for (const h of hashRows || []) {
      if (h.transaction_id && !into.has(h.transaction_id)) into.set(h.transaction_id, h.hash);
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = executeImportRequestSchema.parse(body);
    const { sessionId, transactions, accountId, skipDuplicates, duplicateRowsToSkip } = validated;

    // 1. Verify session and account
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('import_sessions')
      .select('id, status')
      .eq('id', sessionId)
      .single();
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Import session not found' }, { status: 404 });
    }
    if (session.status === 'completed') {
      return NextResponse.json({ error: 'This import session has already been completed' }, { status: 400 });
    }

    const { data: account, error: accountError } = await supabaseAdmin
      .from('accounts')
      .select('id')
      .eq('id', accountId)
      .single();
    if (accountError || !account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    await supabaseAdmin
      .from('import_sessions')
      .update({ status: 'processing', account_id: accountId, started_at: new Date().toISOString() })
      .eq('id', sessionId);

    // 2. Honour the user's explicit row-skip list and pre-compute the CSV date range.
    const skipRowSet = new Set(duplicateRowsToSkip || []);
    const afterExplicitSkip = transactions.filter((tx) => !skipRowSet.has(tx.rowNumber));
    const explicitSkipped = transactions.length - afterExplicitSkip.length;

    let minDate: string | null = null;
    let maxDate: string | null = null;
    for (const tx of afterExplicitSkip) {
      if (!minDate || tx.date < minDate) minDate = tx.date;
      if (!maxDate || tx.date > maxDate) maxDate = tx.date;
    }

    // 3. Fetch existing DB rows in the CSV's date range — these are the
    // rows the count-based dedup compares against. We also pull each row's
    // *original* import hash so dedup is immune to later user edits: a row
    // the user renamed (e.g. "BCA Remarketing..." → "Car Purchase") still
    // matches its CSV counterpart because the stored hash reflects the
    // description at import time, not the current one.
    // Paged: Supabase caps a response at 1,000 rows, and a truncated read makes every unseen
    // row look missing, so a large re-import would insert duplicates. Widened by the feed
    // tolerance so the bank-feed pass (4b) can see feed rows just outside the CSV's range.
    let existingRows: Array<{ id: string; date: string; amount: number; description: string; bankRef: string | null }> = [];
    const existingHashById = new Map<string, string>();
    if (skipDuplicates && minDate && maxDate) {
      try {
        const data = await pageAll<{ id: string; date: string; amount: number; description: string; hsbc_transaction_id: string | null }>(
          (from, to) =>
            supabaseAdmin
              .from('transactions')
              .select('id, date, amount, description, hsbc_transaction_id')
              .eq('account_id', accountId)
              .gte('date', shiftDays(minDate, -FEED_TOLERANCE_DAYS))
              .lte('date', shiftDays(maxDate, FEED_TOLERANCE_DAYS))
              .order('id')
              .range(from, to),
        );
        existingRows = data.map((r) => ({
          id: r.id,
          date: r.date,
          amount: Number(r.amount),
          description: r.description,
          bankRef: r.hsbc_transaction_id,
        }));
      } catch (e) {
        return NextResponse.json(
          { error: `Failed to fetch existing rows: ${e instanceof Error ? e.message : String(e)}` },
          { status: 500 },
        );
      }
      await loadOriginalHashes(existingRows.map((r) => r.id), existingHashById);
    }

    // Key an existing DB row on its original import hash when available,
    // otherwise fall back to the live (date, amount, normDesc) tuple hash
    // (for manually-added rows, or imports predating hash tracking).
    const dbKeyOf = (r: { id: string; date: string; amount: number; description: string }): string =>
      existingHashById.get(r.id) ?? hashFor(r.date, r.amount, r.description);
    const incomingKeyOf = (tx: { date: string; amount: number; description: string }): string =>
      hashFor(tx.date, tx.amount, tx.description);

    // 4. Plan: for each key, DB count must end up equal to CSV count.
    // Insert only the surplus.
    // The hash pass compares against rows inside the CSV's own range only.
    const inRange = existingRows.filter((r) => r.date >= minDate! && r.date <= maxDate!);
    const hashPlan = skipDuplicates
      ? planImportWithKeys(afterExplicitSkip, incomingKeyOf, inRange.map(dbKeyOf))
      : { toInsert: afterExplicitSkip, toSkip: [] as typeof afterExplicitSkip };

    // 4b. Bank-feed pass: rows the hash pass would insert, matched on amount within ±3 days
    // against bank-synced rows that the hash pass has not already accounted for.
    let toInsert = hashPlan.toInsert;
    let feedMatched: typeof afterExplicitSkip = [];
    if (skipDuplicates) {
      const csvCountByKey = new Map<string, number>();
      for (const tx of afterExplicitSkip) {
        const k = incomingKeyOf(tx);
        csvCountByKey.set(k, (csvCountByKey.get(k) ?? 0) + 1);
      }
      const consumed = new Map<string, number>();
      const unclaimedFeed = existingRows.filter((r) => {
        if (!r.bankRef) return false;
        if (r.date < minDate! || r.date > maxDate!) return true; // outside the CSV range: never hash-matched
        const k = dbKeyOf(r);
        const used = consumed.get(k) ?? 0;
        if (used < (csvCountByKey.get(k) ?? 0)) {
          consumed.set(k, used + 1);
          return false; // already matched by hash
        }
        return true;
      });
      const feedPlan = matchAgainstBankFeed(hashPlan.toInsert, unclaimedFeed, FEED_TOLERANCE_DAYS);
      toInsert = feedPlan.toInsert;
      feedMatched = feedPlan.matchedToFeed;
    }
    const toSkip = [...hashPlan.toSkip, ...feedMatched];
    const feedMatchedSet = new Set<(typeof afterExplicitSkip)[number]>(feedMatched);

    const errors: ImportError[] = [];
    let imported = 0;
    let skipped = explicitSkipped + toSkip.length;

    // Insert in chunks; if a chunk fails, retry its rows one at a time so a
    // single bad row is reported against its row number instead of failing
    // the whole chunk.
    const INSERT_CHUNK = 200;
    const rowFor = (tx: (typeof toInsert)[number]) => ({
      account_id: accountId,
      date: tx.date,
      amount: tx.amount,
      description: tx.description,
      ...importCategoryFields(tx),
    });
    const inserted: Array<{ tx: (typeof toInsert)[number]; id: string }> = [];

    for (let i = 0; i < toInsert.length; i += INSERT_CHUNK) {
      const chunk = toInsert.slice(i, i + INSERT_CHUNK);
      const { data: rows, error: chunkError } = await supabaseAdmin
        .from('transactions')
        .insert(chunk.map(rowFor))
        .select('id');

      if (!chunkError && rows && rows.length === chunk.length) {
        rows.forEach((r, j) => inserted.push({ tx: chunk[j], id: r.id }));
        continue;
      }

      for (const tx of chunk) {
        const { data: one, error: oneError } = await supabaseAdmin
          .from('transactions')
          .insert(rowFor(tx))
          .select('id')
          .single();
        if (oneError || !one) {
          errors.push({ row: tx.rowNumber, error: oneError?.message ?? 'Insert failed' });
        } else {
          inserted.push({ tx, id: one.id });
        }
      }
    }
    imported = inserted.length;

    // Best-effort audit log. Unique-constraint violations are expected when
    // legitimate repeat transactions share a hash, so they never abort the
    // import; on a chunk failure fall back to row-by-row so one duplicate
    // hash doesn't drop the rest.
    for (let i = 0; i < inserted.length; i += INSERT_CHUNK) {
      const hashRows = inserted.slice(i, i + INSERT_CHUNK).map(({ tx, id }) => ({
        transaction_id: id,
        hash: hashFor(tx.date, tx.amount, tx.description),
        import_session_id: sessionId,
        source_row: tx.rawData,
      }));
      try {
        const { error: hashErr } = await supabaseAdmin.from('imported_transaction_hashes').insert(hashRows);
        if (!hashErr) continue;
        for (const row of hashRows) {
          const { error: oneErr } = await supabaseAdmin.from('imported_transaction_hashes').insert(row);
          if (oneErr && !oneErr.message?.includes('duplicate key')) {
            console.warn(`Hash audit log write failed for tx ${row.transaction_id}: ${oneErr.message}`);
          }
        }
      } catch (e) {
        console.warn('Hash audit log threw:', e);
      }
    }

    // 5. Post-import verification: re-count DB and compare to CSV tuples.
    // If counts match for every tuple, the import is fully reconciled.
    const mismatches: VerificationMismatch[] = [];
    let dbRowsInRange = 0;

    // Build CSV-side counts once, keyed the same way as dedup (hash space).
    const csvByKey = new Map<string, typeof afterExplicitSkip>();
    for (const tx of afterExplicitSkip) {
      if (feedMatchedSet.has(tx)) continue; // held by a bank-feed row under a different hash
      const k = incomingKeyOf(tx);
      if (!csvByKey.has(k)) csvByKey.set(k, []);
      csvByKey.get(k)!.push(tx);
    }

    if (minDate && maxDate) {
      const afterRows = await pageAll<{ id: string; date: string; amount: number; description: string }>((from, to) =>
        supabaseAdmin
          .from('transactions')
          .select('id, date, amount, description')
          .eq('account_id', accountId)
          .gte('date', minDate)
          .lte('date', maxDate)
          .order('id')
          .range(from, to),
      ).catch((e: unknown) => {
        console.warn(`Post-import verification read failed: ${e instanceof Error ? e.message : String(e)}`);
        return null;
      });
      dbRowsInRange = afterRows?.length ?? 0;

      const afterHashById = new Map<string, string>();
      await loadOriginalHashes((afterRows || []).map((r) => r.id), afterHashById);

      const afterCount = new Map<string, number>();
      for (const r of afterRows || []) {
        const k = afterHashById.get(r.id) ?? hashFor(r.date, Number(r.amount), r.description);
        afterCount.set(k, (afterCount.get(k) || 0) + 1);
      }

      Array.from(csvByKey.entries()).forEach(([k, rows]) => {
        const dbCount = afterCount.get(k) ?? 0;
        if (rows.length > dbCount) {
          const sample = rows[0];
          mismatches.push({
            date: sample.date,
            amount: sample.amount,
            description: sample.description,
            csvCount: rows.length,
            dbCount,
            kind: 'missing',
          });
        }
      });
      Array.from(afterCount.entries()).forEach(([k, count]) => {
        const csvCount = csvByKey.get(k)?.length ?? 0;
        if (csvCount > 0 && count > csvCount) {
          const sample = csvByKey.get(k)![0];
          mismatches.push({
            date: sample.date,
            amount: sample.amount,
            description: sample.description,
            csvCount,
            dbCount: count,
            kind: 'surplus',
          });
        }
      });
    }

    const finalStatus = errors.length === transactions.length ? 'failed' : 'completed';
    await supabaseAdmin
      .from('import_sessions')
      .update({
        status: finalStatus,
        imported_count: imported,
        duplicate_count: skipped,
        error_count: errors.length,
        error_details: errors.length > 0 ? (errors as unknown as import('@/lib/supabase/database.types').Json) : null,
        completed_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    deleteSessionData(sessionId);

    return NextResponse.json({
      success: errors.length < transactions.length,
      imported,
      skipped,
      failed: errors.length,
      errors,
      importSessionId: sessionId,
      verification: {
        dateRange: minDate && maxDate ? { min: minDate, max: maxDate } : null,
        csvRows: transactions.length - explicitSkipped,
        dbRowsInRange,
        mismatches,
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Invalid request body', details: error.issues }, { status: 400 });
    }
    console.error('Import execute error:', error);
    return NextResponse.json({ error: 'Failed to execute import' }, { status: 500 });
  }
}
