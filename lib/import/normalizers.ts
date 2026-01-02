/**
 * Data Normalizers for CSV Import
 *
 * Handles conversion of various date formats, amount formats,
 * and description cleanup for imported transactions.
 */

// =============================================================================
// TYPES
// =============================================================================

export interface AmountOptions {
  decimalSeparator?: '.' | ',';
  isDebit?: boolean;
}

export interface DateParseResult {
  date: Date | null;
  format: string | null;
  warning?: string;
}

// =============================================================================
// DATE NORMALIZATION
// =============================================================================

/**
 * Supported date format patterns.
 * Order matters - more specific patterns first.
 */
const DATE_PATTERNS: { regex: RegExp; format: string; parse: (m: RegExpMatchArray) => Date | null }[] = [
  // ISO format: YYYY-MM-DD
  {
    regex: /^(\d{4})-(\d{2})-(\d{2})$/,
    format: 'YYYY-MM-DD',
    parse: (m) => createDate(parseInt(m[1]), parseInt(m[2]), parseInt(m[3])),
  },
  // UK format: DD/MM/YYYY
  {
    regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    format: 'DD/MM/YYYY',
    parse: (m) => createDate(parseInt(m[3]), parseInt(m[2]), parseInt(m[1])),
  },
  // UK format with dashes: DD-MM-YYYY
  {
    regex: /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
    format: 'DD-MM-YYYY',
    parse: (m) => createDate(parseInt(m[3]), parseInt(m[2]), parseInt(m[1])),
  },
  // US format: MM/DD/YYYY (detected by context)
  {
    regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    format: 'MM/DD/YYYY',
    parse: (m) => createDate(parseInt(m[3]), parseInt(m[1]), parseInt(m[2])),
  },
  // Text format: DD MMM YYYY (e.g., "15 Jan 2025")
  {
    regex: /^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})$/i,
    format: 'DD MMM YYYY',
    parse: (m) => {
      const monthMap: Record<string, number> = {
        jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
        jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
      };
      return createDate(parseInt(m[3]), monthMap[m[2].toLowerCase()], parseInt(m[1]));
    },
  },
  // Text format: DD MMM YY (e.g., "02 Aug 25" for HSBC statements)
  {
    regex: /^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{2})$/i,
    format: 'DD MMM YY',
    parse: (m) => {
      const monthMap: Record<string, number> = {
        jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
        jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
      };
      // Convert 2-digit year to 4-digit (assume 2000s for 00-99)
      const year2digit = parseInt(m[3]);
      const year = year2digit >= 0 && year2digit <= 99 ? 2000 + year2digit : year2digit;
      return createDate(year, monthMap[m[2].toLowerCase()], parseInt(m[1]));
    },
  },
  // Full month name: DD Month YYYY (e.g., "15 January 2025")
  {
    regex: /^(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})$/i,
    format: 'DD MMMM YYYY',
    parse: (m) => {
      const monthMap: Record<string, number> = {
        january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
        july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
      };
      return createDate(parseInt(m[3]), monthMap[m[2].toLowerCase()], parseInt(m[1]));
    },
  },
  // ISO datetime: YYYY-MM-DD HH:MM:SS
  {
    regex: /^(\d{4})-(\d{2})-(\d{2})\s+\d{2}:\d{2}(:\d{2})?$/,
    format: 'YYYY-MM-DD HH:MM:SS',
    parse: (m) => createDate(parseInt(m[1]), parseInt(m[2]), parseInt(m[3])),
  },
  // UK datetime: DD/MM/YYYY HH:MM:SS
  {
    regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+\d{2}:\d{2}(:\d{2})?$/,
    format: 'DD/MM/YYYY HH:MM:SS',
    parse: (m) => createDate(parseInt(m[3]), parseInt(m[2]), parseInt(m[1])),
  },
];

/**
 * Create a validated Date object.
 */
