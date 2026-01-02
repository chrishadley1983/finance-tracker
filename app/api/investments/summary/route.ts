import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import {
  INVESTMENT_PROVIDER_LABELS,
  INVESTMENT_TYPE_LABELS,
  type InvestmentSummary,
  type InvestmentProvider,
  type InvestmentType,
} from '@/lib/types/investment';

// =============================================================================
// GET - Investment summary across all accounts
// =============================================================================

export async function GET() {
  try {
    
    // Get all active investment accounts
    const { data: accounts, error: accountsError } = await supabaseAdmin
      .from('accounts')
      .select('id, investment_provider, investment_type')
      .eq('type', 'investment')
      .eq('is_active', true);

    if (accountsError) {
      console.error('Error fetching investment accounts:', accountsError);
      return NextResponse.json(
        { error: 'Failed to fetch investment accounts' },
        { status: 500 }
      );
    }

    if (!accounts || accounts.length === 0) {
      const emptySummary: InvestmentSummary = {
        totalValue: 0,
        accountCount: 0,
        byProvider: [],
        byType: [],
        lastUpdated: null,
      };
      return NextResponse.json({ summary: emptySummary });
    }

    const accountIds = accounts.map((a: { id: string }) => a.id);

    // Get latest valuation for each account using a subquery approach
    // First get all valuations ordered by date desc
    const { data: allValuations, error: valuationsError } = await supabaseAdmin
      .from('investment_valuations')
      .select('account_id, date, value')
      .in('account_id', accountIds)
      .order('date', { ascending: false });

    if (valuationsError) {
      console.error('Error fetching valuations:', valuationsError);
      return NextResponse.json(
        { error: 'Failed to fetch valuations' },
        { status: 500 }
      );
    }

    // Get latest valuation per account
    const latestByAccount = new Map<string, { value: number; date: string }>();
    for (const v of allValuations || []) {
      if (!latestByAccount.has(v.account_id)) {
        latestByAccount.set(v.account_id, { value: v.value, date: v.date });
      }
    }

    // Calculate totals
    let totalValue = 0;
    let lastUpdated: string | null = null;

    const byProviderMap = new Map<string, { value: number; count: number }>();
    const byTypeMap = new Map<string, { value: number; count: number }>();

    for (const account of accounts) {
      const valuation = latestByAccount.get(account.id);
      const value = valuation?.value || 0;

      totalValue += value;

      if (valuation?.date) {
        if (!lastUpdated || valuation.date > lastUpdated) {
          lastUpdated = valuation.date;
        }
      }

      // Group by provider
      const provider = account.investment_provider || 'other';
      const providerStats = byProviderMap.get(provider) || { value: 0, count: 0 };
      providerStats.value += value;
      providerStats.count += 1;
      byProviderMap.set(provider, providerStats);

      // Group by type
      const type = account.investment_type || 'other';
      const typeStats = byTypeMap.get(type) || { value: 0, count: 0 };
      typeStats.value += value;
      typeStats.count += 1;
      byTypeMap.set(type, typeStats);
    }

    // Convert maps to arrays with labels
    const byProvider = Array.from(byProviderMap.entries())
      .map(([provider, stats]) => ({
        provider,
        label: INVESTMENT_PROVIDER_LABELS[provider as InvestmentProvider] || provider,
        value: stats.value,
        count: stats.count,
      }))
      .sort((a, b) => b.value - a.value);

    const byType = Array.from(byTypeMap.entries())
      .map(([type, stats]) => ({
        type,
        label: INVESTMENT_TYPE_LABELS[type as InvestmentType] || type,
        value: stats.value,
        count: stats.count,
      }))
      .sort((a, b) => b.value - a.value);

    const summary: InvestmentSummary = {
      totalValue,
      accountCount: accounts.length,
      byProvider,
      byType,
      lastUpdated,
    };

    return NextResponse.json({ summary });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
