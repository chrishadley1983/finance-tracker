import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { executeImportRequestSchema } from '@/lib/validations/import';
import { deleteSessionData } from '@/lib/import';
import { ZodError } from 'zod';
import crypto from 'crypto';

interface ImportError {
  row: number;
  error: string;
}

/**
 * Generate a hash for duplicate detection.
 */
function generateTransactionHash(date: string, amount: number, description: string): string {
  const normalizedDesc = description.toLowerCase().trim().replace(/\s+/g, ' ');
  const data = `${date}|${amount.toFixed(2)}|${normalizedDesc}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = executeImportRequestSchema.parse(body);

    const { sessionId, transactions, accountId, skipDuplicates, duplicateRowsToSkip } = validated;

    // Verify session exists
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('import_sessions')
      .select('id, status')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Import session not found' },
        { status: 404 }
      );
    }

    if (session.status === 'completed') {
      return NextResponse.json(
        { error: 'This import session has already been completed' },
        { status: 400 }
      );
    }

    // Verify account exists
    const { data: account, error: accountError } = await supabaseAdmin
      .from('accounts')
      .select('id')
      .eq('id', accountId)
      .single();

    if (accountError || !account) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    // Update session status to processing
    await supabaseAdmin
      .from('import_sessions')
      .update({
        status: 'processing',
        account_id: accountId,
        started_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    const skipRowSet = new Set(duplicateRowsToSkip || []);
    const errors: ImportError[] = [];
    let imported = 0;
    let skipped = 0;

    // Get existing hashes if we need to skip duplicates
    let existingHashSet = new Set<string>();
    if (skipDuplicates) {
      const hashes = transactions.map((tx) =>
        generateTransactionHash(tx.date, tx.amount, tx.description)
      );

      const { data: existingHashes } = await supabaseAdmin
        .from('imported_transaction_hashes')
        .select('hash')
        .in('hash', hashes);

      existingHashSet = new Set((existingHashes || []).map((h) => h.hash));
    }

    // Process each transaction
    for (const tx of transactions) {
      // Skip if in skip list
      if (skipRowSet.has(tx.rowNumber)) {
        skipped++;
        continue;
      }

      const hash = generateTransactionHash(tx.date, tx.amount, tx.description);

      // Skip if duplicate and skipDuplicates is true
      if (skipDuplicates && existingHashSet.has(hash)) {
        skipped++;
        continue;
      }

      try {
        // Insert transaction - flag for review since no category assigned
        const { data: newTransaction, error: insertError } = await supabaseAdmin
          .from('transactions')
          .insert({
            account_id: accountId,
            date: tx.date,
            amount: tx.amount,
            description: tx.description,
            categorisation_source: 'import',
            needs_review: true,
          })
          .select('id')
          .single();

        if (insertError) {
          errors.push({
            row: tx.rowNumber,
            error: insertError.message,
          });
          continue;
        }

        // Insert hash for duplicate tracking
        await supabaseAdmin
          .from('imported_transaction_hashes')
          .insert({
            transaction_id: newTransaction.id,
            hash,
            import_session_id: sessionId,
            source_row: tx.rawData,
          });

        imported++;
      } catch (err) {
        errors.push({
          row: tx.rowNumber,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    // Update session with final counts
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

    // Clean up session data from memory
    deleteSessionData(sessionId);

    return NextResponse.json({
      success: errors.length < transactions.length,
      imported,
      skipped,
      failed: errors.length,
      errors,
      importSessionId: sessionId,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Import execute error:', error);
    return NextResponse.json(
      { error: 'Failed to execute import' },
      { status: 500 }
    );
  }
}
