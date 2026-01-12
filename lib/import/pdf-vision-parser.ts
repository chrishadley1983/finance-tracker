/**
 * PDF Vision Parser
 *
 * Uses Claude's Vision API to extract transaction data from PDF page images.
 * Follows patterns from lib/categorisation/ai-categoriser.ts.
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  getPromptForFormat,
  validateVisionResponse,
  parseAIResponse,
  type StatementFormat,
  type ExtractedTransaction,
  type VisionExtractionResponse,
} from './prompts/pdf-statement';
import type { PdfPage } from './pdf-extractor';

// =============================================================================
// CONFIGURATION
// =============================================================================

const VISION_CONFIG = {
  model: 'claude-sonnet-4-20250514',
  maxTokens: 4096,
  timeout: 60000, // 60 seconds (longer than text due to image processing)
  maxRetries: 1,
};

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Normalize payment type strings to fix OCR issues.
 * E.g., "))))" becomes ")))" for contactless payments.
 */
function normalizePaymentType(paymentType: string): string {
  const trimmed = paymentType.trim();

  // Fix contactless symbol variations (OCR often adds extra parentheses)
  if (trimmed.match(/^\)+$/)) {
    return ')))'; // Standardize to )))
  }

  // Known payment types - return as-is
  const knownTypes = ['DD', 'VIS', 'CR', 'FPI', 'FPO', 'CHQ', 'DR', 'SO', 'TFR', 'ATM'];
  const upper = trimmed.toUpperCase();
  if (knownTypes.includes(upper)) {
    return upper;
  }

  return trimmed;
}

// =============================================================================
// ERROR HANDLING
// =============================================================================

export class PdfVisionError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'API_ERROR'
      | 'PARSE_ERROR'
      | 'INVALID_RESPONSE'
      | 'RATE_LIMITED'
      | 'TIMEOUT'
      | 'NO_TRANSACTIONS'
      | 'IMAGE_TOO_LARGE'
  ) {
    super(message);
    this.name = 'PdfVisionError';
  }
}

// =============================================================================
// TYPES
// =============================================================================

export interface PageParseResult {
  pageNumber: number;
  transactions: ExtractedTransaction[];
  confidence: number;
  warnings: string[];
  statementPeriod?: {
    start: string;
    end: string;
  };
  accountInfo?: {
    accountNumber?: string;
    sortCode?: string;
    accountName?: string;
  };
}

export interface FullParseResult {
  allTransactions: ExtractedTransaction[];
  pageResults: PageParseResult[];
  totalConfidence: number;
  totalPages: number;
  statementPeriod?: {
    start: string;
    end: string;
  };
  accountInfo?: {
    accountNumber?: string;
    sortCode?: string;
    accountName?: string;
  };
}

// =============================================================================
// MAIN FUNCTIONS
// =============================================================================

/**
 * Parse a single PDF page image using Claude Vision.
 */
