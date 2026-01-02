import { describe, it, expect } from 'vitest';
import {
  validateRow,
  validateImport,
  validateRows,
} from '@/lib/import/validators';
import type { ParsedTransaction } from '@/lib/types/import';

describe('Row Validation', () => {
  describe('validateRow', () => {
    const baseMapping = {
      date: 'Date',
      description: 'Description',
      amount: 'Amount',
    };

    it('validates a valid row', () => {
      const row = {
        Date: '15/01/2024',
        Description: 'Test transaction',
        Amount: '100.00',
      };

      const result = validateRow(row, baseMapping, 1);

      expect(result.isValid).toBe(true);
      expect(result.transaction).not.toBeNull();
      expect(result.transaction?.date).toBe('2024-01-15');
      expect(result.transaction?.amount).toBe(100);
      expect(result.transaction?.description).toBe('Test transaction');
      expect(result.errors).toHaveLength(0);
    });

    it('returns error for missing date', () => {
      const row = {
        Date: '',
        Description: 'Test',
        Amount: '100',
      };

      const result = validateRow(row, baseMapping, 1);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('date');
      expect(result.errors[0].message).toContain('required');
    });

    it('returns error for invalid date', () => {
      const row = {
        Date: 'not a date',
        Description: 'Test',
        Amount: '100',
      };

      const result = validateRow(row, baseMapping, 1);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.field === 'date')).toBe(true);
    });

    it('returns error for missing amount', () => {
      const row = {
        Date: '15/01/2024',
        Description: 'Test',
        Amount: '',
      };

      const result = validateRow(row, baseMapping, 1);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.field === 'amount')).toBe(true);
    });

    it('returns error for invalid amount', () => {
      const row = {
        Date: '15/01/2024',
        Description: 'Test',
        Amount: 'not a number',
      };

      const result = validateRow(row, baseMapping, 1);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.field === 'amount')).toBe(true);
    });

    it('returns error for missing description', () => {
      const row = {
        Date: '15/01/2024',
        Description: '',
        Amount: '100',
      };

      const result = validateRow(row, baseMapping, 1);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.field === 'description')).toBe(true);
    });

    it('warns about zero amount', () => {
      const row = {
        Date: '15/01/2024',
        Description: 'Test',
        Amount: '0',
      };

      const result = validateRow(row, baseMapping, 1);

      expect(result.isValid).toBe(true); // Zero is valid, just a warning
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].type).toBe('zero_amount');
    });

    it('handles debit/credit columns', () => {
      const mapping = {
        date: 'Date',
        description: 'Description',
        debit: 'Paid Out',
        credit: 'Paid In',
      };

      const debitRow = {
        Date: '15/01/2024',
        Description: 'Expense',
        'Paid Out': '50.00',
        'Paid In': '',
      };

      const creditRow = {
        Date: '16/01/2024',
        Description: 'Income',
        'Paid Out': '',
        'Paid In': '100.00',
      };

      const debitResult = validateRow(debitRow, mapping, 1, {
        amountInSingleColumn: false,
      });
      const creditResult = validateRow(creditRow, mapping, 2, {
        amountInSingleColumn: false,
      });

      expect(debitResult.isValid).toBe(true);
      expect(debitResult.transaction?.amount).toBe(-50);

      expect(creditResult.isValid).toBe(true);
      expect(creditResult.transaction?.amount).toBe(100);
    });

    it('includes optional reference field', () => {
      const mapping = {
        date: 'Date',
        description: 'Description',
        amount: 'Amount',
        reference: 'Reference',
      };

      const row = {
        Date: '15/01/2024',
        Description: 'Test',
        Amount: '100',
        Reference: 'REF123',
      };

      const result = validateRow(row, mapping, 1);

      expect(result.isValid).toBe(true);
      expect(result.transaction?.reference).toBe('REF123');
    });

    it('includes optional balance field', () => {
      const mapping = {
        date: 'Date',
        description: 'Description',
        amount: 'Amount',
        balance: 'Balance',
      };

      const row = {
        Date: '15/01/2024',
        Description: 'Test',
        Amount: '100',
        Balance: '1234.56',
      };

      const result = validateRow(row, mapping, 1);

      expect(result.isValid).toBe(true);
      expect(result.transaction?.balance).toBe(1234.56);
    });

    it('includes row number in transaction', () => {
      const row = {
        Date: '15/01/2024',
        Description: 'Test',
        Amount: '100',
      };

      const result = validateRow(row, baseMapping, 5);

      expect(result.transaction?.rowNumber).toBe(5);
    });

    it('includes raw data in transaction', () => {
      const row = {
        Date: '15/01/2024',
        Description: 'Test',
        Amount: '100',
        Extra: 'data',
      };

      const result = validateRow(row, baseMapping, 1);

      expect(result.transaction?.rawData).toEqual(row);
    });

    it('handles European decimal separator', () => {
      const row = {
        Date: '15/01/2024',
        Description: 'Test',
        Amount: '1.234,56',
      };

      const result = validateRow(row, baseMapping, 1, { decimalSeparator: ',' });

      expect(result.isValid).toBe(true);
      expect(result.transaction?.amount).toBe(1234.56);
    });
  });
});

