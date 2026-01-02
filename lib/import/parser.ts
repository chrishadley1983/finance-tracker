/**
 * CSV Parser Service
 *
 * Core CSV parsing functionality using Papa Parse.
 * Handles various encodings, delimiters, and edge cases.
 */

import Papa from 'papaparse';

// =============================================================================
// TYPES
// =============================================================================

export interface ParseOptions {
  encoding?: string;
  delimiter?: string;
  hasHeader?: boolean;
  skipRows?: number;
}

export interface ParseResult {
  headers: string[];
  rows: string[][];
  totalRows: number;
  encoding: string;
  delimiter: string;
}

export interface ParseError {
  type: string;
  code: string;
  message: string;
  row?: number;
}

// =============================================================================
// ENCODING DETECTION
// =============================================================================

/**
 * Detect file encoding from buffer.
 * Checks for BOM markers and validates UTF-8.
 */
export function detectEncoding(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);

  // Check for UTF-8 BOM (EF BB BF)
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return 'utf-8';
  }

  // Check for UTF-16 LE BOM (FF FE)
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return 'utf-16le';
  }

  // Check for UTF-16 BE BOM (FE FF)
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return 'utf-16be';
  }

  // Try to validate as UTF-8 by checking byte patterns
  if (isValidUtf8(bytes)) {
    return 'utf-8';
  }

  // Default to windows-1252 (common for UK bank exports)
  return 'windows-1252';
}

/**
 * Basic UTF-8 validation - checks for invalid byte sequences.
 */
function isValidUtf8(bytes: Uint8Array): boolean {
  let i = 0;
  while (i < bytes.length && i < 1000) {
    // Only check first 1000 bytes
    const byte = bytes[i];

    if (byte < 0x80) {
      // ASCII
      i++;
    } else if ((byte & 0xe0) === 0xc0) {
      // 2-byte sequence
      if (i + 1 >= bytes.length || (bytes[i + 1] & 0xc0) !== 0x80) {
        return false;
      }
      i += 2;
    } else if ((byte & 0xf0) === 0xe0) {
      // 3-byte sequence
      if (
        i + 2 >= bytes.length ||
        (bytes[i + 1] & 0xc0) !== 0x80 ||
        (bytes[i + 2] & 0xc0) !== 0x80
      ) {
        return false;
      }
      i += 3;
    } else if ((byte & 0xf8) === 0xf0) {
      // 4-byte sequence
      if (
        i + 3 >= bytes.length ||
        (bytes[i + 1] & 0xc0) !== 0x80 ||
        (bytes[i + 2] & 0xc0) !== 0x80 ||
        (bytes[i + 3] & 0xc0) !== 0x80
      ) {
        return false;
      }
      i += 4;
    } else {
      return false;
    }
  }
  return true;
}

// =============================================================================
// DELIMITER DETECTION
// =============================================================================

/**
 * Auto-detect CSV delimiter by analyzing the first few lines.
 */
export function detectDelimiter(content: string): string {
  const lines = content.split('\n').slice(0, 5); // Check first 5 lines
  const candidates = [',', ';', '\t', '|'];
  const scores: Record<string, number> = {};

  for (const delimiter of candidates) {
    scores[delimiter] = 0;
    const counts: number[] = [];

    for (const line of lines) {
      if (line.trim()) {
        // Count occurrences, but handle quoted fields
        const count = countDelimiter(line, delimiter);
        counts.push(count);
      }
    }

    // Score based on consistency and count
    if (counts.length > 0) {
      const allSame = counts.every((c) => c === counts[0]);
      const avgCount = counts.reduce((a, b) => a + b, 0) / counts.length;

      if (allSame && avgCount > 0) {
        scores[delimiter] = avgCount * 10 + 5; // Bonus for consistency
      } else if (avgCount > 0) {
        scores[delimiter] = avgCount;
      }
    }
  }

  // Return delimiter with highest score, default to comma
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return best && best[1] > 0 ? best[0] : ',';
}

/**
 * Count delimiter occurrences, handling quoted fields.
 */
function countDelimiter(line: string, delimiter: string): number {
  let count = 0;
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      count++;
    }
  }

  return count;
}

// =============================================================================
// CSV PARSING
// =============================================================================

/**
 * Parse CSV content from a File object.
 */
export async function parseCSV(file: File, options: ParseOptions = {}): Promise<ParseResult> {
  const { hasHeader = true, skipRows = 0 } = options;

  // Read file as ArrayBuffer for encoding detection
  const buffer = await file.arrayBuffer();
  const detectedEncoding = options.encoding || detectEncoding(buffer);

  // Decode content
  let content: string;
  try {
    const decoder = new TextDecoder(detectedEncoding);
    content = decoder.decode(buffer);
  } catch {
    // Fallback to UTF-8 if specified encoding fails
    const decoder = new TextDecoder('utf-8');
    content = decoder.decode(buffer);
  }

  // Remove BOM if present
  if (content.charCodeAt(0) === 0xfeff) {
    content = content.slice(1);
  }

  // Detect delimiter
  const detectedDelimiter = options.delimiter || detectDelimiter(content);

  // Parse with Papa Parse
  const result = Papa.parse<string[]>(content, {
    delimiter: detectedDelimiter,
    header: false, // We'll handle headers ourselves
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
    transform: (value) => value.trim(),
  });

  // Handle parse errors
  if (result.errors.length > 0) {
    const criticalErrors = result.errors.filter(
      (e) => e.type === 'Quotes' || e.type === 'FieldMismatch'
    );
    if (criticalErrors.length > 0) {
      throw new Error(`CSV parse error: ${criticalErrors[0].message}`);
    }
  }

  let rows = result.data;

  // Skip initial rows if specified
  if (skipRows > 0) {
    rows = rows.slice(skipRows);
  }

  // Extract headers
  let headers: string[] = [];
  if (hasHeader && rows.length > 0) {
    headers = rows[0].map((h) => h.trim());
    rows = rows.slice(1);
  }

  // Filter out completely empty rows
  rows = rows.filter((row) => row.some((cell) => cell.trim() !== ''));

  return {
    headers,
    rows,
    totalRows: rows.length,
    encoding: detectedEncoding,
    delimiter: detectedDelimiter,
  };
}

/**
 * Parse CSV content from a string (for testing or server-side processing).
 */
export function parseCSVString(
  content: string,
  options: ParseOptions = {}
): ParseResult {
  const { hasHeader = true, skipRows = 0 } = options;

  // Remove BOM if present
  if (content.charCodeAt(0) === 0xfeff) {
    content = content.slice(1);
  }

  // Detect delimiter
  const detectedDelimiter = options.delimiter || detectDelimiter(content);

  // Parse with Papa Parse
  const result = Papa.parse<string[]>(content, {
    delimiter: detectedDelimiter,
    header: false,
    skipEmptyLines: true,
    transform: (value) => value.trim(),
  });

  let rows = result.data;

  // Skip initial rows if specified
  if (skipRows > 0) {
    rows = rows.slice(skipRows);
  }

  // Extract headers
  let headers: string[] = [];
  if (hasHeader && rows.length > 0) {
    headers = rows[0].map((h) => h.trim());
    rows = rows.slice(1);
  }

  // Filter out completely empty rows
  rows = rows.filter((row) => row.some((cell) => cell.trim() !== ''));

  return {
    headers,
    rows,
    totalRows: rows.length,
    encoding: 'utf-8',
    delimiter: detectedDelimiter,
  };
}
