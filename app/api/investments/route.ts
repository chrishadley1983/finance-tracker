import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import {
  createInvestmentAccountSchema,
  INVESTMENT_PROVIDER_LABELS,
  type InvestmentAccount,
  type InvestmentProvider,
  type InvestmentType,
} from '@/lib/types/investment';
import type { Database } from '@/lib/supabase/database.types';

type AccountRow = Database['public']['Tables']['accounts']['Row'];
type ValuationRow = Database['public']['Tables']['investment_valuations']['Row'];

// =============================================================================
// GET - List investment accounts with latest valuations
// =============================================================================

export async function GET() {
  try {
    // Get all investment accounts
    const { data: accounts, error: accountsError } = await supabaseAdmin
      .from('accounts')
      .select('*')
      .eq('type', 'investment')
      .eq('is_active', true)
      .order('name');

    if (accountsError) {
      console.error('Error fetching investment accounts:', accountsError);
      return NextResponse.json(
        { error: 'Failed to fetch investment accounts' },
        { status: 500 }
      );
    }

    if (!accounts || accounts.length === 0) {
      return NextResponse.json({ accounts: [] });
    }

    // Get latest valuation for each account
    const accountIds = accounts.map((a: AccountRow) => a.id);
    const { data: valuations, error: valuationsError } = await supabaseAdmin
      .from('investment_valuations')
      .select('*')
      .in('account_id', accountIds)
      .order('date', { ascending: false });

    if (valuationsError) {
      console.error('Error fetching valuations:', valuationsError);
    }

    // Create a map of account_id -> latest valuation
    const latestValuationMap = new Map<string, ValuationRow>();
    if (valuations) {
      for (const v of valuations) {
        if (!latestValuationMap.has(v.account_id)) {
          latestValuationMap.set(v.account_id, v);
        }
      }
    }

    // Map to response format
    const result: InvestmentAccount[] = accounts.map((account: AccountRow) => {
      const latestVal = latestValuationMap.get(account.id);
      return {
        id: account.id,
        name: account.name,
        type: 'investment' as const,
        provider: account.provider,
        investmentProvider: account.investment_provider as InvestmentProvider | null,
        investmentType: account.investment_type as InvestmentType | null,
        isActive: account.is_active,
        createdAt: account.created_at,
        updatedAt: account.updated_at,
        latestValuation: latestVal
          ? {
              id: latestVal.id,
              accountId: latestVal.account_id,
              date: latestVal.date,
              value: latestVal.value,
              notes: latestVal.notes,
              createdAt: latestVal.created_at || '',
              updatedAt: latestVal.updated_at || '',
            }
          : null,
      };
    });

    return NextResponse.json({ accounts: result });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST - Create investment account
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = createInvestmentAccountSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { name, investmentProvider, investmentType, accountReference } = validation.data;

    // Use provider label as the provider field for display
    const providerLabel = INVESTMENT_PROVIDER_LABELS[investmentProvider];

    const { data: account, error } = await supabaseAdmin
      .from('accounts')
      .insert({
        name,
        type: 'investment',
        provider: providerLabel,
        investment_provider: investmentProvider,
        investment_type: investmentType,
        hsbc_account_id: accountReference || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating investment account:', error);
      return NextResponse.json(
        { error: 'Failed to create investment account' },
        { status: 500 }
      );
    }

    const result: InvestmentAccount = {
      id: account.id,
      name: account.name,
      type: 'investment',
      provider: account.provider,
      investmentProvider: account.investment_provider as InvestmentProvider | null,
      investmentType: account.investment_type as InvestmentType | null,
      isActive: account.is_active,
      createdAt: account.created_at,
      updatedAt: account.updated_at,
      latestValuation: null,
    };

    return NextResponse.json({ account: result }, { status: 201 });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