function createDate(year: number, month: number, day: number): Date | null {
  // Basic validation
  if (year < 1900 || year > 2100) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;

  // Create date (month is 0-indexed in JS)
  const date = new Date(year, month - 1, day);

  // Verify the date is valid (handles invalid dates like Feb 30)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

/**
 * Normalize a date string to a Date object.
 * Returns null for unparseable dates (doesn't throw).
 */
export function normalizeDate(value: string, expectedFormat?: string): DateParseResult {
  const trimmed = value.trim();

  if (!trimmed) {
    return { date: null, format: null };
  }

  // If expected format is provided, try it first
  if (expectedFormat) {
    const pattern = DATE_PATTERNS.find((p) => p.format === expectedFormat);
    if (pattern) {
      const match = trimmed.match(pattern.regex);
      if (match) {
        const date = pattern.parse(match);
        if (date) {
          return { date, format: pattern.format };
        }
      }
    }
  }

  // Try each pattern
  for (const pattern of DATE_PATTERNS) {
    // Skip US format unless explicitly requested
    if (pattern.format === 'MM/DD/YYYY' && expectedFormat !== 'MM/DD/YYYY') {
      continue;
    }

    const match = trimmed.match(pattern.regex);
    if (match) {
      const date = pattern.parse(match);
      if (date) {
        // Check for potential US/UK date ambiguity
        const warning = checkDateAmbiguity(trimmed, pattern.format);
        return { date, format: pattern.format, warning };
      }
    }
  }

  return { date: null, format: null };
}

/**
 * Check if a date could be ambiguous between US and UK formats.
 */
function checkDateAmbiguity(value: string, parsedFormat: string): string | undefined {
  if (parsedFormat === 'DD/MM/YYYY' || parsedFormat === 'DD-MM-YYYY') {
    const match = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (match) {
      const first = parseInt(match[1]);
      const second = parseInt(match[2]);

      // Both values could be day or month
      if (first <= 12 && second <= 12 && first !== second) {
        return `Date "${value}" is ambiguous - interpreted as DD/MM/YYYY (UK format)`;
      }
    }
  }
  return undefined;
}

/**
 * Format a Date object to ISO date string (YYYY-MM-DD).
 */
export function formatDateToISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// =============================================================================
// AMOUNT NORMALIZATION
// =============================================================================

/**
 * Normalize an amount string to a number.
 * Returns null for unparseable amounts (doesn't throw).
 */
export function normalizeAmount(value: string, options: AmountOptions = {}): number | null {
  const { decimalSeparator = '.', isDebit = false } = options;

  if (!value || typeof value !== 'string') {
    return null;
  }

  let trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  // Track if the value indicates a negative amount
  let isNegative = false;

  // Check for negative indicators at start
  if (trimmed.startsWith('-')) {
    isNegative = true;
    trimmed = trimmed.slice(1).trim();
  } else if (trimmed.startsWith('+')) {
    trimmed = trimmed.slice(1).trim();
  }

  // Check for parentheses format: (100.00)
  if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
    isNegative = true;
    trimmed = trimmed.slice(1, -1).trim();
  }

  // Check for trailing minus: 100.00-
  if (trimmed.endsWith('-')) {
    isNegative = true;
    trimmed = trimmed.slice(0, -1).trim();
  }

  // Check for DR/CR suffixes (accounting format)
  if (trimmed.toUpperCase().endsWith(' DR') || trimmed.toUpperCase().endsWith('DR')) {
    isNegative = true;
    trimmed = trimmed.replace(/\s*DR$/i, '').trim();
  } else if (trimmed.toUpperCase().endsWith(' CR') || trimmed.toUpperCase().endsWith('CR')) {
    trimmed = trimmed.replace(/\s*CR$/i, '').trim();
  }

  // Remove currency symbols
  trimmed = trimmed.replace(/^[£$€¥₹\s]+/, '').trim();
  trimmed = trimmed.replace(/[£$€¥₹\s]+$/, '').trim();

  // Handle decimal and thousand separators
  if (decimalSeparator === ',') {
    // European format: 1.234,56 -> 1234.56
    trimmed = trimmed.replace(/\./g, ''); // Remove thousand separators
    trimmed = trimmed.replace(',', '.'); // Convert decimal separator
  } else {
    // Standard format: 1,234.56 -> 1234.56
    trimmed = trimmed.replace(/,/g, ''); // Remove thousand separators
  }

  // Remove spaces (thousand separator in some formats)
  trimmed = trimmed.replace(/\s/g, '');

  // Parse the number
  const num = parseFloat(trimmed);

  if (isNaN(num)) {
    return null;
  }

  // Apply negative modifier
  let result = isNegative ? -Math.abs(num) : num;

  // If marked as debit, ensure it's negative
  if (isDebit && result > 0) {
    result = -result;
  }

  // Round to 2 decimal places to avoid floating point issues
  return Math.round(result * 100) / 100;
}

