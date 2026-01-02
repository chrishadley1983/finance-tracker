import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import {
  updateValuationSchema,
  type InvestmentValuation,
} from '@/lib/types/investment';

interface RouteContext {
  params: Promise<{ id: string; valuationId: string }>;
}

// =============================================================================
// GET - Get single valuation
// =============================================================================

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id, valuationId } = await context.params;
    
    const { data: valuation, error } = await supabaseAdmin
      .from('investment_valuations')
      .select('*')
      .eq('id', valuationId)
      .eq('account_id', id)
      .single();

    if (error || !valuation) {
      return NextResponse.json(
        { error: 'Valuation not found' },
        { status: 404 }
      );
    }

    const result: InvestmentValuation = {
      id: valuation.id,
      accountId: valuation.account_id,
      date: valuation.date,
      value: valuation.value,
      notes: valuation.notes,
      createdAt: valuation.created_at || '',
      updatedAt: valuation.updated_at || '',
    };

    return NextResponse.json({ valuation: result });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

// =============================================================================
// PATCH - Update valuation
// =============================================================================

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id, valuationId } = await context.params;
    const body = await request.json();
    const validation = updateValuationSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    
    // Verify valuation exists
    const { data: existing, error: checkError } = await supabaseAdmin
      .from('investment_valuations')
      .select('id')
      .eq('id', valuationId)
      .eq('account_id', id)
      .single();

    if (checkError || !existing) {
      return NextResponse.json(
        { error: 'Valuation not found' },
        { status: 404 }
      );
    }

    const updates: Record<string, unknown> = {};

    if (validation.data.date !== undefined) {
      // Validate date is not in the future
      const valuationDate = new Date(validation.data.date);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (valuationDate > today) {
        return NextResponse.json(
          { error: 'Valuation date cannot be in the future' },
          { status: 400 }
        );
      }
      updates.date = validation.data.date;
    }
    if (validation.data.value !== undefined) {
      updates.value = validation.data.value;
    }
    if (validation.data.notes !== undefined) {
      updates.notes = validation.data.notes;
    }

    const { data: valuation, error } = await supabaseAdmin
      .from('investment_valuations')
      .update(updates)
      .eq('id', valuationId)
      .select()
      .single();

    if (error) {
      console.error('Error updating valuation:', error);
      return NextResponse.json(
        { error: 'Failed to update valuation' },
        { status: 500 }
      );
    }

    const result: InvestmentValuation = {
      id: valuation.id,
      accountId: valuation.account_id,
      date: valuation.date,
      value: valuation.value,
      notes: valuation.notes,
      createdAt: valuation.created_at || '',
      updatedAt: valuation.updated_at || '',
    };

    return NextResponse.json({ valuation: result });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE - Delete valuation
// =============================================================================

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id, valuationId } = await context.params;
    
    // Verify valuation exists
    const { data: existing, error: checkError } = await supabaseAdmin
      .from('investment_valuations')
      .select('id')
      .eq('id', valuationId)
      .eq('account_id', id)
      .single();

    if (checkError || !existing) {
      return NextResponse.json(
        { error: 'Valuation not found' },
        { status: 404 }
      );
    }

    const { error } = await supabaseAdmin
      .from('investment_valuations')
      .delete()
      .eq('id', valuationId);

    if (error) {
      console.error('Error deleting valuation:', error);
      return NextResponse.json(
        { error: 'Failed to delete valuation' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
