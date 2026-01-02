import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { previewRequestSchema } from '@/lib/validations/import';
import { getSessionData, storeSessionData, validateRows, validateImport } from '@/lib/import';
import type { ColumnMapping } from '@/lib/validations/import';
import type { ImportFormat } from '@/lib/types/import';
import { ZodError } from 'zod';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = previewRequestSchema.parse(body);

    // Get session data from memory store
    let sessionData = getSessionData(validated.sessionId);

    if (!sessionData) {
      // Try to load from database
      const { data: session, error: sessionError } = await supabaseAdmin
        .from('import_sessions')
        .select('raw_data')
        .eq('id', validated.sessionId)
        .single();

      if (sessionError || !session?.raw_data) {
        return NextResponse.json(
          { error: 'Session not found or expired. Please upload the file again.' },
          { status: 404 }
        );
      }

      // Restore session data from database if rows are stored
      const rawData = session.raw_data as {
        headers?: string[];
        rows?: string[][];
        encoding?: string;
        delimiter?: string;
        sourceType?: 'csv' | 'pdf';
        pdfMetadata?: {
          totalPages: number;
          processedPages: number;
          visionConfidence: number;
          statementPeriod?: { start: string; end: string };
          accountInfo?: { accountNumber?: string; sortCode?: string; accountName?: string };
        };
      };

      if (!rawData.rows || !rawData.headers) {
        return NextResponse.json(
          { error: 'Session data expired. Please upload the file again.' },
          { status: 410 }
        );
      }

      // Restore to memory store
      storeSessionData(validated.sessionId, {
        headers: rawData.headers,
        rows: rawData.rows,
        encoding: rawData.encoding || 'utf-8',
        delimiter: rawData.delimiter || ',',
        sourceType: rawData.sourceType,
        pdfMetadata: rawData.pdfMetadata ? {
          ...rawData.pdfMetadata,
          originalFilename: '', // Not stored in DB
        } : undefined,
      });

      sessionData = getSessionData(validated.sessionId);
      if (!sessionData) {
        return NextResponse.json(
          { error: 'Failed to restore session data' },
          { status: 500 }
        );
      }
    }

    // Get column mapping
    let mapping: ColumnMapping;
    let formatOptions = {
      dateFormat: 'DD/MM/YYYY',
      decimalSeparator: '.' as '.' | ',',
      amountInSingleColumn: true,
      skipRows: 0,
    };

    if (validated.formatId) {
      // Load format from database
      const { data: format, error: formatError } = await supabaseAdmin
        .from('import_formats')
        .select('*')
        .eq('id', validated.formatId)
        .single();

      if (formatError || !format) {
        return NextResponse.json(
          { error: 'Format not found' },
          { status: 404 }
        );
      }

      const importFormat = format as unknown as ImportFormat;
      mapping = importFormat.column_mapping as unknown as ColumnMapping;
      formatOptions = {
        dateFormat: importFormat.date_format,
        decimalSeparator: importFormat.decimal_separator,
        amountInSingleColumn: importFormat.amount_in_single_column,
        skipRows: importFormat.skip_rows,
      };
    } else if (validated.customMapping) {
      mapping = validated.customMapping;
    } else {
      return NextResponse.json(
        { error: 'Either formatId or customMapping is required' },
        { status: 400 }
      );
    }

    // Validate the mapping has required fields
    if (!mapping.date || !mapping.description) {
      return NextResponse.json(
        { error: 'Mapping must include date and description columns' },
        { status: 400 }
      );
    }

    if (!mapping.amount && (!mapping.debit || !mapping.credit)) {
      return NextResponse.json(
        { error: 'Mapping must include amount column or both debit and credit columns' },
        { status: 400 }
      );
    }

    // Validate rows
    // Enable carryForwardDate for PDF imports (date only shown on first tx of each day)
    const { transactions, errors, warnings } = validateRows(
      sessionData.rows,
      sessionData.headers,
      mapping,
      {
        dateFormat: formatOptions.dateFormat,
        decimalSeparator: formatOptions.decimalSeparator,
        amountInSingleColumn: formatOptions.amountInSingleColumn,
        skipRows: formatOptions.skipRows,
        carryForwardDate: sessionData.sourceType === 'pdf',
      }
    );

    // Get aggregate validation
    const validation = validateImport(transactions);

    // Calculate totals
    let totalCredits = 0;
    let totalDebits = 0;
    for (const tx of transactions) {
      if (tx.amount > 0) {
        totalCredits += tx.amount;
      } else {
        totalDebits += Math.abs(tx.amount);
      }
    }

    // Transform errors to format expected by frontend: { row: number; errors: string[] }
    const errorsByRow = new Map<number, string[]>();
    for (const err of errors) {
      const existing = errorsByRow.get(err.rowNumber) || [];
      existing.push(err.message);
      errorsByRow.set(err.rowNumber, existing);
    }
    const transformedErrors = Array.from(errorsByRow.entries()).map(([row, errs]) => ({
      row,
      errors: errs,
    }));

    // Transform warnings to string[]
    const transformedWarnings = [...warnings, ...validation.warnings].map(w =>
      w.rowNumber ? `Row ${w.rowNumber}: ${w.message}` : w.message
    );

    return NextResponse.json({
      transactions,
      validation: {
        totalRows: sessionData.rows.length,
        validRows: transactions.length,
        invalidRows: transformedErrors.length,
        errors: transformedErrors,
        warnings: transformedWarnings,
        dateRange: validation.dateRange
          ? { earliest: validation.dateRange.min, latest: validation.dateRange.max }
          : null,
        totalCredits: Math.round(totalCredits * 100) / 100,
        totalDebits: Math.round(totalDebits * 100) / 100,
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Preview error:', error);
    return NextResponse.json(
      { error: 'Failed to generate preview' },
      { status: 500 }
    );
  }
}
