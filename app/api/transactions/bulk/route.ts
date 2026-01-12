import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
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

    // Build update object with only defined fields
    const updateData: Record<string, unknown> = {};
    if (update.category_id !== undefined) {
      updateData.category_id = update.category_id;
    }
    if (update.date !== undefined) {
      updateData.date = update.date;
    }
    if (update.categorisation_source !== undefined) {
      updateData.categorisation_source = update.categorisation_source;
    }

    const { data, error } = await supabaseAdmin
      .from('transactions')
      .update(updateData)
      .in('id', ids)
      .select('id');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      updated: data?.length ?? 0,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
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
