/**
 * Format Detection Service
 *
 * Automatically detects the format of a CSV file based on
 * headers and sample data, matching against known bank formats.
 */

import type { ImportFormat } from '@/lib/types/import';

// =============================================================================
// TYPES
// =============================================================================

export interface DetectionResult {
  format: ImportFormat | null;
  confidence: number;
  matchedColumns: string[];
  unmatchedRequired: string[];
  suggestedMapping: Record<string, string> | null;
}

interface FormatSignature {
  provider: string;
  requiredHeaders: string[];
  optionalHeaders: string[];
  signatureHeaders: string[]; // Headers unique to this format
}

// =============================================================================
// KNOWN FORMAT SIGNATURES
// =============================================================================

const FORMAT_SIGNATURES: FormatSignature[] = [
  {
    provider: 'HSBC',
    requiredHeaders: ['date'],
    optionalHeaders: ['description', 'type', 'balance'],
    signatureHeaders: ['paid out', 'paid in'],
  },
  {
    provider: 'HSBC',
    requiredHeaders: ['date', 'description', 'amount'],
    optionalHeaders: [],
    signatureHeaders: [], // Credit card - simpler format
  },
  {
    provider: 'Monzo',
    requiredHeaders: ['date', 'amount'],
    optionalHeaders: ['name', 'description', 'category', 'notes and #tags'],
    signatureHeaders: ['transaction id', 'emoji', 'money out', 'money in'],
  },
  {
    provider: 'Amex',
    requiredHeaders: ['date', 'description', 'amount'],
    optionalHeaders: ['reference'],
    signatureHeaders: [], // Simple 3-column format
  },
  {
    provider: 'Generic',
    requiredHeaders: ['date'],
    optionalHeaders: ['description', 'amount', 'debit', 'credit', 'balance'],
    signatureHeaders: [],
  },
];

// =============================================================================
// HEADER NORMALIZATION
// =============================================================================

/**
 * Normalize a header for comparison.
 */
function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Check if two headers match (with fuzzy matching).
 */
function headersMatch(header1: string, header2: string): boolean {
  const norm1 = normalizeHeader(header1);
  const norm2 = normalizeHeader(header2);

  // Exact match
  if (norm1 === norm2) return true;

  // One contains the other
  if (norm1.includes(norm2) || norm2.includes(norm1)) return true;

  // Common synonyms
  const synonyms: Record<string, string[]> = {
    date: ['transaction date', 'txn date', 'posting date', 'value date'],
    description: ['name', 'payee', 'merchant', 'details', 'narrative', 'memo'],
    amount: ['value', 'sum', 'total'],
    debit: ['paid out', 'money out', 'withdrawal', 'dr'],
    credit: ['paid in', 'money in', 'deposit', 'cr'],
    balance: ['running balance', 'account balance'],
    reference: ['ref', 'transaction id', 'id'],
    category: ['type', 'transaction type'],
  };

  for (const [key, values] of Object.entries(synonyms)) {
    const allValues = [key, ...values];
    if (allValues.includes(norm1) && allValues.includes(norm2)) {
      return true;
    }
  }

  return false;
}

/**
 * Find the best matching header from a list.
 */
function findMatchingHeader(target: string, headers: string[]): string | null {
  const normTarget = normalizeHeader(target);

  // First, try exact match
  for (const header of headers) {
    if (normalizeHeader(header) === normTarget) {
      return header;
    }
  }

  // Then, try fuzzy match
  for (const header of headers) {
    if (headersMatch(target, header)) {
      return header;
    }
  }

  return null;
}

// =============================================================================
// FORMAT DETECTION
// =============================================================================

/**
 * Detect the format of a CSV based on headers and sample rows.
 */
export function detectFormat(
  headers: string[],
  _sampleRows: string[][],
  formats: ImportFormat[]
): DetectionResult {
  const scores: { format: ImportFormat; score: number; matched: string[]; unmatched: string[] }[] = [];

  for (const format of formats) {
    const { score, matched, unmatched } = scoreFormat(headers, format);
    scores.push({ format, score, matched, unmatched });
  }

  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);

  const best = scores[0];

  // Require minimum confidence threshold
  const maxPossibleScore = calculateMaxScore(headers.length);
  const confidence = best ? best.score / maxPossibleScore : 0;

  if (!best || confidence < 0.3) {
    return {
      format: null,
      confidence: 0,
      matchedColumns: [],
      unmatchedRequired: ['date', 'description', 'amount'],
      suggestedMapping: null,
    };
  }

  // Generate suggested mapping
  const suggestedMapping = generateMapping(headers, best.format);

  return {
    format: best.format,
    confidence: Math.min(confidence, 1),
    matchedColumns: best.matched,
    unmatchedRequired: best.unmatched,
    suggestedMapping,
  };
}

/**
 * Calculate score for a format against headers.
 */
