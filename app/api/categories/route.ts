import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { createCategorySchema } from '@/lib/validations/categories';
import { ZodError } from 'zod';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeStats = searchParams.get('stats') === 'true';
    const groupId = searchParams.get('group_id');
    const isIncome = searchParams.get('is_income');

    // Build query
    let query = supabaseAdmin
      .from('categories')
      .select('*, category_groups!group_id(id, name, colour)')
      .order('display_order')
      .order('name');

    // Apply filters
    if (groupId) {
      query = query.eq('group_id', groupId);
    }
    if (isIncome !== null && isIncome !== undefined) {
      query = query.eq('is_income', isIncome === 'true');
    }

    const { data: categories, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // If stats requested, fetch transaction counts
    if (includeStats && categories && categories.length > 0) {
      const categoryIds = categories.map(c => c.id);

      // Get transaction counts per category
      const { data: stats, error: statsError } = await supabaseAdmin
        .rpc('get_category_transaction_stats', { category_ids: categoryIds });

      if (statsError) {
        console.error('Error fetching category stats:', statsError);
        // Return categories without stats on error
        return NextResponse.json(categories);
      }

      // Create stats map
      const statsMap = new Map<string, { tx_count: number; total_amount: number }>();
      for (const stat of stats || []) {
        statsMap.set(stat.category_id, {
          tx_count: Number(stat.tx_count) || 0,
          total_amount: Number(stat.total_amount) || 0,
        });
      }

      // Enrich categories with stats
      const enrichedCategories = categories.map(cat => ({
        ...cat,
        transaction_count: statsMap.get(cat.id)?.tx_count || 0,
        total_amount: statsMap.get(cat.id)?.total_amount || 0,
      }));

      return NextResponse.json(enrichedCategories);
    }

    return NextResponse.json(categories);
  } catch (error) {
    console.error('GET /api/categories error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = createCategorySchema.parse(body);

    // Ensure group_name is set (required by DB)
    const insertData = {
      ...validated,
      group_name: validated.group_name || 'Ungrouped',
    };

    const { data, error } = await supabaseAdmin
      .from('categories')
      .insert(insertData)
      .select()
      .single();

    if (error) {
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
    console.error('POST /api/categories error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
