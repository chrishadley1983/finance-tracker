import { describe, it, expect } from 'vitest';
import {
  detectFormat,
  detectColumnsFromHeaders,
  validateMapping,
} from '@/lib/import/format-detector';
import type { ImportFormat } from '@/lib/types/import';

// Mock import formats for testing
const mockFormats: ImportFormat[] = [
  {
    id: '1',
    name: 'HSBC Current Account',
    provider: 'HSBC',
    is_system: true,
    column_mapping: {
      date: 'Date',
      description: 'Description',
      debit: 'Paid Out',
      credit: 'Paid In',
    },
    date_format: 'DD/MM/YYYY',
    decimal_separator: '.',
    has_header: true,
    skip_rows: 0,
    amount_in_single_column: false,
    amount_column: null,
    debit_column: 'Paid Out',
    credit_column: 'Paid In',
    notes: null,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  },
  {
    id: '2',
    name: 'HSBC Credit Card',
    provider: 'HSBC',
    is_system: true,
    column_mapping: {
      date: 'Date',
      description: 'Description',
      amount: 'Amount',
    },
    date_format: 'DD/MM/YYYY',
    decimal_separator: '.',
    has_header: true,
    skip_rows: 0,
    amount_in_single_column: true,
    amount_column: 'Amount',
    debit_column: null,
    credit_column: null,
    notes: null,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  },
  {
    id: '3',
    name: 'Monzo',
    provider: 'Monzo',
    is_system: true,
    column_mapping: {
      date: 'Date',
      description: 'Name',
      amount: 'Amount',
      category: 'Category',
      reference: 'Transaction ID',
    },
    date_format: 'DD/MM/YYYY',
    decimal_separator: '.',
    has_header: true,
    skip_rows: 0,
    amount_in_single_column: true,
    amount_column: 'Amount',
    debit_column: null,
    credit_column: null,
    notes: null,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
  },
];

