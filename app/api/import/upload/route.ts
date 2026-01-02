import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { parseCSVString, detectFormat, storeSessionData, detectColumnsFromHeaders } from '@/lib/import';
import type { ImportFormat } from '@/lib/types/import';

export async function POST(request: NextRequest) {
  try {
    // Get the file from form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    const validTypes = ['text/csv', 'application/vnd.ms-excel', 'text/plain'];
    if (!validTypes.includes(file.type) && !file.name.endsWith('.csv')) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload a CSV file.' },
        { status: 400 }
      );
    }

    // Read file content
    const content = await file.text();

    if (!content.trim()) {
      return NextResponse.json(
        { error: 'File is empty' },
        { status: 400 }
      );
    }

    // Parse CSV
    const parseResult = parseCSVString(content);

    if (parseResult.totalRows === 0) {
      return NextResponse.json(
        { error: 'No data rows found in file' },
        { status: 400 }
      );
    }

    // Fetch available formats for detection
    const { data: formats, error: formatsError } = await supabaseAdmin
      .from('import_formats')
      .select('*')
      .order('provider');

    if (formatsError) {
      console.error('Error fetching formats:', formatsError);
      return NextResponse.json(
        { error: 'Failed to fetch import formats' },
        { status: 500 }
      );
    }

    // Detect format
    const sampleRows = parseResult.rows.slice(0, 5);
    const detectionResult = detectFormat(
      parseResult.headers,
      sampleRows,
      formats as unknown as ImportFormat[]
    );

    // Create import session - store ALL rows for recovery after server restart
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('import_sessions')
      .insert({
        filename: file.name,
        format_id: detectionResult.format?.id || null,
        status: 'pending',
        total_rows: parseResult.totalRows,
        raw_data: {
          headers: parseResult.headers,
          rows: parseResult.rows, // Store ALL rows, not just sample
          sampleRows: sampleRows,
          encoding: parseResult.encoding,
          delimiter: parseResult.delimiter,
          sourceType: 'csv',
        },
      })
      .select()
      .single();

    if (sessionError) {
      console.error('Error creating session:', sessionError);
      return NextResponse.json(
        { error: 'Failed to create import session' },
        { status: 500 }
      );
    }

    // Store full data in memory for subsequent requests
    storeSessionData(session.id, {
      headers: parseResult.headers,
      rows: parseResult.rows,
      encoding: parseResult.encoding,
      delimiter: parseResult.delimiter,
    });

    // Get suggested mapping - either from detected format or auto-detect from headers
    let suggestedMapping = detectionResult.suggestedMapping;
    if (!suggestedMapping) {
      suggestedMapping = detectColumnsFromHeaders(parseResult.headers);
    }

    return NextResponse.json({
      sessionId: session.id,
      filename: file.name,
      headers: parseResult.headers,
      sampleRows,
      totalRows: parseResult.totalRows,
      detectedFormat: detectionResult.format
        ? {
            id: detectionResult.format.id,
            name: detectionResult.format.name,
            confidence: detectionResult.confidence,
          }
        : null,
      suggestedMapping,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process file' },
      { status: 500 }
    );
  }
}
