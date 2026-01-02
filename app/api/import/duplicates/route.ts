import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { duplicateCheckRequestSchema } from '@/lib/validations/import';
import { getSessionData, validateRows } from '@/lib/import';
import type { ParsedTransaction, DuplicateMatchType } from '@/lib/types/import';
import { ZodError } from 'zod';
import crypto from 'crypto';

interface DuplicateResult {
  importRow: number;
  importTransaction: ParsedTransaction;
  existingTransaction: {
    id: string;
    date: string;
    amount: number;
    description: string;
    account_id: string;
  };
  matchType: DuplicateMatchType;
  similarity: number;
}

/**
 * Generate a hash for duplicate detection.
 */
function generateTransactionHash(date: string, amount: number, description: string): string {
  const normalizedDesc = description.toLowerCase().trim().replace(/\s+/g, ' ');
  const data = `${date}|${amount.toFixed(2)}|${normalizedDesc}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Calculate Levenshtein distance between two strings.
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate similarity between two strings (0-1).
 */
function calculateSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const distance = levenshteinDistance(a.toLowerCase(), b.toLowerCase());
  return 1 - distance / maxLen;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = duplicateCheckRequestSchema.parse(body);

    let transactions: ParsedTransaction[] = [];

    if (validated.transactions && validated.transactions.length > 0) {
      transactions = validated.transactions;
    } else {
      // Get from session data
      const sessionData = getSessionData(validated.sessionId);

      if (!sessionData) {
        return NextResponse.json(
          { error: 'Session not found or expired. Please upload the file again.' },
          { status: 404 }
        );
      }

      // Get format from session
      const { data: session } = await supabaseAdmin
        .from('import_sessions')
        .select('format_id')
        .eq('id', validated.sessionId)
        .single();

      if (session?.format_id) {
        const { data: format } = await supabaseAdmin
          .from('import_formats')
          .select('column_mapping, date_format, decimal_separator, amount_in_single_column, skip_rows')
          .eq('id', session.format_id)
          .single();

        if (format) {
          const mapping = format.column_mapping as Record<string, string>;
          const result = validateRows(
            sessionData.rows,
            sessionData.headers,
            mapping as Parameters<typeof validateRows>[2],
            {
              dateFormat: format.date_format,
              decimalSeparator: format.decimal_separator as '.' | ',',
              amountInSingleColumn: format.amount_in_single_column,
              skipRows: format.skip_rows,
            }
          );
          transactions = result.transactions;
        }
      }

      if (transactions.length === 0) {
        return NextResponse.json(
          { error: 'No transactions to check. Please provide transactions or run preview first.' },
          { status: 400 }
        );
      }
    }

    const duplicates: DuplicateResult[] = [];
    const strategy = validated.strategy;

    // First, check against imported_transaction_hashes for exact matches
    const hashes = transactions.map((tx) =>
      generateTransactionHash(tx.date, tx.amount, tx.description)
    );

    const { data: existingHashes } = await supabaseAdmin
      .from('imported_transaction_hashes')
      .select('hash, transaction_id')
      .in('hash', hashes);

    const hashSet = new Set((existingHashes || []).map((h) => h.hash));

    // For each transaction, check for duplicates based on strategy
    for (const tx of transactions) {
      const txHash = generateTransactionHash(tx.date, tx.amount, tx.description);

      // Check hash table first
      if (hashSet.has(txHash)) {
        const hashMatch = existingHashes?.find((h) => h.hash === txHash);
        if (hashMatch) {
          const { data: existingTx } = await supabaseAdmin
            .from('transactions')
            .select('id, date, amount, description, account_id')
            .eq('id', hashMatch.transaction_id)
            .single();

          if (existingTx) {
            duplicates.push({
              importRow: tx.rowNumber,
              importTransaction: tx,
              existingTransaction: existingTx,
              matchType: 'exact',
              similarity: 1,
            });
            continue;
          }
        }
      }

      // Strategy-based duplicate detection
      if (strategy === 'strict') {
        // Only look for exact matches (already handled by hash check above)
        const { data: matches } = await supabaseAdmin
          .from('transactions')
          .select('id, date, amount, description, account_id')
          .eq('date', tx.date)
          .eq('amount', tx.amount)
          .ilike('description', tx.description);

        if (matches && matches.length > 0) {
          duplicates.push({
            importRow: tx.rowNumber,
            importTransaction: tx,
            existingTransaction: matches[0],
            matchType: 'exact',
            similarity: 1,
          });
        }
      } else if (strategy === 'fuzzy') {
        // Look for similar transactions
        const amountMin = tx.amount - 0.01;
        const amountMax = tx.amount + 0.01;

        const { data: matches } = await supabaseAdmin
          .from('transactions')
          .select('id, date, amount, description, account_id')
          .eq('date', tx.date)
          .gte('amount', amountMin)
          .lte('amount', amountMax);

        if (matches && matches.length > 0) {
          // Find best match by description similarity
          let bestMatch = matches[0];
          let bestSimilarity = calculateSimilarity(tx.description, matches[0].description);

          for (let i = 1; i < matches.length; i++) {
            const sim = calculateSimilarity(tx.description, matches[i].description);
            if (sim > bestSimilarity) {
              bestSimilarity = sim;
              bestMatch = matches[i];
            }
          }

          if (bestSimilarity > 0.7) {
            duplicates.push({
              importRow: tx.rowNumber,
              importTransaction: tx,
              existingTransaction: bestMatch,
              matchType: bestSimilarity === 1 ? 'exact' : 'likely',
              similarity: bestSimilarity,
            });
          }
        }
      } else if (strategy === 'dateRange') {
        // Look for same amount within ±1 day
        const date = new Date(tx.date);
        const dayBefore = new Date(date);
        dayBefore.setDate(dayBefore.getDate() - 1);
        const dayAfter = new Date(date);
        dayAfter.setDate(dayAfter.getDate() + 1);

        const { data: matches } = await supabaseAdmin
          .from('transactions')
          .select('id, date, amount, description, account_id')
          .eq('amount', tx.amount)
          .gte('date', dayBefore.toISOString().split('T')[0])
          .lte('date', dayAfter.toISOString().split('T')[0]);

        if (matches && matches.length > 0) {
          // Find best match
          let bestMatch = matches[0];
          let bestSimilarity = calculateSimilarity(tx.description, matches[0].description);

          for (let i = 1; i < matches.length; i++) {
            const sim = calculateSimilarity(tx.description, matches[i].description);
            if (sim > bestSimilarity) {
              bestSimilarity = sim;
              bestMatch = matches[i];
            }
          }

          const matchType: DuplicateMatchType =
            bestMatch.date === tx.date && bestSimilarity === 1
              ? 'exact'
              : bestSimilarity > 0.8
                ? 'likely'
                : 'possible';

          duplicates.push({
            importRow: tx.rowNumber,
            importTransaction: tx,
            existingTransaction: bestMatch,
            matchType,
            similarity: bestSimilarity,
          });
        }
      }
    }

    return NextResponse.json({
      duplicates,
      uniqueCount: transactions.length - duplicates.length,
      duplicateCount: duplicates.length,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Duplicate check error:', error);
    return NextResponse.json(
      { error: 'Failed to check duplicates' },
      { status: 500 }
    );
  }
}
