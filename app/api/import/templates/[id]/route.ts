/**
 * Individual Template API
 *
 * GET    /api/import/templates/[id] - Get single template
 * PATCH  /api/import/templates/[id] - Update template
 * DELETE /api/import/templates/[id] - Delete template
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { z } from 'zod';
import { columnMappingBaseSchema } from '@/lib/validations/import';

// =============================================================================
// SCHEMAS
// =============================================================================

const updateTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  provider: z.string().min(1).max(100).optional(),
  columnMapping: columnMappingBaseSchema.optional(),
  dateFormat: z.string().min(1).optional(),
  decimalSeparator: z.enum(['.', ',']).optional(),
  hasHeader: z.boolean().optional(),
  skipRows: z.number().int().min(0).optional(),
  amountInSingleColumn: z.boolean().optional(),
  amountColumn: z.string().nullable().optional(),
  debitColumn: z.string().nullable().optional(),
  creditColumn: z.string().nullable().optional(),
  sampleHeaders: z.array(z.string()).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

// =============================================================================
// GET - Get single template
// =============================================================================

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate UUID format
    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json(
        { error: 'Invalid template ID' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('import_formats')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Template not found' },
          { status: 404 }
        );
      }
      console.error('Error fetching template:', error);
      return NextResponse.json(
        { error: 'Failed to fetch template' },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Template GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch template' },
      { status: 500 }
    );
  }
}

// =============================================================================
// PATCH - Update template
// =============================================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate UUID format
    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json(
        { error: 'Invalid template ID' },
        { status: 400 }
      );
    }

    // Check template exists and is not a system template
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('import_formats')
      .select('is_system')
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Template not found' },
          { status: 404 }
        );
      }
      throw fetchError;
    }

    if (existing.is_system) {
      return NextResponse.json(
        { error: 'System templates cannot be modified' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validated = updateTemplateSchema.parse(body);

    // Build update object
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (validated.name !== undefined) {
      updateData.name = validated.name;
    }
    if (validated.provider !== undefined) {
      updateData.provider = validated.provider;
    }
    if (validated.dateFormat !== undefined) {
      updateData.date_format = validated.dateFormat;
    }
    if (validated.decimalSeparator !== undefined) {
      updateData.decimal_separator = validated.decimalSeparator;
    }
    if (validated.hasHeader !== undefined) {
      updateData.has_header = validated.hasHeader;
    }
    if (validated.skipRows !== undefined) {
      updateData.skip_rows = validated.skipRows;
    }
    if (validated.amountInSingleColumn !== undefined) {
      updateData.amount_in_single_column = validated.amountInSingleColumn;
    }
    if (validated.amountColumn !== undefined) {
      updateData.amount_column = validated.amountColumn;
    }
    if (validated.debitColumn !== undefined) {
      updateData.debit_column = validated.debitColumn;
    }
    if (validated.creditColumn !== undefined) {
      updateData.credit_column = validated.creditColumn;
    }
    if (validated.sampleHeaders !== undefined) {
      updateData.sample_headers = validated.sampleHeaders;
    }
    if (validated.notes !== undefined) {
      updateData.notes = validated.notes;
    }

    // Handle column mapping update
    if (validated.columnMapping) {
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
      updateData.column_mapping = columnMapping;
    }

    const { data, error } = await supabaseAdmin
      .from('import_formats')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'A template with this name already exists' },
          { status: 409 }
        );
      }
      console.error('Error updating template:', error);
      return NextResponse.json(
        { error: 'Failed to update template' },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Template PATCH error:', error);
    return NextResponse.json(
      { error: 'Failed to update template' },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE - Delete template
// =============================================================================

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate UUID format
    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json(
        { error: 'Invalid template ID' },
        { status: 400 }
      );
    }

    // Check template exists and is not a system template
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('import_formats')
      .select('is_system')
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Template not found' },
          { status: 404 }
        );
      }
      throw fetchError;
    }

    if (existing.is_system) {
      return NextResponse.json(
        { error: 'System templates cannot be deleted' },
        { status: 403 }
      );
    }

    const { error } = await supabaseAdmin
      .from('import_formats')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting template:', error);
      return NextResponse.json(
        { error: 'Failed to delete template' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Template DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete template' },
      { status: 500 }
    );
  }
}
