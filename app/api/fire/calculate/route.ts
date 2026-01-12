import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import {
  calculateFireRequestSchema,
  type FireScenario,
  type FireInputs,
  type FireResult,
} from '@/lib/types/fire';
import { calculateFireProjection } from '@/lib/fire/calculator';
import type { Database } from '@/lib/supabase/database.types';

type ScenarioRow = Database['public']['Tables']['fire_scenarios']['Row'];
type InputsRow = Database['public']['Tables']['fire_inputs']['Row'];

function mapScenarioRow(row: ScenarioRow): FireScenario {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    annualSpend: row.annual_spend ?? 0,
    withdrawalRate: row.withdrawal_rate ?? 4,
    expectedReturn: row.expected_return ?? 7,
    inflationRate: row.inflation_rate ?? 2.5,
    retirementAge: row.retirement_age,
    statePensionAge: row.state_pension_age ?? 67,
    statePensionAnnual: row.state_pension_annual ?? 11500,
    isDefault: row.is_default ?? false,
    sortOrder: row.sort_order ?? 0,
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? new Date().toISOString(),
  };
}

function mapInputsRow(row: InputsRow): FireInputs {
  return {
    id: row.id,
    currentAge: row.current_age ?? 35,
    targetRetirementAge: row.target_retirement_age,
    currentPortfolioValue: row.current_portfolio_value,
    annualIncome: row.annual_income,
    annualSavings: row.annual_savings,
    annualSpend: row.annual_spend ?? 50000,
    withdrawalRate: row.withdrawal_rate ?? 4,
    expectedReturn: row.expected_return ?? 7,
    includeStatePension: row.include_state_pension ?? true,
    partnerStatePension: row.partner_state_pension ?? false,
    excludePropertyFromFire: row.exclude_property_from_fire ?? true,
    updatedAt: row.updated_at ?? new Date().toISOString(),
  };
}

// =============================================================================
// POST - Calculate FIRE projections
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = calculateFireRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { scenarioIds, inputOverrides } = validation.data;

    // Get scenarios
    let scenariosQuery = supabaseAdmin
      .from('fire_scenarios')
      .select('*')
      .order('sort_order', { ascending: true });

    if (scenarioIds && scenarioIds.length > 0) {
      scenariosQuery = scenariosQuery.in('id', scenarioIds);
    }

    const { data: scenarioRows, error: scenariosError } = await scenariosQuery;

    if (scenariosError) {
      console.error('Error fetching scenarios:', scenariosError);
      return NextResponse.json(
        { error: 'Failed to fetch scenarios' },
        { status: 500 }
      );
    }

    if (!scenarioRows || scenarioRows.length === 0) {
      return NextResponse.json(
        { error: 'No scenarios found' },
        { status: 404 }
      );
    }

    const scenarios = scenarioRows.map(mapScenarioRow);

    // Get inputs
    const { data: inputsRow, error: inputsError } = await supabaseAdmin
      .from('fire_inputs')
      .select('*')
      .limit(1)
      .single();

    if (inputsError && inputsError.code !== 'PGRST116') {
      console.error('Error fetching inputs:', inputsError);
      return NextResponse.json(
        { error: 'Failed to fetch inputs' },
        { status: 500 }
      );
    }

    // Build inputs with defaults and overrides
    let inputs: FireInputs;

    if (inputsRow) {
      inputs = mapInputsRow(inputsRow);
    } else {
      inputs = {
        id: '',
        currentAge: 35,
        targetRetirementAge: 55,
        currentPortfolioValue: null,
        annualIncome: null,
        annualSavings: null,
        annualSpend: 50000,
        withdrawalRate: 4,
        expectedReturn: 7,
        includeStatePension: true,
        partnerStatePension: false,
        excludePropertyFromFire: true,
        updatedAt: new Date().toISOString(),
      };
    }

    // Apply overrides
    if (inputOverrides) {
      if (inputOverrides.currentAge !== undefined) {
        inputs.currentAge = inputOverrides.currentAge;
      }
      if (inputOverrides.targetRetirementAge !== undefined) {
        inputs.targetRetirementAge = inputOverrides.targetRetirementAge;
      }
      if (inputOverrides.currentPortfolioValue !== undefined) {
        inputs.currentPortfolioValue = inputOverrides.currentPortfolioValue;
      }
      if (inputOverrides.annualIncome !== undefined) {
        inputs.annualIncome = inputOverrides.annualIncome;
      }
      if (inputOverrides.annualSavings !== undefined) {
        inputs.annualSavings = inputOverrides.annualSavings;
      }
      if (inputOverrides.includeStatePension !== undefined) {
        inputs.includeStatePension = inputOverrides.includeStatePension;
      }
      if (inputOverrides.partnerStatePension !== undefined) {
        inputs.partnerStatePension = inputOverrides.partnerStatePension;
      }
    }

    // If no portfolio value, try to calculate from investment accounts
    if (inputs.currentPortfolioValue === null) {
      const { data: accounts } = await supabaseAdmin
        .from('accounts')
        .select('id')
        .eq('type', 'investment')
        .eq('is_active', true);

      if (accounts && accounts.length > 0) {
        const accountIds = accounts.map((a: { id: string }) => a.id);

        const { data: valuations } = await supabaseAdmin
          .from('investment_valuations')
          .select('account_id, value, date')
          .in('account_id', accountIds)
          .order('date', { ascending: false });

        // Get latest per account
        const latestByAccount = new Map<string, number>();
        for (const v of valuations || []) {
          if (!latestByAccount.has(v.account_id)) {
            latestByAccount.set(v.account_id, v.value);
          }
        }

        const totalPortfolio = Array.from(latestByAccount.values()).reduce(
          (a, b) => a + b,
          0
        );

        if (totalPortfolio > 0) {
          inputs.currentPortfolioValue = totalPortfolio;
        }
      }
    }

    // Calculate projections for each scenario
    const results: FireResult[] = scenarios.map((scenario) =>
      calculateFireProjection(inputs, scenario)
    );

    return NextResponse.json({
      results,
      inputs,
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
