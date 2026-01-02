import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { updateFireScenarioSchema, type FireScenario } from '@/lib/types/fire';
import type { Database } from '@/lib/supabase/database.types';

type ScenarioRow = Database['public']['Tables']['fire_scenarios']['Row'];

interface RouteContext {
  params: Promise<{ id: string }>;
}

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

// =============================================================================
// GET - Get single scenario
// =============================================================================

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const { data: scenario, error } = await supabaseAdmin
      .from('fire_scenarios')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !scenario) {
      return NextResponse.json(
        { error: 'Scenario not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ scenario: mapScenarioRow(scenario) });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

// =============================================================================
// PATCH - Update scenario
// =============================================================================

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const validation = updateFireScenarioSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    // Verify scenario exists
    const { data: existing, error: checkError } = await supabaseAdmin
      .from('fire_scenarios')
      .select('id')
      .eq('id', id)
      .single();

    if (checkError || !existing) {
      return NextResponse.json(
        { error: 'Scenario not found' },
        { status: 404 }
      );
    }

    const data = validation.data;
    const updates: Record<string, unknown> = {};

    if (data.name !== undefined) updates.name = data.name;
    if (data.description !== undefined) updates.description = data.description;
    if (data.annualSpend !== undefined) updates.annual_spend = data.annualSpend;
    if (data.withdrawalRate !== undefined) updates.withdrawal_rate = data.withdrawalRate;
    if (data.expectedReturn !== undefined) updates.expected_return = data.expectedReturn;
    if (data.inflationRate !== undefined) updates.inflation_rate = data.inflationRate;
    if (data.retirementAge !== undefined) updates.retirement_age = data.retirementAge;
    if (data.statePensionAge !== undefined) updates.state_pension_age = data.statePensionAge;
    if (data.statePensionAnnual !== undefined) updates.state_pension_annual = data.statePensionAnnual;
    if (data.isDefault !== undefined) updates.is_default = data.isDefault;
    if (data.sortOrder !== undefined) updates.sort_order = data.sortOrder;

    const { data: scenario, error } = await supabaseAdmin
      .from('fire_scenarios')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating scenario:', error);
      return NextResponse.json(
        { error: 'Failed to update scenario' },
        { status: 500 }
      );
    }

    return NextResponse.json({ scenario: mapScenarioRow(scenario) });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE - Delete scenario
// =============================================================================

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    // Verify scenario exists
    const { data: existing, error: checkError } = await supabaseAdmin
      .from('fire_scenarios')
      .select('id')
      .eq('id', id)
      .single();

    if (checkError || !existing) {
      return NextResponse.json(
        { error: 'Scenario not found' },
        { status: 404 }
      );
    }

    const { error } = await supabaseAdmin
      .from('fire_scenarios')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting scenario:', error);
      return NextResponse.json(
        { error: 'Failed to delete scenario' },
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
