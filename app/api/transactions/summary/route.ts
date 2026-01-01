import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function GET() {
  try {
    // Get current month boundaries
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const startDateStr = startOfMonth.toISOString().split('T')[0];
    const endDateStr = endOfMonth.toISOString().split('T')[0];

    // Get total balance (sum of all transactions)
    const { data: balanceData, error: balanceError } = await supabaseAdmin
      .from('transactions')
      .select('amount');

    if (balanceError) {
      return NextResponse.json({ error: balanceError.message }, { status: 500 });
    }

    const totalBalance = balanceData?.reduce((sum, t) => sum + t.amount, 0) ?? 0;

    // Get current month transactions
    const { data: monthData, error: monthError } = await supabaseAdmin
      .from('transactions')
      .select('amount')
      .gte('date', startDateStr)
      .lte('date', endDateStr);

    if (monthError) {
      return NextResponse.json({ error: monthError.message }, { status: 500 });
    }

    const monthIncome = monthData
      ?.filter((t) => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0) ?? 0;

    const monthExpenses = monthData
      ?.filter((t) => t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0) ?? 0;

    const monthNet = monthIncome - monthExpenses;

    return NextResponse.json({
      totalBalance,
      monthIncome,
      monthExpenses,
      monthNet,
    });
  } catch (error) {
    console.error('Error fetching transaction summary:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transaction summary' },
      { status: 500 }
    );
  }
}