describe('Format Detection', () => {
  describe('detectFormat', () => {
    it('detects HSBC Current Account format', () => {
      const headers = ['Date', 'Type', 'Description', 'Paid Out', 'Paid In', 'Balance'];
      const sampleRows = [['15/01/2024', 'DD', 'NETFLIX', '12.99', '', '1234.56']];

      const result = detectFormat(headers, sampleRows, mockFormats);

      expect(result.format).not.toBeNull();
      expect(result.format?.provider).toBe('HSBC');
      expect(result.confidence).toBeGreaterThan(0.3);
      expect(result.matchedColumns).toContain('Date');
    });

    it('detects HSBC Credit Card format', () => {
      const headers = ['Date', 'Description', 'Amount'];
      const sampleRows = [['15/01/2024', 'AMAZON', '45.99']];

      const result = detectFormat(headers, sampleRows, mockFormats);

      expect(result.format).not.toBeNull();
      expect(result.confidence).toBeGreaterThan(0.3);
    });

    it('detects Monzo format with signature headers', () => {
      const headers = [
        'Transaction ID',
        'Date',
        'Time',
        'Type',
        'Name',
        'Emoji',
        'Category',
        'Amount',
      ];
      const sampleRows = [['tx_123', '15/01/2024', '12:30', 'Card', 'Tesco', '🛒', 'Groceries', '-25.50']];

      const result = detectFormat(headers, sampleRows, mockFormats);

      expect(result.format).not.toBeNull();
      expect(result.format?.provider).toBe('Monzo');
    });

    it('returns null for unrecognized format', () => {
      const headers = ['Unknown1', 'Unknown2', 'Unknown3'];
      const sampleRows = [['value1', 'value2', 'value3']];

      const result = detectFormat(headers, sampleRows, mockFormats);

      expect(result.format).toBeNull();
      expect(result.confidence).toBe(0);
    });

    it('includes matched columns in result', () => {
      const headers = ['Date', 'Description', 'Amount'];
      const sampleRows = [['15/01/2024', 'Test', '100']];

      const result = detectFormat(headers, sampleRows, mockFormats);

      expect(result.matchedColumns.length).toBeGreaterThan(0);
    });

    it('generates suggested mapping', () => {
      const headers = ['Date', 'Description', 'Amount'];
      const sampleRows = [['15/01/2024', 'Test', '100']];

      const result = detectFormat(headers, sampleRows, mockFormats);

      if (result.suggestedMapping) {
        expect(result.suggestedMapping.date).toBe('Date');
        expect(result.suggestedMapping.description).toBe('Description');
      }
    });
  });

  describe('detectColumnsFromHeaders', () => {
    it('detects date column', () => {
      const headers = ['Date', 'Desc', 'Value'];
      const result = detectColumnsFromHeaders(headers);
      expect(result.date).toBe('Date');
    });

    it('detects date column with variations', () => {
      expect(detectColumnsFromHeaders(['Transaction Date', 'Amount']).date).toBe('Transaction Date');
      expect(detectColumnsFromHeaders(['Txn Date', 'Amount']).date).toBe('Txn Date');
    });

    it('detects description column', () => {
      const headers = ['Date', 'Description', 'Amount'];
      const result = detectColumnsFromHeaders(headers);
      expect(result.description).toBe('Description');
    });

    it('detects description with variations', () => {
      expect(detectColumnsFromHeaders(['Date', 'Name', 'Amount']).description).toBe('Name');
      expect(detectColumnsFromHeaders(['Date', 'Payee', 'Amount']).description).toBe('Payee');
      expect(detectColumnsFromHeaders(['Date', 'Merchant', 'Amount']).description).toBe('Merchant');
    });

    it('detects single amount column', () => {
      const headers = ['Date', 'Description', 'Amount'];
      const result = detectColumnsFromHeaders(headers);
      expect(result.amount).toBe('Amount');
    });

    it('detects debit/credit columns', () => {
      const headers = ['Date', 'Description', 'Debit', 'Credit'];
      const result = detectColumnsFromHeaders(headers);
      expect(result.debit).toBe('Debit');
      expect(result.credit).toBe('Credit');
    });

    it('detects Paid Out/Paid In variations', () => {
      const headers = ['Date', 'Description', 'Paid Out', 'Paid In'];
      const result = detectColumnsFromHeaders(headers);
      expect(result.debit).toBe('Paid Out');
      expect(result.credit).toBe('Paid In');
    });

    it('detects reference column', () => {
      const headers = ['Date', 'Reference', 'Description', 'Amount'];
      const result = detectColumnsFromHeaders(headers);
      expect(result.reference).toBe('Reference');
    });

    it('detects balance column', () => {
      const headers = ['Date', 'Description', 'Amount', 'Balance'];
      const result = detectColumnsFromHeaders(headers);
      expect(result.balance).toBe('Balance');
    });

    it('detects category column', () => {
      const headers = ['Date', 'Description', 'Amount', 'Category'];
      const result = detectColumnsFromHeaders(headers);
      expect(result.category).toBe('Category');
    });
  });

  describe('validateMapping', () => {
    it('returns valid for complete mapping with single amount', () => {
      const mapping = {
        date: 'Date',
        description: 'Description',
        amount: 'Amount',
      };

      const result = validateMapping(mapping);

      expect(result.valid).toBe(true);
      expect(result.missingRequired).toHaveLength(0);
    });

    it('returns valid for complete mapping with debit/credit', () => {
      const mapping = {
        date: 'Date',
        description: 'Description',
        debit: 'Paid Out',
        credit: 'Paid In',
      };

      const result = validateMapping(mapping);

      expect(result.valid).toBe(true);
      expect(result.missingRequired).toHaveLength(0);
    });

    it('returns invalid for missing date', () => {
      const mapping = {
        description: 'Description',
        amount: 'Amount',
      };

      const result = validateMapping(mapping);

      expect(result.valid).toBe(false);
      expect(result.missingRequired).toContain('date');
    });

    it('returns invalid for missing description', () => {
      const mapping = {
        date: 'Date',
        amount: 'Amount',
      };

      const result = validateMapping(mapping);

      expect(result.valid).toBe(false);
      expect(result.missingRequired).toContain('description');
    });

    it('returns invalid for missing amount columns', () => {
      const mapping = {
        date: 'Date',
        description: 'Description',
      };

      const result = validateMapping(mapping);

      expect(result.valid).toBe(false);
      expect(result.missingRequired.some((m) => m.includes('amount'))).toBe(true);
    });

    it('returns invalid for partial debit/credit mapping', () => {
      const mapping = {
        date: 'Date',
        description: 'Description',
        debit: 'Paid Out',
        // Missing credit
      };

      const result = validateMapping(mapping);

      expect(result.valid).toBe(false);
    });
  });
});
