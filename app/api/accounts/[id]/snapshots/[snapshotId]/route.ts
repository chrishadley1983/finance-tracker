import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { z } from 'zod';

const updateSnapshotSchema = z.object({
  balance: z.number().optional(),
  notes: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format').optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; snapshotId: string }> }
) {
  try {
    const { id: accountId, snapshotId } = await params;
    const body = await request.json();

    const validated = updateSnapshotSchema.parse(body);

    // Verify snapshot exists and belongs to this account
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('wealth_snapshots')
      .select('id, account_id')
      .eq('id', snapshotId)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: 'Snapshot not found' },
        { status: 404 }
      );
    }

    if (existing.account_id !== accountId) {
      return NextResponse.json(
        { error: 'Snapshot does not belong to this account' },
        { status: 403 }
      );
    }

    // Update snapshot
    const updateData: Record<string, unknown> = {};
    if (validated.balance !== undefined) updateData.balance = validated.balance;
    if (validated.notes !== undefined) updateData.notes = validated.notes;
    if (validated.date !== undefined) updateData.date = validated.date;

    const { data: snapshot, error: updateError } = await supabaseAdmin
      .from('wealth_snapshots')
      .update(updateData)
      .eq('id', snapshotId)
      .select('id, date, balance, notes')
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ snapshot });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }
    console.error('PUT /api/accounts/[id]/snapshots/[snapshotId] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; snapshotId: string }> }
) {
  try {
    const { id: accountId, snapshotId } = await params;

    // Verify snapshot exists and belongs to this account
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('wealth_snapshots')
      .select('id, account_id')
      .eq('id', snapshotId)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: 'Snapshot not found' },
        { status: 404 }
      );
    }

    if (existing.account_id !== accountId) {
      return NextResponse.json(
        { error: 'Snapshot does not belong to this account' },
        { status: 403 }
      );
    }

    // Delete snapshot
    const { error: deleteError } = await supabaseAdmin
      .from('wealth_snapshots')
      .delete()
      .eq('id', snapshotId);

    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/accounts/[id]/snapshots/[snapshotId] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
