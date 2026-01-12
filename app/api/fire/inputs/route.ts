import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { fireInputsSchema, type FireInputs } from '@/lib/types/fire';
import type { Database } from '@/lib/supabase/database.types';

type InputsRow = Database['public']['Tables']['fire_inputs']['Row'];

function mapInputsRow(row: InputsRow): FireInputs {
  return {
    id: row.id,
    currentAge: row.current_age ?? 35,
    dateOfBirth: row.date_of_birth,
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
    normalFireSpend: row.normal_fire_spend ?? 55000,
    fatFireSpend: row.fat_fire_spend ?? 65000,
    updatedAt: row.updated_at ?? new Date().toISOString(),
  };
}

// =============================================================================
// GET - Get current FIRE inputs
// =============================================================================

export async function GET() {
  try {
    // Get the single inputs row (there should only be one)
    const { data: inputs, error } = await supabaseAdmin
      .from('fire_inputs')
      .select('*')
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching inputs:', error);
      return NextResponse.json(
        { error: 'Failed to fetch inputs' },
        { status: 500 }
      );
    }

    if (!inputs) {
      // Return default inputs if none exist
      const defaults: Omit<FireInputs, 'id' | 'updatedAt'> = {
        currentAge: 35,
        dateOfBirth: null,
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
        normalFireSpend: 55000,
        fatFireSpend: 65000,
      };
      return NextResponse.json({ inputs: defaults, isNew: true });
    }

    return NextResponse.json({ inputs: mapInputsRow(inputs), isNew: false });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

// =============================================================================
// PUT - Update or create FIRE inputs (upsert)
// =============================================================================

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = fireInputsSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Check if inputs exist
    const { data: existing } = await supabaseAdmin
      .from('fire_inputs')
      .select('id')
      .limit(1)
      .single();

    let result;

    if (existing) {
      // Update existing
      const { data: updated, error } = await supabaseAdmin
        .from('fire_inputs')
        .update({
          current_age: data.currentAge,
          date_of_birth: data.dateOfBirth || null,
          target_retirement_age: data.targetRetirementAge || null,
          current_portfolio_value: data.currentPortfolioValue || null,
          annual_income: data.annualIncome || null,
          annual_savings: data.annualSavings || null,
          annual_spend: data.annualSpend,
          withdrawal_rate: data.withdrawalRate,
          expected_return: data.expectedReturn,
          include_state_pension: data.includeStatePension,
          partner_state_pension: data.partnerStatePension,
          exclude_property_from_fire: data.excludePropertyFromFire,
          normal_fire_spend: data.normalFireSpend,
          fat_fire_spend: data.fatFireSpend,
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating inputs:', error);
        return NextResponse.json(
          { error: 'Failed to update inputs' },
          { status: 500 }
        );
      }

      result = updated;
    } else {
      // Insert new
      const { data: created, error } = await supabaseAdmin
        .from('fire_inputs')
        .insert({
          current_age: data.currentAge,
          date_of_birth: data.dateOfBirth || null,
          target_retirement_age: data.targetRetirementAge || null,
          current_portfolio_value: data.currentPortfolioValue || null,
          annual_income: data.annualIncome || null,
          annual_savings: data.annualSavings || null,
          annual_spend: data.annualSpend,
          withdrawal_rate: data.withdrawalRate,
          expected_return: data.expectedReturn,
          include_state_pension: data.includeStatePension,
          partner_state_pension: data.partnerStatePension,
          exclude_property_from_fire: data.excludePropertyFromFire,
          normal_fire_spend: data.normalFireSpend,
          fat_fire_spend: data.fatFireSpend,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating inputs:', error);
        return NextResponse.json(
          { error: 'Failed to create inputs' },
          { status: 500 }
        );
      }

      result = created;
    }

    return NextResponse.json({ inputs: mapInputsRow(result) });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
