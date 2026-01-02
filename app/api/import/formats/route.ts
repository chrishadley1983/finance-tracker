import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { importFormatsQuerySchema, createImportFormatSchema } from '@/lib/validations/import';
import { ZodError } from 'zod';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = importFormatsQuerySchema.parse({
      provider: searchParams.get('provider') || undefined,
      includeSystem: searchParams.get('includeSystem') || undefined,
    });

    let queryBuilder = supabaseAdmin
      .from('import_formats')
      .select('*')
      .order('provider')
      .order('name');

    if (query.provider) {
      queryBuilder = queryBuilder.eq('provider', query.provider);
    }

    if (!query.includeSystem) {
      queryBuilder = queryBuilder.eq('is_system', false);
    }

    const { data, error } = await queryBuilder;

    if (error) {
      console.error('Error fetching formats:', error);
      return NextResponse.json(
        { error: 'Failed to fetch import formats' },
        { status: 500 }
      );
    }

    return NextResponse.json({ formats: data });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Formats GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch formats' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = createImportFormatSchema.parse(body);

    // Build the column mapping object
    const columnMapping: Record<string, string> = {
      date: validated.columnMapping.date,
      description: validated.columnMapping.description,
    };

    if (validated.columnMapping.amount) {
      columnMapping.amount = validated.columnMapping.amount;
    }
    if (validated.columnMapping.debit) {
      columnMapping.debit = validated.columnMapping.debit;
    }
    if (validated.columnMapping.credit) {
      columnMapping.credit = validated.columnMapping.credit;
    }
    if (validated.columnMapping.reference) {
      columnMapping.reference = validated.columnMapping.reference;
    }
    if (validated.columnMapping.balance) {
      columnMapping.balance = validated.columnMapping.balance;
    }
    if (validated.columnMapping.category) {
      columnMapping.category = validated.columnMapping.category;
    }

    const { data, error } = await supabaseAdmin
      .from('import_formats')
      .insert({
        name: validated.name,
        provider: validated.provider,
        is_system: false,
        column_mapping: columnMapping,
        date_format: validated.dateFormat,
        has_header: validated.hasHeader,
        skip_rows: validated.skipRows,
        amount_in_single_column: validated.amountInSingleColumn,
        amount_column: validated.amountColumn || null,
        debit_column: validated.debitColumn || null,
        credit_column: validated.creditColumn || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating format:', error);
      return NextResponse.json(
        { error: 'Failed to create import format' },
        { status: 500 }
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Formats POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create format' },
      { status: 500 }
    );
  }
}
