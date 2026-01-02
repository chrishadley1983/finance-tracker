import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { createFireScenarioSchema, type FireScenario } from '@/lib/types/fire';
import type { Database } from '@/lib/supabase/database.types';

type ScenarioRow = Database['public']['Tables']['fire_scenarios']['Row'];

function mapScenarioRow(row: ScenarioRow): FireScenario {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    annualSpend: row.annual_spend,
    withdrawalRate: row.withdrawal_rate,
    expectedReturn: row.expected_return,
    inflationRate: row.inflation_rate,
    retirementAge: row.retirement_age,
    statePensionAge: row.state_pension_age,
    statePensionAnnual: row.state_pension_annual,
    isDefault: row.is_default,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// =============================================================================
// GET - List all FIRE scenarios
// =============================================================================

export async function GET() {
  try {
    const { data: scenarios, error } = await supabaseAdmin
      .from('fire_scenarios')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching scenarios:', error);
      return NextResponse.json(
        { error: 'Failed to fetch scenarios' },
        { status: 500 }
      );
    }

    const result = (scenarios || []).map(mapScenarioRow);
    return NextResponse.json({ scenarios: result });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST - Create new FIRE scenario
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = createFireScenarioSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Get max sort order
    const { data: maxOrder } = await supabaseAdmin
      .from('fire_scenarios')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .single();

    const sortOrder = (maxOrder?.sort_order ?? 0) + 1;

    const { data: scenario, error } = await supabaseAdmin
      .from('fire_scenarios')
      .insert({
        name: data.name,
        description: data.description || null,
        annual_spend: data.annualSpend,
        withdrawal_rate: data.withdrawalRate,
        expected_return: data.expectedReturn,
        inflation_rate: data.inflationRate,
        retirement_age: data.retirementAge || null,
        state_pension_age: data.statePensionAge,
        state_pension_annual: data.statePensionAnnual,
        is_default: data.isDefault,
        sort_order: sortOrder,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating scenario:', error);
      return NextResponse.json(
        { error: 'Failed to create scenario' },
        { status: 500 }
      );
    }

    return NextResponse.json({ scenario: mapScenarioRow(scenario) }, { status: 201 });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
