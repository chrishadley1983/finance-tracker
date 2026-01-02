import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  convertToImportFormat,
  getPdfColumnMapping,
  PdfVisionError,
} from '@/lib/import/pdf-vision-parser';
import type { ExtractedTransaction } from '@/lib/import/prompts/pdf-statement';

describe('PDF Vision Parser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = 'test-key';
  });

  describe('PdfVisionError', () => {
    it('should create error with code', () => {
      const error = new PdfVisionError('Test error', 'API_ERROR');
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('API_ERROR');
      expect(error.name).toBe('PdfVisionError');
    });

    it('should have all valid error codes', () => {
      const codes = [
        'API_ERROR',
        'PARSE_ERROR',
        'INVALID_RESPONSE',
        'RATE_LIMITED',
        'TIMEOUT',
        'NO_TRANSACTIONS',
        'IMAGE_TOO_LARGE',
      ] as const;
      codes.forEach((code) => {
        const error = new PdfVisionError('Test', code);
        expect(error.code).toBe(code);
      });
    });
  });

  describe('convertToImportFormat', () => {
    it('should convert transactions to headers and rows', () => {
      const transactions: ExtractedTransaction[] = [
        {
          date: '01 Dec 25',
          paymentType: 'DD',
          description: 'Netflix Subscription',
          paidOut: 15.99,
          paidIn: null,
          balance: 1234.56,
        },
        {
          date: '02 Dec 25',
          paymentType: 'TFR',
          description: 'Salary',
          paidOut: null,
          paidIn: 2500.0,
          balance: 3734.56,
        },
      ];

      const result = convertToImportFormat(transactions);

      expect(result.headers).toEqual([
        'Date',
        'Payment Type',
        'Description',
        'Paid Out',
        'Paid In',
        'Balance',
      ]);
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0]).toEqual([
        '01 Dec 25',
        'DD',
        'Netflix Subscription',
        '15.99',
        '',
        '1234.56',
      ]);
      expect(result.rows[1]).toEqual([
        '02 Dec 25',
        'TFR',
        'Salary',
        '',
        '2500',
        '3734.56',
      ]);
    });

    it('should handle null values', () => {
      const transactions: ExtractedTransaction[] = [
        {
          date: '01 Dec 25',
          paymentType: null,
          description: 'Unknown transaction',
          paidOut: null,
          paidIn: null,
          balance: null,
        },
      ];

      const result = convertToImportFormat(transactions);

      expect(result.rows[0]).toEqual(['01 Dec 25', '', 'Unknown transaction', '', '', '']);
    });

    it('should handle empty transactions array', () => {
      const result = convertToImportFormat([]);

      expect(result.headers).toHaveLength(6);
      expect(result.rows).toHaveLength(0);
    });
  });

  describe('getPdfColumnMapping', () => {
    it('should return correct column mapping', () => {
      const mapping = getPdfColumnMapping();

      expect(mapping).toEqual({
        date: 'Date',
        description: 'Description',
        debit: 'Paid Out',
        credit: 'Paid In',
        balance: 'Balance',
      });
    });
  });

  // Tests for parseStatementPage and parseAllPages require complex Anthropic SDK mocking
  // These are covered by API integration tests
});
