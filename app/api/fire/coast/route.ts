import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/fire/coast
 *
 * Calculates the Coast FIRE value - the amount needed today such that
 * with compound growth alone (no further contributions), you'll have
 * enough at retirement to support your spending via the safe withdrawal rate.
 *
 * Formula: Coast FIRE = (Annual Spend / SWR%) / (1 + Return%)^Years Left
 *
 * All values are read directly from fire_inputs (the Settings page).
 */
export async function GET() {
  try {
    // Get fire inputs - single source of truth for Coast FIRE settings
    const { data: inputs, error: inputsError } = await supabaseAdmin
      .from('fire_inputs')
      .select('*')
      .limit(1)
      .single();

    if (inputsError || !inputs) {
      return NextResponse.json({
        error: 'FIRE settings not configured. Please configure your settings on the Investments page.',
        coastFire: null,
      });
    }

    // Get exclude property setting (defaults to true)
    const excludeProperty = inputs.exclude_property_from_fire ?? true;

    // Get all active accounts that are included in net worth
    const { data: accounts, error: accountsError } = await supabaseAdmin
      .from('accounts')
      .select('id, name, type, include_in_net_worth')
      .eq('is_active', true)
      .eq('include_in_net_worth', true);

    if (accountsError) {
      console.error('Error fetching accounts:', accountsError);
      return NextResponse.json(
        { error: 'Failed to fetch accounts' },
        { status: 500 }
      );
    }

    // Filter out property accounts if setting is enabled
    const filteredAccounts = (accounts || []).filter(account => {
      if (excludeProperty && account.type === 'property') {
        return false;
      }
      return true;
    });

    const accountIds = filteredAccounts.map(a => a.id);

    // Use the same RPC function as the Accounts API to get accurate balances
    // This calculates: snapshot_balance + transactions_since_snapshot_date
    type SnapshotBalanceRow = {
      account_id: string;
      snapshot_date: string;
      snapshot_balance: number;
      transactions_sum: number;
      current_balance: number;
    };

    let currentNetWorth = 0;
    if (accountIds.length > 0) {
      const { data: balanceData, error: balanceError } = await supabaseAdmin
        .rpc('get_account_balances_with_snapshots', { account_ids: accountIds }) as {
          data: SnapshotBalanceRow[] | null;
          error: Error | null;
        };

      if (balanceError) {
        console.error('Error fetching snapshot balances:', balanceError);
      } else if (balanceData) {
        for (const row of balanceData) {
          currentNetWorth += row.current_balance;
        }
      }
    }

    // Get settings directly from fire_inputs
    const currentAge = inputs.current_age ?? 40;
    const targetRetirementAge = inputs.target_retirement_age ?? 50;
    const yearsLeft = targetRetirementAge - currentAge;

    const annualSpend = Number(inputs.annual_spend ?? 50000);
    const withdrawalRate = Number(inputs.withdrawal_rate ?? 4) / 100; // Convert from percentage
    const expectedReturn = Number(inputs.expected_return ?? 7) / 100; // Convert from percentage

    // FIRE number needed at retirement = Annual Spend / SWR
    const fireNumberAtRetirement = annualSpend / withdrawalRate;

    // Coast FIRE = FIRE number / (1 + return)^years
    // This is how much you need TODAY to coast to that number
    const coastFireValue = fireNumberAtRetirement / Math.pow(1 + expectedReturn, yearsLeft);

    // Calculate progress
    const coastFireProgress = currentNetWorth / coastFireValue * 100;
    const surplus = currentNetWorth - coastFireValue;

    const response = NextResponse.json({
      coastFire: {
        value: Math.round(coastFireValue),
        fireNumberAtRetirement: Math.round(fireNumberAtRetirement),
        currentNetWorth: Math.round(currentNetWorth),
        progress: Math.round(coastFireProgress * 10) / 10, // 1 decimal place
        surplus: Math.round(surplus),
        isCoastFI: currentNetWorth >= coastFireValue,
      },
      inputs: {
        currentAge,
        targetRetirementAge,
        yearsLeft,
        excludeProperty,
      },
      settings: {
        annualSpend,
        withdrawalRate: inputs.withdrawal_rate ?? 4,
        expectedReturn: inputs.expected_return ?? 7,
      },
    });

    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    return response;
  } catch (error) {
    console.error('GET /api/fire/coast error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
