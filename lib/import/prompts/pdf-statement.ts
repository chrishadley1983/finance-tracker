/**
 * PDF Statement Extraction Prompts
 *
 * Prompts for extracting transaction data from bank statement images
 * using Claude's Vision API.
 */

// =============================================================================
// TYPES
// =============================================================================

export interface ExtractedTransaction {
  date: string | null; // null for continuation pages where date isn't shown
  paymentType: string | null;
  description: string;
  paidOut: number | null;
  paidIn: number | null;
  balance: number | null;
}

export interface VisionExtractionResponse {
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

// =============================================================================
// PROMPTS
// =============================================================================

/**
 * HSBC Current Account Statement Extraction Prompt
 */
export const HSBC_CURRENT_STATEMENT_PROMPT = `You are extracting transaction data from an HSBC UK bank statement image.

The statement has a table with these columns:
- Date (format: DD MMM YY, e.g., "01 Dec 25" means 1st December 2025)
- Payment type and details (may include: DD = Direct Debit, ))) = Contactless, VIS = Visa, CR = Credit, FPI = Faster Payment In, FPO = Faster Payment Out, CHQ = Cheque)
- Payment type and details continuation (description, merchant name, location - may span multiple lines)
- £ Paid out (debits/outgoing)
- £ Paid in (credits/incoming)
- £ Balance

Important instructions:
1. Extract ALL transactions visible in the table
2. Combine multi-line descriptions into a single string (e.g., "LIDL GB TONBRIDGE 0577 LIDL GB" becomes "LIDL GB TONBRIDGE 0577 LIDL GB")
3. SKIP rows containing "BALANCE BROUGHT FORWARD" or "BALANCE CARRIED FORWARD" - these are not transactions
4. For amounts, extract numeric value only (remove £ symbol, handle commas)
5. If a cell is empty or shows no amount, use null
6. Convert date format: "01 Dec 25" should become "01 Dec 25" (keep as-is, will be parsed later)
7. Payment type abbreviations should be preserved exactly as shown: DD, VIS, ))), CR, FPI, FPO, CHQ, DR (not )))))))
8. On continuation pages, dates may not be shown for each transaction - use null for the date field in these cases
9. The contactless payment symbol looks like ))) (three curved lines) - always use exactly ))) for this

Also extract if visible:
- Statement period (start and end dates)
- Account information (account number, sort code, account name)

Respond ONLY with valid JSON (no markdown code blocks, no explanation):
{
  "transactions": [
    {
      "date": "DD MMM YY",
      "paymentType": "DD" | "VIS" | ")))" | "CR" | "FPI" | "FPO" | null,
      "description": "combined description text",
      "paidOut": 123.45 | null,
      "paidIn": 123.45 | null,
      "balance": 12345.67 | null
    }
  ],
  "confidence": 0.0 to 1.0,
  "warnings": ["any issues encountered"],
  "statementPeriod": {
    "start": "DD MMM YYYY",
    "end": "DD MMM YYYY"
  },
  "accountInfo": {
    "accountNumber": "12345678",
    "sortCode": "12-34-56",
    "accountName": "Account holder name"
  }
}`;

/**
 * Generic Bank Statement Extraction Prompt
 * Used as fallback for unrecognised formats
 */
export const GENERIC_STATEMENT_PROMPT = `You are extracting transaction data from a UK bank statement image.

Look for a table containing financial transactions with columns typically including:
- Date
- Description or reference
- Amount (debit/credit or single column)
- Balance

Instructions:
1. Extract ALL transactions visible in any tables
2. Identify the date format used and preserve it
3. For amounts, extract numeric values only (remove currency symbols)
4. If amounts are in separate debit/credit columns, use paidOut for debits and paidIn for credits
5. If there's a single amount column, positive values go to paidIn, negative to paidOut
6. Skip header rows, summary rows, and balance brought forward
7. Combine multi-line descriptions where applicable

Respond ONLY with valid JSON (no markdown code blocks):
{
  "transactions": [
    {
      "date": "date as shown",
      "paymentType": "type if shown or null",
      "description": "transaction description",
      "paidOut": number or null,
      "paidIn": number or null,
      "balance": number or null
    }
  ],
  "confidence": 0.0 to 1.0,
  "warnings": ["any issues or uncertainties"]
}`;

// =============================================================================
// PROMPT SELECTION
// =============================================================================

export type StatementFormat = 'hsbc_current' | 'generic';

export function getPromptForFormat(format: StatementFormat): string {
  switch (format) {
    case 'hsbc_current':
      return HSBC_CURRENT_STATEMENT_PROMPT;
    case 'generic':
    default:
      return GENERIC_STATEMENT_PROMPT;
  }
}

// =============================================================================
// RESPONSE VALIDATION
// =============================================================================

/**
 * Validate the structure of a Vision API response.
 */
export function validateVisionResponse(response: unknown): response is VisionExtractionResponse {
  if (!response || typeof response !== 'object') {
    return false;
  }

  const resp = response as Record<string, unknown>;

  // Required: transactions array
  if (!Array.isArray(resp.transactions)) {
    return false;
  }

  // Required: confidence number
  if (typeof resp.confidence !== 'number' || resp.confidence < 0 || resp.confidence > 1) {
    return false;
  }

  // Required: warnings array
  if (!Array.isArray(resp.warnings)) {
    return false;
  }

  // Validate each transaction
  for (const tx of resp.transactions) {
    if (!validateTransaction(tx)) {
      return false;
    }
  }

  return true;
}

/**
 * Validate a single transaction object.
 */
function validateTransaction(tx: unknown): tx is ExtractedTransaction {
  if (!tx || typeof tx !== 'object') {
    return false;
  }

  const t = tx as Record<string, unknown>;

  // Date: string or null (null allowed for continuation pages)
  if (t.date !== null && (typeof t.date !== 'string' || t.date.trim() === '')) {
    return false;
  }

  // Required: description (string)
  if (typeof t.description !== 'string' || t.description.trim() === '') {
    return false;
  }

  // Optional: paymentType (string or null)
  if (t.paymentType !== null && typeof t.paymentType !== 'string') {
    return false;
  }

  // Optional: paidOut (number or null)
  if (t.paidOut !== null && typeof t.paidOut !== 'number') {
    return false;
  }

  // Optional: paidIn (number or null)
  if (t.paidIn !== null && typeof t.paidIn !== 'number') {
    return false;
  }

  // Optional: balance (number or null)
  if (t.balance !== null && typeof t.balance !== 'number') {
    return false;
  }

  // Must have at least one amount OR be a balance-only entry
  // (balance-only entries like "BALANCE CARRIED FORWARD" are filtered out later)
  if (t.paidOut === null && t.paidIn === null && t.balance === null) {
    return false;
  }

  return true;
}

/**
 * Parse AI response text (handles markdown code blocks).
 */
export function parseAIResponse(text: string): unknown {
  let cleaned = text.trim();

  // Remove markdown code blocks if present
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }

  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }

  return JSON.parse(cleaned.trim());
}