function scoreFormat(
  headers: string[],
  format: ImportFormat
): { score: number; matched: string[]; unmatched: string[] } {
  let score = 0;
  const matched: string[] = [];
  const unmatched: string[] = [];

  // Get the column mapping from the format
  const mapping = format.column_mapping as unknown as Record<string, string>;

  // Check required columns from mapping
  const requiredColumns = ['date', 'description'];
  const amountColumns = format.amount_in_single_column
    ? ['amount']
    : ['debit', 'credit'];

  const allRequired = [...requiredColumns, ...amountColumns];

  for (const required of allRequired) {
    const expectedHeader = mapping[required];
    if (expectedHeader) {
      const found = findMatchingHeader(expectedHeader, headers);
      if (found) {
        matched.push(found);
        score += 10; // High score for required matches
      } else {
        unmatched.push(required);
        score -= 5; // Penalty for missing required
      }
    } else {
      // Try to find column by common names
      const found = findMatchingHeader(required, headers);
      if (found) {
        matched.push(found);
        score += 5; // Lower score for inferred matches
      } else if (requiredColumns.includes(required)) {
        unmatched.push(required);
        score -= 5;
      }
    }
  }

  // Check optional columns
  const optionalColumns = ['reference', 'balance', 'category'];
  for (const optional of optionalColumns) {
    const expectedHeader = mapping[optional];
    if (expectedHeader) {
      const found = findMatchingHeader(expectedHeader, headers);
      if (found) {
        matched.push(found);
        score += 2; // Bonus for optional matches
      }
    }
  }

  // Provider-specific signature matching
  const signature = FORMAT_SIGNATURES.find((s) => s.provider === format.provider);
  if (signature) {
    for (const sigHeader of signature.signatureHeaders) {
      const found = findMatchingHeader(sigHeader, headers);
      if (found) {
        score += 8; // High bonus for signature headers
      }
    }
  }

  return { score, matched, unmatched };
}

/**
 * Calculate maximum possible score for comparison.
 */
function calculateMaxScore(headerCount: number): number {
  // Base: 3 required columns * 10 = 30
  // Plus: up to 3 optional * 2 = 6
  // Plus: up to 3 signature * 8 = 24
  return 30 + Math.min(headerCount, 3) * 2 + 24;
}

/**
 * Generate a suggested column mapping based on detected format.
 */
function generateMapping(
  headers: string[],
  format: ImportFormat
): Record<string, string> | null {
  const mapping: Record<string, string> = {};
  const formatMapping = format.column_mapping as unknown as Record<string, string>;

  // Map standard columns
  const columns = ['date', 'description', 'amount', 'debit', 'credit', 'reference', 'balance', 'category'];

  for (const column of columns) {
    const expectedHeader = formatMapping[column];

    if (expectedHeader) {
      // Use format's expected header
      const found = findMatchingHeader(expectedHeader, headers);
      if (found) {
        mapping[column] = found;
      }
    } else {
      // Try to find by column name
      const found = findMatchingHeader(column, headers);
      if (found) {
        mapping[column] = found;
      }
    }
  }

  // Ensure we have at least date and description
  if (!mapping.date || !mapping.description) {
    return null;
  }

  // Ensure we have amount (either single or debit/credit)
  if (!mapping.amount && (!mapping.debit || !mapping.credit)) {
    // Try to find any amount-like column
    for (const header of headers) {
      const norm = normalizeHeader(header);
      if (norm.includes('amount') || norm.includes('value') || norm.includes('sum')) {
        mapping.amount = header;
        break;
      }
    }
  }

  return mapping;
}

/**
 * Detect format from headers alone (without known formats).
 * Returns a generic mapping suggestion.
 */
export function detectColumnsFromHeaders(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};

  // Required columns
  const dateHeader = findMatchingHeader('date', headers);
  if (dateHeader) mapping.date = dateHeader;

  const descHeader = findMatchingHeader('description', headers);
  if (descHeader) mapping.description = descHeader;

  // Amount columns
  const amountHeader = findMatchingHeader('amount', headers);
  const debitHeader = findMatchingHeader('debit', headers);
  const creditHeader = findMatchingHeader('credit', headers);

  if (amountHeader) {
    mapping.amount = amountHeader;
  } else if (debitHeader && creditHeader) {
    mapping.debit = debitHeader;
    mapping.credit = creditHeader;
  }

  // Optional columns
  const refHeader = findMatchingHeader('reference', headers);
  if (refHeader) mapping.reference = refHeader;

  const balanceHeader = findMatchingHeader('balance', headers);
  if (balanceHeader) mapping.balance = balanceHeader;

  const categoryHeader = findMatchingHeader('category', headers);
  if (categoryHeader) mapping.category = categoryHeader;

  return mapping;
}

/**
 * Validate that a mapping has all required columns.
 */
export function validateMapping(mapping: Record<string, string>): {
  valid: boolean;
  missingRequired: string[];
} {
  const missingRequired: string[] = [];

  if (!mapping.date) {
    missingRequired.push('date');
  }

  if (!mapping.description) {
    missingRequired.push('description');
  }

  if (!mapping.amount && (!mapping.debit || !mapping.credit)) {
    missingRequired.push('amount (or debit + credit)');
  }

  return {
    valid: missingRequired.length === 0,
    missingRequired,
  };
}
