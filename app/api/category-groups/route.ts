import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { createCategoryGroupSchema } from '@/lib/validations/category-groups';
import { ZodError } from 'zod';

export async function GET() {
  try {
    // Get all groups with category counts
    const { data: groups, error: groupsError } = await supabaseAdmin
      .from('category_groups')
      .select('*')
      .order('display_order')
      .order('name');

    if (groupsError) {
      return NextResponse.json({ error: groupsError.message }, { status: 500 });
    }

    // Get category counts per group
    const { data: categoryCounts, error: countError } = await supabaseAdmin
      .from('categories')
      .select('group_id')
      .not('group_id', 'is', null);

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }

    // Count categories per group
    const countMap = new Map<string, number>();
    for (const cat of categoryCounts || []) {
      if (cat.group_id) {
        countMap.set(cat.group_id, (countMap.get(cat.group_id) || 0) + 1);
      }
    }

    // Enrich groups with counts
    const enrichedGroups = groups.map(group => ({
      ...group,
      category_count: countMap.get(group.id) || 0,
    }));

    return NextResponse.json(enrichedGroups);
  } catch (error) {
    console.error('GET /api/category-groups error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = createCategoryGroupSchema.parse(body);

    const { data, error } = await supabaseAdmin
      .from('category_groups')
      .insert(validated)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'A group with this name already exists' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }
    console.error('POST /api/category-groups error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
