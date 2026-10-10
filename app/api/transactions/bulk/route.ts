import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { applyManualCategories, InvalidCategoryError } from '@/lib/categorisation/apply';
import {
  bulkUpdateTransactionsSchema,
  bulkDeleteTransactionsSchema,
} from '@/lib/validations/transactions';
import { ZodError } from 'zod';

interface PreviousValues {
  id: string;
  is_validated: boolean;
  needs_review: boolean;
  account_id: string;
}

// Keep `.in('id', ...)` filters well inside PostgREST's URL length limit.
const CHUNK = 200;
function chunks<T>(arr: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = bulkUpdateTransactionsSchema.parse(body);

    const { ids, update } = validated;

    // Setting a category is a human decision: shared path (manual source,
    // review flag cleared, corrections recorded for the learning loop).
    let categorised = 0;
    if (update.category_id) {
      const [result] = await applyManualCategories([{ transactionIds: ids, categoryId: update.category_id }]);
      categorised = result.applied;
    }

    // Remaining fields are a plain update.
    const updateData: Record<string, unknown> = {};
    if (update.category_id === null) {
      updateData.category_id = null;
    }
    if (update.date !== undefined) {
      updateData.date = update.date;
    }
    if (!update.category_id && update.categorisation_source !== undefined) {
      updateData.categorisation_source = update.categorisation_source;
    }
    if (update.is_validated !== undefined) {
      updateData.is_validated = update.is_validated;
    }
    if (update.needs_review !== undefined) {
      updateData.needs_review = update.needs_review;
    }
    if (update.account_id !== undefined) {
      updateData.account_id = update.account_id;
    }

    // Validation / review flag / account changes are cheap to undo: hand back
    // each row's previous values so the client can restore them.
    const undoable =
      update.is_validated !== undefined || update.needs_review !== undefined || update.account_id !== undefined;
    let previous: PreviousValues[] | undefined;
    if (undoable) {
      previous = [];
      for (const part of chunks(ids)) {
        const { data, error } = await supabaseAdmin
          .from('transactions')
          .select('id, is_validated, needs_review, account_id')
          .in('id', part);
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        for (const row of (data ?? []) as PreviousValues[]) {
          previous.push({
            id: row.id,
            is_validated: Boolean(row.is_validated),
            needs_review: Boolean(row.needs_review),
            account_id: row.account_id,
          });
        }
      }
    }

    let updated = categorised;
    if (Object.keys(updateData).length > 0) {
      let changed = 0;
      for (const part of chunks(ids)) {
        const { data, error } = await supabaseAdmin
          .from('transactions')
          .update(updateData)
          .in('id', part)
          .select('id');

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        changed += data?.length ?? 0;
      }
      updated = Math.max(updated, changed);
    }

    return NextResponse.json({
      success: true,
      updated,
      ...(previous ? { previous } : {}),
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }
    if (error instanceof InvalidCategoryError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('PUT /api/transactions/bulk error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = bulkDeleteTransactionsSchema.parse(body);

    const { ids } = validated;

    for (const part of chunks(ids)) {
      // First delete related hashes (if any)
      await supabaseAdmin
        .from('imported_transaction_hashes')
        .delete()
        .in('transaction_id', part);

      // Then delete the transactions
      const { error } = await supabaseAdmin
        .from('transactions')
        .delete()
        .in('id', part);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      deleted: ids.length,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }
    console.error('DELETE /api/transactions/bulk error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