export async function parseStatementPage(
  imageBuffer: Buffer,
  pageNumber: number,
  format: StatementFormat = 'hsbc_current'
): Promise<PageParseResult> {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const prompt = getPromptForFormat(format);
  const base64Image = imageBuffer.toString('base64');

  // Check image size (Vision API limit is ~20MB base64, but we'll be conservative)
  if (base64Image.length > 15 * 1024 * 1024) {
    throw new PdfVisionError(
      `Page ${pageNumber} image is too large for processing`,
      'IMAGE_TOO_LARGE'
    );
  }

  let attempts = 0;
  const maxAttempts = VISION_CONFIG.maxRetries + 1;

  while (attempts < maxAttempts) {
    attempts++;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), VISION_CONFIG.timeout);

      const message = await client.messages.create({
        model: VISION_CONFIG.model,
        max_tokens: VISION_CONFIG.maxTokens,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/png',
                  data: base64Image,
                },
              },
              {
                type: 'text',
                text: prompt,
              },
            ],
          },
        ],
      });

      clearTimeout(timeoutId);

      // Extract text response
      const textContent = message.content.find((c) => c.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        throw new PdfVisionError('No text response from Vision API', 'INVALID_RESPONSE');
      }

      // Parse JSON response
      let parsed: unknown;
      try {
        parsed = parseAIResponse(textContent.text);
      } catch (parseError) {
        // Retry on parse error
        if (attempts < maxAttempts) {
          console.warn(`Page ${pageNumber}: Parse error, retrying...`, parseError);
          continue;
        }
        throw new PdfVisionError(
          `Failed to parse Vision API response: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
          'PARSE_ERROR'
        );
      }

      // Validate response structure
      if (!validateVisionResponse(parsed)) {
        console.warn(`Page ${pageNumber}: Invalid response structure. Received:`, JSON.stringify(parsed, null, 2));
        if (attempts < maxAttempts) {
          console.warn(`Page ${pageNumber}: Retrying...`);
          continue;
        }
        throw new PdfVisionError(
          'Vision API response does not match expected structure',
          'INVALID_RESPONSE'
        );
      }

      // Filter out balance forward/carried entries that may have slipped through
      const filteredTransactions = parsed.transactions.filter((tx) => {
        const descUpper = tx.description.toUpperCase();
        // Skip balance brought/carried forward entries
        if (
          descUpper.includes('BALANCE BROUGHT FORWARD') ||
          descUpper.includes('BALANCE CARRIED FORWARD')
        ) {
          return false;
        }
        // Skip entries with no actual transaction amount
        if (tx.paidOut === null && tx.paidIn === null) {
          return false;
        }
        return true;
      });

      // Normalize payment types (fix OCR issues like "))))" -> ")))"))
      const normalizedTransactions = filteredTransactions.map((tx) => ({
        ...tx,
        paymentType: tx.paymentType ? normalizePaymentType(tx.paymentType) : null,
      }));

      return {
        pageNumber,
        transactions: normalizedTransactions,
        confidence: parsed.confidence,
        warnings: parsed.warnings,
        statementPeriod: parsed.statementPeriod,
        accountInfo: parsed.accountInfo,
      };
    } catch (error) {
      // Re-throw our errors
      if (error instanceof PdfVisionError) {
        throw error;
      }

      // Handle Anthropic-specific errors
      if (error instanceof Anthropic.RateLimitError) {
        throw new PdfVisionError('Rate limit exceeded. Please try again later.', 'RATE_LIMITED');
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new PdfVisionError(
          'Vision API request timed out. Try a PDF with fewer pages.',
          'TIMEOUT'
        );
      }

      // Generic API error
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new PdfVisionError(`Vision API error: ${errorMessage}`, 'API_ERROR');
    }
  }

  // Should not reach here, but satisfy TypeScript
  throw new PdfVisionError('Max retry attempts exceeded', 'API_ERROR');
}

/**
 * Parse all pages of a PDF using Claude Vision.
 * Processes pages sequentially to manage rate limits.
 */
export async function parseAllPages(
  pages: PdfPage[],
  format: StatementFormat = 'hsbc_current'
): Promise<FullParseResult> {
  if (pages.length === 0) {
    throw new PdfVisionError('No pages to process', 'NO_TRANSACTIONS');
  }

  const pageResults: PageParseResult[] = [];
  const allTransactions: ExtractedTransaction[] = [];
  let statementPeriod: { start: string; end: string } | undefined;
  let accountInfo:
    | { accountNumber?: string; sortCode?: string; accountName?: string }
    | undefined;

  // Process pages sequentially
  for (const page of pages) {
    console.log(`Processing page ${page.pageNumber}...`);

    const result = await parseStatementPage(page.imageBuffer, page.pageNumber, format);

    pageResults.push(result);
    allTransactions.push(...result.transactions);

    // Capture statement period from first page that has it
    if (!statementPeriod && result.statementPeriod) {
      statementPeriod = result.statementPeriod;
    }

    // Capture account info from first page that has it
    if (!accountInfo && result.accountInfo) {
      accountInfo = result.accountInfo;
    }
  }

  // Calculate overall confidence (weighted average by transaction count)
  const totalConfidence = calculateOverallConfidence(pageResults);

  if (allTransactions.length === 0) {
    throw new PdfVisionError(
      'No transactions found in the PDF. Is this a bank statement?',
      'NO_TRANSACTIONS'
    );
  }

  return {
    allTransactions,
    pageResults,
    totalConfidence,
    totalPages: pages.length,
    statementPeriod,
    accountInfo,
  };
}

/**
 * Calculate weighted average confidence across pages.
 */
function calculateOverallConfidence(pageResults: PageParseResult[]): number {
  if (pageResults.length === 0) {
    return 0;
  }

  let totalTransactions = 0;
  let weightedSum = 0;

  for (const result of pageResults) {
    const count = result.transactions.length;
    totalTransactions += count;
    weightedSum += result.confidence * count;
  }

  if (totalTransactions === 0) {
    // If no transactions, average the page confidences
    const sum = pageResults.reduce((acc, r) => acc + r.confidence, 0);
    return sum / pageResults.length;
  }

  return weightedSum / totalTransactions;
}

/**
 * Convert extracted transactions to the standard import format.
 * This allows PDF imports to use the same downstream flow as CSV imports.
 */
export function convertToImportFormat(
  transactions: ExtractedTransaction[]
): { headers: string[]; rows: string[][] } {
  // Standard headers matching the Vision extraction
  const headers = ['Date', 'Payment Type', 'Description', 'Paid Out', 'Paid In', 'Balance'];

  // Convert transactions to rows
  const rows = transactions.map((tx) => [
    tx.date || '', // null dates (from continuation pages) become empty strings
    tx.paymentType || '',
    tx.description,
    tx.paidOut !== null ? tx.paidOut.toString() : '',
    tx.paidIn !== null ? tx.paidIn.toString() : '',
    tx.balance !== null ? tx.balance.toString() : '',
  ]);

  return { headers, rows };
}

/**
 * Get the default column mapping for PDF imports.
 * Since we control the Vision output format, mapping is known in advance.
 */
export function getPdfColumnMapping(): {
  date: string;
  description: string;
  debit: string;
  credit: string;
  balance: string;
} {
  return {
    date: 'Date',
    description: 'Description',
    debit: 'Paid Out',
    credit: 'Paid In',
    balance: 'Balance',
  };
}
