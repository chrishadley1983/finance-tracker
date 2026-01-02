/**
 * Import Validators
 *
 * Validates parsed CSV rows and generates import validation summaries.
 */

import type { ParsedTransaction, ValidationError, ValidationWarning } from '@/lib/types/import';
import type { ColumnMapping } from '@/lib/validations/import';
import { normalizeDate, normalizeAmount, normalizeDescription, parseDebitCredit, formatDateToISO } from './normalizers';

// =============================================================================
// TYPES
// =============================================================================

export interface RowValidationResult {
  isValid: boolean;
  transaction: ParsedTransaction | null;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ImportValidation {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  dateRange: { min: string; max: string } | null;
  totalAmount: number;
}

export interface RowData {
  [key: string]: string;
}

// =============================================================================
// ROW VALIDATION
// =============================================================================

/**
 * Validate and parse a single CSV row.
 */
export function validateRow(
  row: RowData,
  mapping: ColumnMapping,
  rowNumber: number,
  options: {
    dateFormat?: string;
    decimalSeparator?: '.' | ',';
    amountInSingleColumn?: boolean;
  } = {}
): RowValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const { dateFormat, decimalSeparator = '.', amountInSingleColumn = true } = options;

  // Parse date
  const dateValue = row[mapping.date];
  const dateResult = normalizeDate(dateValue || '', dateFormat);

  if (!dateResult.date) {
    errors.push({
      rowNumber,
      field: 'date',
      value: dateValue || null,
      message: dateValue ? `Invalid date format: "${dateValue}"` : 'Date is required',
      severity: 'error',
    });
  } else if (dateResult.warning) {
    warnings.push({
      rowNumber,
      type: 'other',
      message: dateResult.warning,
    });
  }

  // Parse amount
  let amount: number | null = null;

  if (amountInSingleColumn && mapping.amount) {
    const amountValue = row[mapping.amount];
    amount = normalizeAmount(amountValue || '', { decimalSeparator });

    if (amount === null) {
      errors.push({
        rowNumber,
        field: 'amount',
        value: amountValue || null,
        message: amountValue ? `Invalid amount format: "${amountValue}"` : 'Amount is required',
        severity: 'error',
      });
    }
  } else if (mapping.debit || mapping.credit) {
    const debitValue = mapping.debit ? row[mapping.debit] : undefined;
    const creditValue = mapping.credit ? row[mapping.credit] : undefined;

    amount = parseDebitCredit(debitValue, creditValue, { decimalSeparator });

    if (amount === null) {
      // Check if both are empty
      const bothEmpty = (!debitValue || debitValue.trim() === '') &&
                       (!creditValue || creditValue.trim() === '');

      if (bothEmpty) {
        errors.push({
          rowNumber,
          field: 'amount',
          value: null,
          message: 'Either debit or credit amount is required',
          severity: 'error',
        });
      } else {
        errors.push({
          rowNumber,
          field: 'amount',
          value: debitValue || creditValue || null,
          message: `Invalid amount format`,
          severity: 'error',
        });
      }
    }
  } else {
    errors.push({
      rowNumber,
      field: 'amount',
      value: null,
      message: 'No amount column mapped',
      severity: 'error',
    });
  }

  // Parse description
  const descValue = row[mapping.description];
  const description = normalizeDescription(descValue || '');

  if (!description) {
    errors.push({
      rowNumber,
      field: 'description',
      value: descValue || null,
      message: 'Description is required',
      severity: 'error',
    });
  }

  // Check for zero amount (warning, not error)
  if (amount === 0) {
    warnings.push({
      rowNumber,
      type: 'zero_amount',
      message: 'Transaction has zero amount',
    });
  }

  // If we have errors, return invalid result
  if (errors.length > 0) {
    return {
      isValid: false,
      transaction: null,
      errors,
      warnings,
    };
  }

  // Build transaction
  const transaction: ParsedTransaction = {
    rowNumber,
    date: formatDateToISO(dateResult.date!),
    amount: amount!,
    description,
    rawData: row as Record<string, string>,
  };

