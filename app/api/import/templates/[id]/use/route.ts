/**
 * Template Usage Tracking API
 *
 * POST /api/import/templates/[id]/use - Record template usage
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { z } from 'zod';

// =============================================================================
// POST - Record template usage
// =============================================================================

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate UUID format
    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json(
        { error: 'Invalid template ID' },
        { status: 400 }
      );
    }

    // Check template exists
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('import_formats')
      .select('id, use_count')
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Template not found' },
          { status: 404 }
        );
      }
      throw fetchError;
    }

    // Update last_used_at and increment use_count
    const { data, error } = await supabaseAdmin
      .from('import_formats')
      .update({
        last_used_at: new Date().toISOString(),
        use_count: (existing.use_count || 0) + 1,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error recording template usage:', error);
      return NextResponse.json(
        { error: 'Failed to record template usage' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      use_count: data.use_count,
      last_used_at: data.last_used_at,
    });
  } catch (error) {
    console.error('Template use POST error:', error);
    return NextResponse.json(
      { error: 'Failed to record template usage' },
      { status: 500 }
    );
  }
}
