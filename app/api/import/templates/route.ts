/**
 * Import Templates API
 *
 * GET  /api/import/templates - List user templates (ordered by last_used_at)
 * POST /api/import/templates - Create a new template from current mapping
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { z } from 'zod';
import { columnMappingBaseSchema } from '@/lib/validations/import';

// =============================================================================
// SCHEMAS
// =============================================================================

const createTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required').max(100),
  provider: z.string().min(1, 'Provider is required').max(100),
  columnMapping: columnMappingBaseSchema,
  dateFormat: z.string().min(1).default('DD/MM/YYYY'),
  decimalSeparator: z.enum(['.', ',']).default('.'),
  hasHeader: z.boolean().default(true),
  skipRows: z.number().int().min(0).default(0),
  amountInSingleColumn: z.boolean(),
  amountColumn: z.string().optional(),
  debitColumn: z.string().optional(),
  creditColumn: z.string().optional(),
  sampleHeaders: z.array(z.string()).optional(),
  notes: z.string().max(500).optional(),
});

// =============================================================================
// GET - List user templates
// =============================================================================

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('import_formats')
      .select('*')
      .eq('is_system', false)
      .order('last_used_at', { ascending: false, nullsFirst: false })
      .order('use_count', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching templates:', error);
      return NextResponse.json(
        { error: 'Failed to fetch templates' },
        { status: 500 }
      );
    }

    return NextResponse.json({ templates: data });
  } catch (error) {
    console.error('Templates GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST - Create new template
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = createTemplateSchema.parse(body);

    // Build column mapping object
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
        decimal_separator: validated.decimalSeparator,
        has_header: validated.hasHeader,
        skip_rows: validated.skipRows,
        amount_in_single_column: validated.amountInSingleColumn,
        amount_column: validated.amountColumn || null,
        debit_column: validated.debitColumn || null,
        credit_column: validated.creditColumn || null,
        sample_headers: validated.sampleHeaders || null,
        notes: validated.notes || null,
        use_count: 0,
        last_used_at: null,
      })
      .select()
      .single();

    if (error) {
      // Check for duplicate name
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'A template with this name already exists' },
          { status: 409 }
        );
      }
      console.error('Error creating template:', error);
      return NextResponse.json(
        { error: 'Failed to create template' },
        { status: 500 }
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Templates POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create template' },
      { status: 500 }
    );
  }
}
