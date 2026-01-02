/**
 * PDF Extractor
 *
 * Converts PDF pages to images for Vision API processing.
 * Uses pdf-to-img library which wraps pdfjs-dist.
 */

import { pdf } from 'pdf-to-img';

// =============================================================================
// TYPES
// =============================================================================

export interface PdfPage {
  pageNumber: number;
  imageBuffer: Buffer;
  width: number;
  height: number;
}

export interface PdfExtractionResult {
  pages: PdfPage[];
  totalPages: number;
  metadata: {
    filename: string;
    fileSize: number;
  };
}

export interface PdfExtractionOptions {
  /** DPI for rendering (default: 150) */
  dpi?: number;
  /** Maximum pages to process (default: 10) */
  maxPages?: number;
  /** Starting page (1-indexed, default: 1) */
  startPage?: number;
}

// =============================================================================
// ERROR HANDLING
// =============================================================================

export class PdfExtractionError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'INVALID_PDF'
      | 'PDF_TOO_LARGE'
      | 'PDF_PASSWORD_PROTECTED'
      | 'CONVERSION_FAILED'
      | 'NO_PAGES'
  ) {
    super(message);
    this.name = 'PdfExtractionError';
  }
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_OPTIONS: Required<PdfExtractionOptions> = {
  dpi: 150,
  maxPages: 10,
  startPage: 1,
};

// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// =============================================================================
// MAIN FUNCTIONS
// =============================================================================

/**
 * Extract pages from a PDF buffer as PNG images.
 */
export async function extractPagesAsImages(
  pdfBuffer: Buffer,
  filename: string,
  options: PdfExtractionOptions = {}
): Promise<PdfExtractionResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Validate file size
  if (pdfBuffer.length > MAX_FILE_SIZE) {
    throw new PdfExtractionError(
      `PDF exceeds maximum size of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
      'PDF_TOO_LARGE'
    );
  }

  // Validate PDF magic bytes
  if (!isPdfBuffer(pdfBuffer)) {
    throw new PdfExtractionError('The uploaded file is not a valid PDF', 'INVALID_PDF');
  }

  try {
    const pages: PdfPage[] = [];
    let pageNumber = 0;

    // pdf-to-img returns an async iterator of page images
    const document = await pdf(pdfBuffer, {
      scale: opts.dpi / 72, // Convert DPI to scale (72 DPI is baseline)
    });

    for await (const image of document) {
      pageNumber++;

      // Skip pages before startPage
      if (pageNumber < opts.startPage) {
        continue;
      }

      // Stop if we've reached maxPages
      if (pages.length >= opts.maxPages) {
        break;
      }

      // image is a Buffer containing PNG data
      pages.push({
        pageNumber,
        imageBuffer: image,
        width: 0, // pdf-to-img doesn't expose dimensions easily
        height: 0,
      });
    }

    if (pages.length === 0) {
      throw new PdfExtractionError('No pages could be extracted from the PDF', 'NO_PAGES');
    }

    return {
      pages,
      totalPages: pageNumber,
      metadata: {
        filename,
        fileSize: pdfBuffer.length,
      },
    };
  } catch (error) {
    // Handle specific pdf-to-img errors
    if (error instanceof PdfExtractionError) {
      throw error;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);

    if (errorMessage.includes('password')) {
      throw new PdfExtractionError(
        'Password-protected PDFs are not supported',
        'PDF_PASSWORD_PROTECTED'
      );
    }

    throw new PdfExtractionError(`Failed to process PDF: ${errorMessage}`, 'CONVERSION_FAILED');
  }
}

/**
 * Check if a buffer appears to be a valid PDF (check magic bytes).
 */
export function isPdfBuffer(buffer: Buffer): boolean {
  // PDF files start with "%PDF-"
  if (buffer.length < 5) {
    return false;
  }

  const header = buffer.subarray(0, 5).toString('ascii');
  return header === '%PDF-';
}

/**
 * Get PDF info without full extraction (useful for validation).
 */
export async function getPdfInfo(
  pdfBuffer: Buffer
): Promise<{ pageCount: number; isValid: boolean }> {
  if (!isPdfBuffer(pdfBuffer)) {
    return { pageCount: 0, isValid: false };
  }

  try {
    let pageCount = 0;
    const document = await pdf(pdfBuffer, { scale: 0.1 }); // Low scale for speed

    for await (const _ of document) {
      pageCount++;
    }

    return { pageCount, isValid: true };
  } catch {
    return { pageCount: 0, isValid: false };
  }
}
