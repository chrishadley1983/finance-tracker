import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { executeImportRequestSchema } from '@/lib/validations/import';
import { deleteSessionData } from '@/lib/import';
import { planImport, tupleKey } from '@/lib/import/dedup';
import { ZodError } from 'zod';
import crypto from 'crypto';

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

type DbCategorisationSource = 'manual' | 'rule' | 'ai' | 'import';

function mapCategorisationSource(source: string | undefined): DbCategorisationSource {
  if (!source) return 'import';
  switch (source) {
    case 'manual': return 'manual';
    case 'rule_exact':
    case 'rule_pattern':
    case 'similar': return 'rule';
    case 'ai': return 'ai';
    default: return 'import';
  }
}

function hashFor(date: string, amount: number, description: string): string {
  return crypto.createHash('sha256').update(tupleKey(date, amount, description)).digest('hex');
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
    // rows the count-based dedup compares against.
    let existingRows: Array<{ date: string; amount: number; description: string }> = [];
    if (skipDuplicates && minDate && maxDate) {
      const { data, error: existingErr } = await supabaseAdmin
        .from('transactions')
        .select('date, amount, description')
        .eq('account_id', accountId)
        .gte('date', minDate)
        .lte('date', maxDate);
      if (existingErr) {
        return NextResponse.json({ error: `Failed to fetch existing rows: ${existingErr.message}` }, { status: 500 });
      }
      existingRows = (data || []).map((r) => ({
        date: r.date,
        amount: Number(r.amount),
        description: r.description,
      }));
    }

    // 4. Plan: for each (date, amount, normDesc) tuple, DB count must end
    // up equal to CSV count. Insert only the surplus.
    const { toInsert, toSkip } = skipDuplicates
      ? planImport(afterExplicitSkip, existingRows)
      : { toInsert: afterExplicitSkip, toSkip: [] as typeof afterExplicitSkip };

    const errors: ImportError[] = [];
    let imported = 0;
    let skipped = explicitSkipped + toSkip.length;

    for (const tx of toInsert) {
      const hasCategory = tx.categoryId && tx.categoryId !== null;
      const { data: newTransaction, error: insertError } = await supabaseAdmin
        .from('transactions')
        .insert({
          account_id: accountId,
          date: tx.date,
          amount: tx.amount,
          description: tx.description,
          category_id: hasCategory ? tx.categoryId : null,
          categorisation_source: mapCategorisationSource(tx.categorisationSource),
          needs_review: !hasCategory,
        })
        .select('id')
        .single();

      if (insertError) {
        errors.push({ row: tx.rowNumber, error: insertError.message });
        continue;
      }

      // Best-effort audit log. Unique-constraint violations are expected
      // when legitimate repeat transactions share a hash, so we don't
      // let them abort the import.
      try {
        const { error: hashErr } = await supabaseAdmin
          .from('imported_transaction_hashes')
          .insert({
            transaction_id: newTransaction.id,
            hash: hashFor(tx.date, tx.amount, tx.description),
            import_session_id: sessionId,
            source_row: tx.rawData,
          });
        if (hashErr && !hashErr.message?.includes('duplicate key')) {
          console.warn(`Hash audit log write failed for tx ${newTransaction.id}: ${hashErr.message}`);
        }
      } catch (e) {
        console.warn('Hash audit log threw:', e);
      }

      imported++;
    }

    // 5. Post-import verification: re-count DB and compare to CSV tuples.
    // If counts match for every tuple, the import is fully reconciled.
    const mismatches: VerificationMismatch[] = [];
    let dbRowsInRange = 0;

    // Build CSV-side counts once.
    const csvByKey = new Map<string, typeof afterExplicitSkip>();
    for (const tx of afterExplicitSkip) {
      const k = tupleKey(tx.date, tx.amount, tx.description);
      if (!csvByKey.has(k)) csvByKey.set(k, []);
      csvByKey.get(k)!.push(tx);
    }

    if (minDate && maxDate) {
      const { data: afterRows } = await supabaseAdmin
        .from('transactions')
        .select('date, amount, description')
        .eq('account_id', accountId)
        .gte('date', minDate)
        .lte('date', maxDate);
      dbRowsInRange = afterRows?.length ?? 0;

      const afterCount = new Map<string, number>();
      for (const r of afterRows || []) {
        const k = tupleKey(r.date, Number(r.amount), r.description);
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
