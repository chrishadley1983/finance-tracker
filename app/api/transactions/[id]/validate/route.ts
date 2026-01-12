import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: 'Transaction ID is required' },
        { status: 400 }
      );
    }

    // Get current validation status
    const { data: transaction, error: fetchError } = await supabaseAdmin
      .from('transactions')
      .select('is_validated')
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Transaction not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    // Toggle the validation status
    const newStatus = !transaction.is_validated;

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('transactions')
      .update({ is_validated: newStatus })
      .eq('id', id)
      .select('id, is_validated')
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      id: updated.id,
      is_validated: updated.is_validated,
    });
  } catch (error) {
    console.error('Error toggling validation:', error);
    return NextResponse.json(
      { error: 'Failed to toggle validation status' },
      { status: 500 }
    );
  }
}
