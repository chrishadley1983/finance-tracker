import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Get month param or default to current month
    const monthParam = searchParams.get('month');
    let startDate: Date;
    let endDate: Date;

    if (monthParam) {
      // Expect format: YYYY-MM
      const [year, month] = monthParam.split('-').map(Number);
      startDate = new Date(year, month - 1, 1);
      endDate = new Date(year, month, 0);
    } else {
      const now = new Date();
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    // Get expense transactions for the month with category info
    const { data: transactions, error } = await supabaseAdmin
      .from('transactions')
      .select(`
        amount,
        category:categories(id, name)
      `)
      .gte('date', startDateStr)
      .lte('date', endDateStr)
      .lt('amount', 0);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Group by category
    const categoryMap = new Map<string, { categoryId: string; categoryName: string; amount: number }>();

    for (const t of transactions || []) {
      const category = t.category as { id: string; name: string } | null;
      const categoryId = category?.id || 'uncategorized';
      const categoryName = category?.name || 'Uncategorized';
      const amount = Math.abs(t.amount);

      const existing = categoryMap.get(categoryId);
      if (existing) {
        existing.amount += amount;
      } else {
        categoryMap.set(categoryId, { categoryId, categoryName, amount });
      }
    }

    // Calculate total and percentages
    const categories = Array.from(categoryMap.values());
    const totalExpenses = categories.reduce((sum, c) => sum + c.amount, 0);

    const result = categories
      .map((c) => ({
        categoryId: c.categoryId,
        categoryName: c.categoryName,
        amount: c.amount,
        percentage: totalExpenses > 0 ? Math.round((c.amount / totalExpenses) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching spending by category:', error);
    return NextResponse.json(
      { error: 'Failed to fetch spending by category' },
      { status: 500 }
    );
  }
}
