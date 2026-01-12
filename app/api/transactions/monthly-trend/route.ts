import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getMonthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Get period param for special handling
    const period = searchParams.get('period');

    // Calculate date range using local date math (no UTC conversion)
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed

    let startYear: number;
    let startMonth: number;
    let endYear: number;
    let endMonth: number;
    let monthsCount: number;

    if (period === 'last_year') {
      // Show all 12 months of the previous year
      startYear = currentYear - 1;
      startMonth = 0; // January
      endYear = currentYear - 1;
      endMonth = 11; // December
      monthsCount = 12;
    } else if (period === 'this_year') {
      // Show all months from January of current year to current month
      startYear = currentYear;
      startMonth = 0; // January
      endYear = currentYear;
      endMonth = currentMonth;
      monthsCount = currentMonth + 1;
    } else {
      // Default: last 6 months (or custom months param)
      const monthsParam = searchParams.get('months');
      monthsCount = monthsParam ? parseInt(monthsParam, 10) : 6;

      // Calculate start month/year
      startMonth = currentMonth - monthsCount + 1;
      startYear = currentYear;
      while (startMonth < 0) {
        startMonth += 12;
        startYear--;
      }
      endYear = currentYear;
      endMonth = currentMonth;
    }

    // Start date: first day of start month
    const startDateStr = formatDate(startYear, startMonth, 1);

    // End date: last day of end month
    const lastDayOfMonth = new Date(endYear, endMonth + 1, 0).getDate();
    const endDateStr = formatDate(endYear, endMonth, lastDayOfMonth);

    // Get categories that should be excluded from totals
    const { data: excludedCategories, error: catError } = await supabaseAdmin
      .from('categories')
      .select('id')
      .eq('exclude_from_totals', true);

    if (catError) {
      console.error('Error fetching excluded categories:', catError);
    }

    const excludedCategoryIds = new Set(excludedCategories?.map(c => c.id) || []);

    // Get all transactions in range using pagination to overcome the 1000 row limit
    const allTransactions: { date: string; amount: number; category_id: string | null }[] = [];
    let from = 0;
    const batchSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: batch, error: batchError } = await supabaseAdmin
        .from('transactions')
        .select('date, amount, category_id')
        .gte('date', startDateStr)
        .lte('date', endDateStr)
        .order('id')  // Consistent ordering for pagination
        .range(from, from + batchSize - 1);

      if (batchError) {
        return NextResponse.json({ error: batchError.message }, { status: 500 });
      }

      if (batch && batch.length > 0) {
        allTransactions.push(...batch);
        from += batchSize;
        hasMore = batch.length === batchSize;
      } else {
        hasMore = false;
      }
    }

    // Filter out transactions in excluded categories
    const transactions = allTransactions.filter(
      t => !t.category_id || !excludedCategoryIds.has(t.category_id)
    );

    // Initialize all months in range
    const monthMap = new Map<string, { income: number; expenses: number }>();
    let year = startYear;
    let month = startMonth;

    for (let i = 0; i < monthsCount; i++) {
      const monthKey = getMonthKey(year, month);
      monthMap.set(monthKey, { income: 0, expenses: 0 });

      month++;
      if (month > 11) {
        month = 0;
        year++;
      }
    }

    // Aggregate transactions
    for (const t of transactions) {
      const monthKey = t.date.slice(0, 7); // YYYY-MM from date string
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
