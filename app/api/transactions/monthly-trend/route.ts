import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Get months param or default to 6
    const monthsParam = searchParams.get('months');
    const monthsCount = monthsParam ? parseInt(monthsParam, 10) : 6;

    // Calculate date range
    const now = new Date();
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const startDate = new Date(now.getFullYear(), now.getMonth() - monthsCount + 1, 1);

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    // Get all transactions in range
    const { data: transactions, error } = await supabaseAdmin
      .from('transactions')
      .select('date, amount')
      .gte('date', startDateStr)
      .lte('date', endDateStr);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Group by month
    const monthMap = new Map<string, { income: number; expenses: number }>();

    // Initialize all months in range
    for (let i = 0; i < monthsCount; i++) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - monthsCount + 1 + i, 1);
      const monthKey = monthDate.toISOString().slice(0, 7); // YYYY-MM
      monthMap.set(monthKey, { income: 0, expenses: 0 });
    }

    // Aggregate transactions
    for (const t of transactions || []) {
      const monthKey = t.date.slice(0, 7); // YYYY-MM
      const existing = monthMap.get(monthKey);
      if (existing) {
        if (t.amount > 0) {
          existing.income += t.amount;
        } else {
          existing.expenses += Math.abs(t.amount);
        }
      }
    }

    // Convert to array with month labels
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const result = Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([monthKey, data]) => {
        const monthIndex = parseInt(monthKey.split('-')[1], 10) - 1;
        return {
          month: monthNames[monthIndex],
          income: data.income,
          expenses: data.expenses,
        };
      });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching monthly trend:', error);
    return NextResponse.json(
      { error: 'Failed to fetch monthly trend' },
      { status: 500 }
    );
  }
}
