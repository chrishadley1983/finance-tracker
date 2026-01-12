import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { reorderCategoryGroupsSchema } from '@/lib/validations/category-groups';
import { ZodError } from 'zod';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { groups } = reorderCategoryGroupsSchema.parse(body);

    // Update each group's display_order
    const updates = groups.map(({ id, display_order }) =>
      supabaseAdmin
        .from('category_groups')
        .update({ display_order, updated_at: new Date().toISOString() })
        .eq('id', id)
    );

    const results = await Promise.all(updates);

    // Check for errors
    const errors = results.filter(r => r.error);
    if (errors.length > 0) {
      return NextResponse.json(
        { error: 'Failed to update some groups', details: errors.map(e => e.error) },
        { status: 500 }
      );
    }

    // Return updated groups
    const { data, error } = await supabaseAdmin
      .from('category_groups')
      .select('*')
      .order('display_order')
      .order('name');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }
    console.error('POST /api/category-groups/reorder error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
