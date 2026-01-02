import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import {
  updateInvestmentAccountSchema,
  INVESTMENT_PROVIDER_LABELS,
  type InvestmentAccount,
  type InvestmentProvider,
  type InvestmentType,
} from '@/lib/types/investment';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// =============================================================================
// GET - Get single investment account with latest valuation
// =============================================================================

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const { data: account, error: accountError } = await supabaseAdmin
      .from('accounts')
      .select('*')
      .eq('id', id)
      .eq('type', 'investment')
      .single();

    if (accountError || !account) {
      return NextResponse.json(
        { error: 'Investment account not found' },
        { status: 404 }
      );
    }

    // Get latest valuation
    const { data: latestVal } = await supabaseAdmin
      .from('investment_valuations')
      .select('*')
      .eq('account_id', id)
      .order('date', { ascending: false })
      .limit(1)
      .single();

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

    return NextResponse.json({ account: result });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

// =============================================================================
// PATCH - Update investment account
// =============================================================================

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const validation = updateInvestmentAccountSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    
    // Verify account exists
    const { data: existing, error: checkError } = await supabaseAdmin
      .from('accounts')
      .select('id')
      .eq('id', id)
      .eq('type', 'investment')
      .single();

    if (checkError || !existing) {
      return NextResponse.json(
        { error: 'Investment account not found' },
        { status: 404 }
      );
    }

    const updates: Record<string, unknown> = {};

    if (validation.data.name !== undefined) {
      updates.name = validation.data.name;
    }
    if (validation.data.investmentProvider !== undefined) {
      updates.investment_provider = validation.data.investmentProvider;
      updates.provider = INVESTMENT_PROVIDER_LABELS[validation.data.investmentProvider];
    }
    if (validation.data.investmentType !== undefined) {
      updates.investment_type = validation.data.investmentType;
    }
    if (validation.data.accountReference !== undefined) {
      updates.hsbc_account_id = validation.data.accountReference;
    }
    if (validation.data.isActive !== undefined) {
      updates.is_active = validation.data.isActive;
    }

    const { data: account, error } = await supabaseAdmin
      .from('accounts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating investment account:', error);
      return NextResponse.json(
        { error: 'Failed to update investment account' },
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
    };

    return NextResponse.json({ account: result });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE - Delete investment account (cascades valuations)
// =============================================================================

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    
    // Verify account exists
    const { data: existing, error: checkError } = await supabaseAdmin
      .from('accounts')
      .select('id')
      .eq('id', id)
      .eq('type', 'investment')
      .single();

    if (checkError || !existing) {
      return NextResponse.json(
        { error: 'Investment account not found' },
        { status: 404 }
      );
    }

    const { error } = await supabaseAdmin
      .from('accounts')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting investment account:', error);
      return NextResponse.json(
        { error: 'Failed to delete investment account' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