/**
 * Parse amount from separate debit and credit columns.
 * Returns the amount with appropriate sign.
 */
export function parseDebitCredit(
  debit: string | undefined,
  credit: string | undefined,
  options: AmountOptions = {}
): number | null {
  const debitValue = debit?.trim();
  const creditValue = credit?.trim();

  // Check debit column first
  if (debitValue) {
    const amount = normalizeAmount(debitValue, { ...options, isDebit: false });
    if (amount !== null && amount !== 0) {
      // Debit is always negative (money going out)
      return -Math.abs(amount);
    }
  }

  // Check credit column
  if (creditValue) {
    const amount = normalizeAmount(creditValue, { ...options, isDebit: false });
    if (amount !== null && amount !== 0) {
      // Credit is always positive (money coming in)
      return Math.abs(amount);
    }
  }

  // If both are empty or zero, return null
  return null;
}

// =============================================================================
// DESCRIPTION NORMALIZATION
// =============================================================================

/**
 * Clean up a transaction description.
 */
export function normalizeDescription(value: string): string {
  if (!value || typeof value !== 'string') {
    return '';
  }

  let result = value.trim();

  // Collapse multiple spaces
  result = result.replace(/\s+/g, ' ');

  // Remove excessive special characters (but preserve meaningful ones)
  result = result.replace(/[^\w\s\-.,&'()/£$€@#*+:]/g, '');

  // Remove leading/trailing special characters
  result = result.replace(/^[\s\-.,]+/, '').replace(/[\s\-.,]+$/, '');

  // Truncate to reasonable length
  if (result.length > 500) {
    result = result.slice(0, 497) + '...';
  }

  return result;
}

/**
 * Extract a clean payee name from a description.
 * Useful for matching and categorization.
 */
export function extractPayee(description: string): string {
  let payee = normalizeDescription(description);

  // Remove common prefixes (card payments, direct debits, etc.)
  const prefixes = [
    /^CARD PAYMENT TO\s+/i,
    /^PAYMENT TO\s+/i,
    /^DIRECT DEBIT TO\s+/i,
    /^STANDING ORDER TO\s+/i,
    /^BANK TRANSFER TO\s+/i,
    /^FASTER PAYMENT TO\s+/i,
    /^TRANSFER TO\s+/i,
    /^VIS\s+/i,
    /^WWW\./i,
  ];

  for (const prefix of prefixes) {
    payee = payee.replace(prefix, '');
  }

  // Remove dates at end (common in card payments)
  payee = payee.replace(/\s+\d{2}\/\d{2}\/\d{4}$/, '');
  payee = payee.replace(/\s+\d{2}\s+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)$/i, '');

  // Remove reference numbers at end
  payee = payee.replace(/\s+REF:?\s*[\w-]+$/i, '');
  payee = payee.replace(/\s+\d{6,}$/, '');

  return payee.trim();
}
