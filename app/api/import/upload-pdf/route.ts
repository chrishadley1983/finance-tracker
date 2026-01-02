import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { storeSessionData } from '@/lib/import/session-store';
import { extractPagesAsImages, PdfExtractionError } from '@/lib/import/pdf-extractor';
import {
  parseAllPages,
  convertToImportFormat,
  getPdfColumnMapping,
  PdfVisionError,
} from '@/lib/import/pdf-vision-parser';

/**
 * POST /api/import/upload-pdf
 *
 * Upload a PDF bank statement and extract transactions using Claude Vision.
 * Returns same structure as /api/import/upload for CSV compatibility.
 */
export async function POST(request: NextRequest) {
  try {
    // Get the file from form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload a PDF file.' },
        { status: 400 }
      );
    }

    // Read file as buffer
    const arrayBuffer = await file.arrayBuffer();
    const pdfBuffer = Buffer.from(arrayBuffer);

    // Extract pages as images
    let extractionResult;
    try {
      extractionResult = await extractPagesAsImages(pdfBuffer, file.name);
    } catch (error) {
      if (error instanceof PdfExtractionError) {
        const statusCode = error.code === 'PDF_TOO_LARGE' ? 413 : 400;
        return NextResponse.json({ error: error.message }, { status: statusCode });
      }
      throw error;
    }

    // Check if we have an API key for Vision
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'PDF processing is not configured. Missing API key.' },
        { status: 503 }
      );
    }

    // Parse pages using Claude Vision
    let parseResult;
    try {
      parseResult = await parseAllPages(extractionResult.pages, 'hsbc_current');
    } catch (error) {
      if (error instanceof PdfVisionError) {
        const statusCode =
          error.code === 'RATE_LIMITED'
            ? 429
            : error.code === 'TIMEOUT'
              ? 504
              : error.code === 'NO_TRANSACTIONS'
                ? 400
                : 500;
        return NextResponse.json({ error: error.message }, { status: statusCode });
      }
      throw error;
    }

    // Convert to standard import format (headers + rows)
    const { headers, rows } = convertToImportFormat(parseResult.allTransactions);

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'No transactions found in the PDF' },
        { status: 400 }
      );
    }

    // Create import session in database - store ALL rows for recovery after server restart
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('import_sessions')
      .insert({
        filename: file.name,
        format_id: null, // PDF format not in database
        status: 'pending',
        total_rows: rows.length,
        raw_data: {
          headers,
          rows, // Store ALL rows, not just sample
          sampleRows: rows.slice(0, 5),
          encoding: 'utf-8',
          delimiter: ',',
          sourceType: 'pdf',
          pdfMetadata: {
            totalPages: extractionResult.totalPages,
            processedPages: extractionResult.pages.length,
            visionConfidence: parseResult.totalConfidence,
            statementPeriod: parseResult.statementPeriod,
            accountInfo: parseResult.accountInfo,
          },
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
      headers,
      rows,
      encoding: 'utf-8',
      delimiter: ',',
      sourceType: 'pdf',
      pdfMetadata: {
        totalPages: extractionResult.totalPages,
        processedPages: extractionResult.pages.length,
        visionConfidence: parseResult.totalConfidence,
        originalFilename: file.name,
        statementPeriod: parseResult.statementPeriod,
        accountInfo: parseResult.accountInfo,
      },
    });

    // Return response compatible with CSV upload
    return NextResponse.json({
      sessionId: session.id,
      filename: file.name,
      headers,
      sampleRows: rows.slice(0, 5),
      totalRows: rows.length,
      detectedFormat: {
        id: 'pdf_hsbc_current',
        name: 'HSBC PDF Statement',
        confidence: parseResult.totalConfidence,
      },
      suggestedMapping: getPdfColumnMapping(),
      sourceType: 'pdf',
      pdfMetadata: {
        totalPages: extractionResult.totalPages,
        processedPages: extractionResult.pages.length,
        visionConfidence: parseResult.totalConfidence,
        statementPeriod: parseResult.statementPeriod,
        accountInfo: parseResult.accountInfo,
      },
    });
  } catch (error) {
    console.error('PDF upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process PDF' },
      { status: 500 }
    );
  }
}
