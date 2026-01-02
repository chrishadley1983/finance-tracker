import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

type RouteParams = { params: Promise<{ id: string }> };

// =============================================================================
// POST - Flag transaction for review
// =============================================================================

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Verify transaction exists
    const { data: existing, error: checkError } = await supabaseAdmin
      .from('transactions')
      .select('id')
      .eq('id', id)
      .single();

    if (checkError || !existing) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    const { error } = await supabaseAdmin
      .from('transactions')
      .update({ needs_review: true })
      .eq('id', id);

    if (error) {
      console.error('Error flagging transaction:', error);
      return NextResponse.json(
        { error: 'Failed to flag transaction' },
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

// =============================================================================
// DELETE - Clear review flag from transaction
// =============================================================================

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Verify transaction exists
    const { data: existing, error: checkError } = await supabaseAdmin
      .from('transactions')
      .select('id')
      .eq('id', id)
      .single();

    if (checkError || !existing) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    const { error } = await supabaseAdmin
      .from('transactions')
      .update({ needs_review: false })
      .eq('id', id);

    if (error) {
      console.error('Error clearing flag:', error);
      return NextResponse.json(
        { error: 'Failed to clear flag' },
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
