import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { z } from 'zod';

const bulkBudgetEntrySchema = z.object({
  categoryId: z.string().uuid(),
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  amount: z.number().min(0),
});

const bulkBudgetRequestSchema = z.object({
  entries: z.array(bulkBudgetEntrySchema).min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = bulkBudgetRequestSchema.parse(body);

    // Upsert budgets - update if exists, insert if not
    const results = await Promise.all(
      validated.entries.map(async (entry) => {
        // Check if budget exists for this category/year/month
        const { data: existing } = await supabaseAdmin
          .from('budgets')
          .select('id')
          .eq('category_id', entry.categoryId)
          .eq('year', entry.year)
          .eq('month', entry.month)
          .single();

        if (existing) {
          // Update existing
          const { error } = await supabaseAdmin
            .from('budgets')
            .update({ amount: entry.amount })
            .eq('id', existing.id);

          if (error) throw error;
          return { action: 'updated', ...entry };
        } else {
          // Insert new
          const { error } = await supabaseAdmin
            .from('budgets')
            .insert({
              category_id: entry.categoryId,
              year: entry.year,
              month: entry.month,
              amount: entry.amount,
            });

          if (error) throw error;
          return { action: 'created', ...entry };
        }
      })
    );

    const created = results.filter((r) => r.action === 'created').length;
    const updated = results.filter((r) => r.action === 'updated').length;

    return NextResponse.json({
      success: true,
      created,
      updated,
      total: results.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }
    console.error('POST /api/budgets/bulk error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET: Retrieve all budgets for a year (useful for editing)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));

    const { data, error } = await supabaseAdmin
      .from('budgets')
      .select('*, category:categories(id, name, group_name, is_income)')
      .eq('year', year)
      .order('month', { ascending: true });

    if (error) {
      console.error('Error fetching budgets:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Group by category for easier editing
    const budgetsByCategory = new Map<string, {
      categoryId: string;
      categoryName: string;
      groupName: string;
      isIncome: boolean;
      months: Record<number, { id: string; amount: number }>;
    }>();

    for (const budget of data || []) {
      const cat = budget.category as { id: string; name: string; group_name: string; is_income: boolean } | null;
      if (!cat) continue;

      if (!budgetsByCategory.has(cat.id)) {
        budgetsByCategory.set(cat.id, {
          categoryId: cat.id,
          categoryName: cat.name,
          groupName: cat.group_name,
          isIncome: cat.is_income,
          months: {},
        });
      }

      budgetsByCategory.get(cat.id)!.months[budget.month] = {
        id: budget.id,
        amount: budget.amount,
      };
    }

    return NextResponse.json({
      year,
      budgets: Array.from(budgetsByCategory.values()),
    });
  } catch (error) {
    console.error('GET /api/budgets/bulk error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