describe('Import Validation', () => {
  describe('validateImport', () => {
    it('calculates correct summary for valid transactions', () => {
      const transactions: ParsedTransaction[] = [
        {
          rowNumber: 1,
          date: '2024-01-15',
          amount: 100,
          description: 'Income',
          rawData: {},
        },
        {
          rowNumber: 2,
          date: '2024-01-16',
          amount: -50,
          description: 'Expense',
          rawData: {},
        },
      ];

      const result = validateImport(transactions);

      expect(result.totalRows).toBe(2);
      expect(result.validRows).toBe(2);
      expect(result.invalidRows).toBe(0);
      expect(result.totalAmount).toBe(50);
      expect(result.dateRange?.min).toBe('2024-01-15');
      expect(result.dateRange?.max).toBe('2024-01-16');
    });

    it('warns about future dates', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const futureDateStr = futureDate.toISOString().split('T')[0];

      const transactions: ParsedTransaction[] = [
        {
          rowNumber: 1,
          date: futureDateStr,
          amount: 100,
          description: 'Future transaction',
          rawData: {},
        },
      ];

      const result = validateImport(transactions);

      expect(result.warnings.some((w) => w.type === 'future_date')).toBe(true);
    });

    it('warns about old dates', () => {
      const oldDate = new Date();
      oldDate.setFullYear(oldDate.getFullYear() - 6);
      const oldDateStr = oldDate.toISOString().split('T')[0];

      const transactions: ParsedTransaction[] = [
        {
          rowNumber: 1,
          date: oldDateStr,
          amount: 100,
          description: 'Old transaction',
          rawData: {},
        },
      ];

      const result = validateImport(transactions);

      expect(result.warnings.some((w) => w.type === 'old_date')).toBe(true);
    });

    it('warns about large amounts', () => {
      const transactions: ParsedTransaction[] = [
        {
          rowNumber: 1,
          date: '2024-01-15',
          amount: 15000,
          description: 'Large transaction',
          rawData: {},
        },
      ];

      const result = validateImport(transactions);

      expect(result.warnings.some((w) => w.type === 'large_amount')).toBe(true);
    });

    it('warns when all amounts are same sign - all negative', () => {
      const transactions: ParsedTransaction[] = [
        {
          rowNumber: 1,
          date: '2024-01-15',
          amount: -100,
          description: 'Expense 1',
          rawData: {},
        },
        {
          rowNumber: 2,
          date: '2024-01-16',
          amount: -50,
          description: 'Expense 2',
          rawData: {},
        },
      ];

      const result = validateImport(transactions);

      expect(result.warnings.some((w) => w.type === 'same_sign')).toBe(true);
    });

    it('warns when all amounts are same sign - all positive', () => {
      const transactions: ParsedTransaction[] = [
        {
          rowNumber: 1,
          date: '2024-01-15',
          amount: 100,
          description: 'Income 1',
          rawData: {},
        },
        {
          rowNumber: 2,
          date: '2024-01-16',
          amount: 50,
          description: 'Income 2',
          rawData: {},
        },
      ];

      const result = validateImport(transactions);

      expect(result.warnings.some((w) => w.type === 'same_sign')).toBe(true);
    });

    it('returns null dateRange for empty transactions', () => {
      const result = validateImport([]);

      expect(result.dateRange).toBeNull();
      expect(result.totalRows).toBe(0);
    });
  });

  describe('validateRows', () => {
    it('processes multiple rows and returns results', () => {
      const headers = ['Date', 'Description', 'Amount'];
      const rows = [
        ['15/01/2024', 'Valid transaction', '100'],
        ['invalid', 'Invalid date', '50'],
        ['16/01/2024', 'Another valid', '-75'],
      ];
      const mapping = {
        date: 'Date',
        description: 'Description',
        amount: 'Amount',
      };

      const result = validateRows(rows, headers, mapping);

      expect(result.transactions).toHaveLength(2);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('date');
    });

    it('calculates correct row numbers with skipRows', () => {
      const headers = ['Date', 'Description', 'Amount'];
      const rows = [['15/01/2024', 'Test', '100']];
      const mapping = {
        date: 'Date',
        description: 'Description',
        amount: 'Amount',
      };

      const result = validateRows(rows, headers, mapping, { skipRows: 2 });

      // Row 1 in data = row 4 in original file (2 skipped + 1 header + 1 data)
      expect(result.transactions[0].rowNumber).toBe(4);
    });

    it('carries forward date for PDF imports when date is empty', () => {
      const headers = ['Date', 'Description', 'Paid Out', 'Paid In'];
      const rows = [
        ['02 Aug 25', 'First transaction', '100', ''],
        ['', 'Second transaction same day', '50', ''],
        ['', 'Third transaction same day', '', '200'],
        ['03 Aug 25', 'Next day transaction', '75', ''],
        ['', 'Another same day', '25', ''],
      ];
      const mapping = {
        date: 'Date',
        description: 'Description',
        debit: 'Paid Out',
        credit: 'Paid In',
      };

      const result = validateRows(rows, headers, mapping, {
        carryForwardDate: true,
        amountInSingleColumn: false,
      });

      // All 5 transactions should be valid
      expect(result.transactions).toHaveLength(5);
      expect(result.errors).toHaveLength(0);

      // Check dates are carried forward correctly
      expect(result.transactions[0].date).toBe('2025-08-02');
      expect(result.transactions[1].date).toBe('2025-08-02');
      expect(result.transactions[2].date).toBe('2025-08-02');
      expect(result.transactions[3].date).toBe('2025-08-03');
      expect(result.transactions[4].date).toBe('2025-08-03');
    });

    it('does not carry forward date when option is disabled', () => {
      const headers = ['Date', 'Description', 'Amount'];
      const rows = [
        ['02 Aug 25', 'First transaction', '100'],
        ['', 'Second transaction no date', '50'],
      ];
      const mapping = {
        date: 'Date',
        description: 'Description',
        amount: 'Amount',
      };

      const result = validateRows(rows, headers, mapping, {
        carryForwardDate: false,
      });

      // Only first transaction should be valid
      expect(result.transactions).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('Date is required');
    });
  });
});
