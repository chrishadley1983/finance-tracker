import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { applyManualCategories, InvalidCategoryError } from '@/lib/categorisation/apply';
import {
  bulkUpdateTransactionsSchema,
  bulkDeleteTransactionsSchema,
} from '@/lib/validations/transactions';
import { ZodError } from 'zod';

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

    let updated = categorised;
    if (Object.keys(updateData).length > 0) {
      const { data, error } = await supabaseAdmin
        .from('transactions')
        .update(updateData)
        .in('id', ids)
        .select('id');

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      updated = Math.max(updated, data?.length ?? 0);
    }

    return NextResponse.json({
      success: true,
      updated,
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

    // First delete related hashes (if any)
    await supabaseAdmin
      .from('imported_transaction_hashes')
      .delete()
      .in('transaction_id', ids);

    // Then delete the transactions
    const { error } = await supabaseAdmin
      .from('transactions')
      .delete()
      .in('id', ids);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
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
