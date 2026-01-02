import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { bulkValuationsSchema } from '@/lib/types/investment';
import type { Database } from '@/lib/supabase/database.types';

type ValuationRow = Database['public']['Tables']['investment_valuations']['Row'];

interface RouteContext {
  params: Promise<{ id: string }>;
}

// =============================================================================
// Helper: Parse date from various formats
// =============================================================================

function parseDate(input: string): string | null {
  // Try YYYY-MM-DD format first
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const date = new Date(input);
    if (!isNaN(date.getTime())) {
      return input;
    }
  }

  // Try DD/MM/YYYY format
  const ddmmyyyy = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }

  // Try Excel serial date (days since 1900-01-01)
  const excelSerial = parseFloat(input);
  if (!isNaN(excelSerial) && excelSerial > 25569 && excelSerial < 100000) {
    // Excel uses 1900-01-01 as day 1, but has a leap year bug (day 60 = Feb 29, 1900)
    const msPerDay = 24 * 60 * 60 * 1000;
    const excelEpoch = new Date(1899, 11, 30).getTime(); // Dec 30, 1899
    const date = new Date(excelEpoch + excelSerial * msPerDay);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }

  // Try ISO date string
  const date = new Date(input);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split('T')[0];
  }

  return null;
}

// =============================================================================
// POST - Bulk import valuations
// =============================================================================

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const validation = bulkValuationsSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { valuations } = validation.data;

    
    // Verify account exists
    const { data: account, error: accountError } = await supabaseAdmin
      .from('accounts')
      .select('id')
      .eq('id', id)
      .eq('type', 'investment')
      .single();

    if (accountError || !account) {
      return NextResponse.json(
        { error: 'Investment account not found' },
        { status: 404 }
      );
    }

    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const errors: { date: string; error: string }[] = [];
    const validValuations: { account_id: string; date: string; value: number; notes: string | null }[] = [];

    // Validate and parse each valuation
    for (const v of valuations) {
      const parsedDate = parseDate(v.date);

      if (!parsedDate) {
        errors.push({ date: v.date, error: 'Invalid date format' });
        continue;
      }

      const valuationDate = new Date(parsedDate);
      if (valuationDate > today) {
        errors.push({ date: v.date, error: 'Date cannot be in the future' });
        continue;
      }

      if (v.value <= 0) {
        errors.push({ date: v.date, error: 'Value must be positive' });
        continue;
      }

      validValuations.push({
        account_id: id,
        date: parsedDate,
        value: v.value,
        notes: v.notes || null,
      });
    }

    if (validValuations.length === 0) {
      return NextResponse.json(
        {
          imported: 0,
          updated: 0,
          errors,
        },
        { status: errors.length > 0 ? 400 : 200 }
      );
    }

    // Get existing dates to determine inserts vs updates
    const dates = validValuations.map((v) => v.date);
    const { data: existingValuations } = await supabaseAdmin
      .from('investment_valuations')
      .select('date')
      .eq('account_id', id)
      .in('date', dates);

    const existingDates = new Set((existingValuations || []).map((v: { date: string }) => v.date));
    const newCount = validValuations.filter((v) => !existingDates.has(v.date)).length;
    const updateCount = validValuations.filter((v) => existingDates.has(v.date)).length;

    // Upsert all valuations
    const { error: upsertError } = await supabaseAdmin
      .from('investment_valuations')
      .upsert(validValuations, {
        onConflict: 'account_id,date',
      });

    if (upsertError) {
      console.error('Error upserting valuations:', upsertError);
      return NextResponse.json(
        { error: 'Failed to import valuations' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      imported: newCount,
      updated: updateCount,
      errors,
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
