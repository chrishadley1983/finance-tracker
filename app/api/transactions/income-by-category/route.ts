import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Helper to add no-cache headers
function jsonResponse(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });
}

type TimeframePeriod = 'this_month' | 'last_month' | 'this_quarter' | 'last_quarter' | 'this_year' | 'last_year' | 'all_time' | 'custom';

function getDateRange(period: TimeframePeriod, customStart?: string, customEnd?: string): { startDate: string; endDate: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  switch (period) {
    case 'this_month': {
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0);
      return {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
      };
    }
    case 'last_month': {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0);
      return {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
      };
    }
    case 'this_quarter': {
      const quarterStart = Math.floor(month / 3) * 3;
      const start = new Date(year, quarterStart, 1);
      const end = new Date(year, quarterStart + 3, 0);
      return {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
      };
    }
    case 'last_quarter': {
      const currentQuarterStart = Math.floor(month / 3) * 3;
      const start = new Date(year, currentQuarterStart - 3, 1);
      const end = new Date(year, currentQuarterStart, 0);
      return {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
      };
    }
    case 'this_year': {
      const start = new Date(year, 0, 1);
      const end = new Date(year, 11, 31);
      return {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
      };
    }
    case 'last_year': {
      const start = new Date(year - 1, 0, 1);
      const end = new Date(year - 1, 11, 31);
      return {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
      };
    }
    case 'custom': {
      if (customStart && customEnd) {
        return { startDate: customStart, endDate: customEnd };
      }
      // Fall through to all_time if no custom dates provided
    }
    case 'all_time':
    default: {
      return {
        startDate: '1900-01-01',
        endDate: '2100-12-31',
      };
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const period = (searchParams.get('period') || 'this_month') as TimeframePeriod;
    const customStart = searchParams.get('start') || undefined;
    const customEnd = searchParams.get('end') || undefined;

    // Legacy support for month param (YYYY-MM format)
    const monthParam = searchParams.get('month');
    let startDate: string;
    let endDate: string;

    if (monthParam && !searchParams.get('period')) {
      // Use legacy month param if no period specified
      const [yearNum, monthNum] = monthParam.split('-').map(Number);
      const start = new Date(yearNum, monthNum - 1, 1);
      const end = new Date(yearNum, monthNum, 0);
      startDate = start.toISOString().split('T')[0];
      endDate = end.toISOString().split('T')[0];
    } else {
      const range = getDateRange(period, customStart, customEnd);
      startDate = range.startDate;
      endDate = range.endDate;
    }

    // Get categories that should be excluded from totals
    const { data: excludedCategories, error: catError } = await supabaseAdmin
      .from('categories')
      .select('id')
      .eq('exclude_from_totals', true);

    if (catError) {
      console.error('Error fetching excluded categories:', catError);
    }

    const excludedCategoryIds = new Set(excludedCategories?.map(c => c.id) || []);

    // Use raw SQL to aggregate by category - more efficient and avoids row limits
    const { data: categoryTotals, error } = await supabaseAdmin.rpc('get_income_by_category', {
      start_date: startDate,
      end_date: endDate,
      excluded_ids: Array.from(excludedCategoryIds),
    });

    if (error) {
      // Fallback to client-side aggregation if RPC doesn't exist
      console.error('RPC error, falling back to client-side:', error);

      // Get income category IDs first
      const { data: incomeCategories, error: incomeCatError } = await supabaseAdmin
        .from('categories')
        .select('id, name')
        .eq('is_income', true);

      if (incomeCatError) {
        return jsonResponse({ error: incomeCatError.message }, 500);
      }

      const incomeCategoryIds = new Set(incomeCategories?.map(c => c.id) || []);
      const incomeCategoryNames = new Map(incomeCategories?.map(c => [c.id, c.name]) || []);

      // Fetch all transactions with pagination
      let allTransactions: { amount: number; category_id: string | null }[] = [];
      let offset = 0;
      const batchSize = 1000;

      while (true) {
        const { data: batch, error: batchError } = await supabaseAdmin
          .from('transactions')
          .select('amount, category_id')
          .gte('date', startDate)
          .lte('date', endDate)
          .range(offset, offset + batchSize - 1);

        if (batchError) {
          return jsonResponse({ error: batchError.message }, 500);
        }

        if (!batch || batch.length === 0) break;

        allTransactions = allTransactions.concat(batch as typeof allTransactions);

        if (batch.length < batchSize) break;
        offset += batchSize;
      }

      console.log(`[income-by-category] Fallback - Transactions fetched: ${allTransactions.length}`);

      // Group by category, only including income categories
      const categoryMap = new Map<string, { categoryId: string; categoryName: string; amount: number }>();

      for (const t of allTransactions) {
        // Only include transactions in income categories
        if (!t.category_id || !incomeCategoryIds.has(t.category_id)) {
          continue;
        }

        // Skip excluded categories
        if (excludedCategoryIds.has(t.category_id)) {
          continue;
        }

        const categoryId = t.category_id;
        const categoryName = incomeCategoryNames.get(categoryId) || 'Unknown';
        const amount = Math.abs(t.amount);

        const existing = categoryMap.get(categoryId);
        if (existing) {
          existing.amount += amount;
        } else {
          categoryMap.set(categoryId, { categoryId, categoryName, amount });
        }
      }

      const categories = Array.from(categoryMap.values());
      const totalIncome = categories.reduce((sum, c) => sum + c.amount, 0);

      const result = categories
        .map((c) => ({
          categoryId: c.categoryId,
          categoryName: c.categoryName,
          amount: c.amount,
          percentage: totalIncome > 0 ? Math.round((c.amount / totalIncome) * 100) : 0,
        }))
        .sort((a, b) => b.amount - a.amount);

      return jsonResponse(result);
    }

    // Use RPC results
    const categories = (categoryTotals || []).map((row: { category_id: string; category_name: string; total_amount: number }) => ({
      categoryId: row.category_id || 'uncategorized',
      categoryName: row.category_name || 'Uncategorized',
      amount: Number(row.total_amount),
    }));
    const totalIncome = categories.reduce((sum, c) => sum + c.amount, 0);

    const result = categories
      .map((c) => ({
        categoryId: c.categoryId,
        categoryName: c.categoryName,
        amount: c.amount,
        percentage: totalIncome > 0 ? Math.round((c.amount / totalIncome) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    return jsonResponse(result);
  } catch (error) {
    console.error('Error fetching income by category:', error);
    return jsonResponse({ error: 'Failed to fetch income by category' }, 500);
  }
}