  // Add optional fields
  if (mapping.reference) {
    const refValue = row[mapping.reference];
    if (refValue?.trim()) {
      transaction.reference = refValue.trim();
    }
  }

  if (mapping.balance) {
    const balanceValue = row[mapping.balance];
    const balance = normalizeAmount(balanceValue || '', { decimalSeparator });
    if (balance !== null) {
      transaction.balance = balance;
    }
  }

  return {
    isValid: true,
    transaction,
    errors: [],
    warnings,
  };
}

// =============================================================================
// IMPORT VALIDATION
// =============================================================================

/**
 * Validate all parsed transactions and generate summary.
 */
export function validateImport(transactions: ParsedTransaction[]): ImportValidation {
  const warnings: ValidationWarning[] = [];
  let totalAmount = 0;
  let minDate: string | null = null;
  let maxDate: string | null = null;
  let positiveCount = 0;
  let negativeCount = 0;

  const now = new Date();
  const fiveYearsAgo = new Date();
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

  for (const tx of transactions) {
    // Track amounts
    totalAmount += tx.amount;
    if (tx.amount > 0) positiveCount++;
    if (tx.amount < 0) negativeCount++;

    // Track date range
    if (!minDate || tx.date < minDate) minDate = tx.date;
    if (!maxDate || tx.date > maxDate) maxDate = tx.date;

    // Check for future dates
    const txDate = new Date(tx.date);
    if (txDate > now) {
      warnings.push({
        rowNumber: tx.rowNumber,
        type: 'future_date',
        message: `Transaction date ${tx.date} is in the future`,
      });
    }

    // Check for very old dates
    if (txDate < fiveYearsAgo) {
      warnings.push({
        rowNumber: tx.rowNumber,
        type: 'old_date',
        message: `Transaction date ${tx.date} is more than 5 years old`,
      });
    }

    // Check for large amounts
    if (Math.abs(tx.amount) > 10000) {
      warnings.push({
        rowNumber: tx.rowNumber,
        type: 'large_amount',
        message: `Unusually large amount: ${tx.amount.toFixed(2)}`,
      });
    }
  }

  // Check for all same sign
  if (transactions.length > 0) {
    if (positiveCount === 0) {
      warnings.push({
        type: 'same_sign',
        message: 'All transactions are negative (no income)',
      });
    } else if (negativeCount === 0) {
      warnings.push({
        type: 'same_sign',
        message: 'All transactions are positive (no expenses)',
      });
    }
  }

  return {
    totalRows: transactions.length,
    validRows: transactions.length,
    invalidRows: 0,
    errors: [],
    warnings,
    dateRange: minDate && maxDate ? { min: minDate, max: maxDate } : null,
    totalAmount: Math.round(totalAmount * 100) / 100,
  };
}

/**
 * Validate parsed rows and return both valid transactions and errors.
 */
export function validateRows(
  rows: string[][],
  headers: string[],
  mapping: ColumnMapping,
  options: {
    dateFormat?: string;
    decimalSeparator?: '.' | ',';
    amountInSingleColumn?: boolean;
    skipRows?: number;
  } = {}
): {
  transactions: ParsedTransaction[];
  errors: ValidationError[];
  warnings: ValidationWarning[];
} {
  const transactions: ParsedTransaction[] = [];
  const allErrors: ValidationError[] = [];
  const allWarnings: ValidationWarning[] = [];

  // Convert rows to objects using headers
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 1 + (options.skipRows || 0) + 1; // +1 for header row

    // Convert array to object
    const rowData: RowData = {};
    for (let j = 0; j < headers.length; j++) {
      rowData[headers[j]] = row[j] || '';
    }

    const result = validateRow(rowData, mapping, rowNumber, options);

    if (result.isValid && result.transaction) {
      transactions.push(result.transaction);
    }

    allErrors.push(...result.errors);
    allWarnings.push(...result.warnings);
  }

  return {
    transactions,
    errors: allErrors,
    warnings: allWarnings,
  };
}
