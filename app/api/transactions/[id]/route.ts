import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { recordCorrection } from '@/lib/categorisation/learning';
import { updateTransactionSchema } from '@/lib/validations/transactions';
import { ZodError } from 'zod';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const { data, error } = await supabaseAdmin
      .from('transactions')
      .select('*, account:accounts(name), category:categories(name, group_name)')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('GET /api/transactions/[id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const validated = updateTransactionSchema.parse(body);

    // A category change by hand is a correction to feed the learning loop:
    // snapshot the row first, and promote the source to 'manual'.
    let correction: {
      description: string;
      originalCategoryId: string | null;
      originalSource: string;
    } | null = null;
    if (validated.category_id !== undefined && validated.category_id !== null) {
      const { data: existing } = await supabaseAdmin
        .from('transactions')
        .select('description, category_id, categorisation_source')
        .eq('id', id)
        .single();
      if (
        existing &&
        existing.categorisation_source !== 'manual' &&
        existing.category_id !== validated.category_id
      ) {
        correction = {
          description: existing.description,
          originalCategoryId: existing.category_id,
          originalSource: existing.categorisation_source,
        };
      }
      if (!validated.categorisation_source) {
        validated.categorisation_source = 'manual';
      }
    }

    const { data, error } = await supabaseAdmin
      .from('transactions')
      .update(validated)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (correction && validated.category_id) {
      try {
        await recordCorrection({
          description: correction.description,
          originalCategoryId: correction.originalCategoryId,
          correctedCategoryId: validated.category_id,
          originalSource: correction.originalSource,
        });
      } catch (e) {
        console.warn('Failed to record correction:', e);
      }
    }

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }
    console.error('PUT /api/transactions/[id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const { error } = await supabaseAdmin
      .from('transactions')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('DELETE /api/transactions/[id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
