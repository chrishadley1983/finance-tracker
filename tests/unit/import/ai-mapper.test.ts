import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildColumnMappingPrompt,
  formatHeaders,
  formatSampleRows,
  validateAIResponse,
  type AIMappingResponse,
} from '@/lib/import/prompts/column-mapping';
import { generateHeadersHash, shouldUseAI } from '@/lib/import/ai-mapper';

describe('Column Mapping Prompt', () => {
  describe('formatHeaders', () => {
    it('formats headers with numbered list', () => {
      const headers = ['Date', 'Amount', 'Description'];
      const result = formatHeaders(headers);

      expect(result).toBe('1. "Date"\n2. "Amount"\n3. "Description"');
    });

    it('handles empty headers', () => {
      const result = formatHeaders([]);
      expect(result).toBe('');
    });

    it('handles headers with special characters', () => {
      const headers = ['Transaction "Type"', "Payee's Name"];
      const result = formatHeaders(headers);

      expect(result).toBe('1. "Transaction "Type""\n2. "Payee\'s Name"');
    });
  });

  describe('formatSampleRows', () => {
    it('formats sample rows with labels', () => {
      const headers = ['Date', 'Amount'];
      const rows = [['2024-01-01', '100.00']];
      const result = formatSampleRows(headers, rows);

      expect(result).toContain('Row 1:');
      expect(result).toContain('Date: "2024-01-01"');
      expect(result).toContain('Amount: "100.00"');
    });

    it('handles empty rows', () => {
      const result = formatSampleRows(['Date'], []);
      expect(result).toBe('(No data rows)');
    });

    it('limits to 5 rows', () => {
      const headers = ['Col'];
      const rows = Array(10)
        .fill(null)
        .map((_, i) => [`Row${i}`]);
      const result = formatSampleRows(headers, rows);

      expect(result).toContain('Row 1:');
      expect(result).toContain('Row 5:');
      expect(result).not.toContain('Row 6:');
    });

    it('handles missing values in rows', () => {
      const headers = ['Date', 'Amount', 'Description'];
      const rows = [['2024-01-01', '100.00']]; // Missing description
      const result = formatSampleRows(headers, rows);

      expect(result).toContain('Description: ""');
    });
  });

  describe('buildColumnMappingPrompt', () => {
    it('builds complete prompt with headers and sample rows', () => {
      const headers = ['Date', 'Amount', 'Description'];
      const sampleRows = [['2024-01-01', '100.00', 'Test transaction']];

      const result = buildColumnMappingPrompt(headers, sampleRows);

      expect(result).toContain('analysing a CSV file');
      expect(result).toContain('1. "Date"');
      expect(result).toContain('Row 1:');
      expect(result).toContain('Test transaction');
    });
  });

  describe('validateAIResponse', () => {
    const validResponse: AIMappingResponse = {
      mapping: {
        date: 'Date',
        description: 'Description',
        amount: 'Amount',
        debit: null,
        credit: null,
        reference: null,
        balance: null,
      },
      dateFormat: 'YYYY-MM-DD',
      decimalSeparator: '.',
      amountStyle: 'single',
      confidence: 0.9,
      reasoning: 'Test reasoning',
      warnings: [],
    };

    it('accepts valid response', () => {
      expect(validateAIResponse(validResponse)).toBe(true);
    });

    it('rejects null', () => {
      expect(validateAIResponse(null)).toBe(false);
    });

    it('rejects non-object', () => {
      expect(validateAIResponse('string')).toBe(false);
    });

    it('rejects missing mapping', () => {
      const invalid = { ...validResponse, mapping: undefined };
      expect(validateAIResponse(invalid)).toBe(false);
    });

    it('rejects invalid dateFormat', () => {
      const invalid = { ...validResponse, dateFormat: 123 };
      expect(validateAIResponse(invalid)).toBe(false);
    });

    it('rejects invalid decimalSeparator', () => {
      const invalid = { ...validResponse, decimalSeparator: ';' };
      expect(validateAIResponse(invalid)).toBe(false);
    });

    it('rejects invalid amountStyle', () => {
      const invalid = { ...validResponse, amountStyle: 'both' };
      expect(validateAIResponse(invalid)).toBe(false);
    });

    it('rejects invalid confidence', () => {
      const invalid = { ...validResponse, confidence: 'high' };
      expect(validateAIResponse(invalid)).toBe(false);
    });

    it('rejects missing mapping keys', () => {
      const invalid = {
        ...validResponse,
        mapping: { date: 'Date' }, // Missing other keys
      };
      expect(validateAIResponse(invalid)).toBe(false);
    });

    it('rejects invalid mapping values (non-string, non-null)', () => {
      const invalid = {
        ...validResponse,
        mapping: { ...validResponse.mapping, date: 123 },
      };
      expect(validateAIResponse(invalid)).toBe(false);
    });

    it('accepts response with separate debit/credit', () => {
      const separateAmounts: AIMappingResponse = {
        ...validResponse,
        mapping: {
          ...validResponse.mapping,
          amount: null,
          debit: 'Debit',
          credit: 'Credit',
        },
        amountStyle: 'separate',
      };
      expect(validateAIResponse(separateAmounts)).toBe(true);
    });
  });
});

describe('AI Mapper Utilities', () => {
  describe('generateHeadersHash', () => {
    it('generates consistent hash for same headers', () => {
      const headers = ['Date', 'Amount', 'Description'];
      const hash1 = generateHeadersHash(headers);
      const hash2 = generateHeadersHash(headers);

      expect(hash1).toBe(hash2);
    });

    it('generates different hash for different headers', () => {
      const headers1 = ['Date', 'Amount'];
      const headers2 = ['Date', 'Description'];

      const hash1 = generateHeadersHash(headers1);
      const hash2 = generateHeadersHash(headers2);

      expect(hash1).not.toBe(hash2);
    });

    it('generates same hash regardless of order (sorted for caching)', () => {
      const headers1 = ['Date', 'Amount'];
      const headers2 = ['Amount', 'Date'];

      const hash1 = generateHeadersHash(headers1);
      const hash2 = generateHeadersHash(headers2);

      // Headers are sorted before hashing for consistent cache keys
      expect(hash1).toBe(hash2);
    });

    it('generates hex string', () => {
      const headers = ['Test'];
      const hash = generateHeadersHash(headers);

      expect(hash).toMatch(/^[0-9a-f]+$/);
    });
  });

  describe('shouldUseAI', () => {
    it('returns true for low confidence', () => {
      expect(shouldUseAI(0.3)).toBe(true);
      expect(shouldUseAI(0.5)).toBe(true);
    });

    it('returns false for high confidence', () => {
      expect(shouldUseAI(0.7)).toBe(false);
      expect(shouldUseAI(0.9)).toBe(false);
    });

    it('returns false at threshold (0.6)', () => {
      // Uses < 0.6, so exactly 0.6 returns false
      expect(shouldUseAI(0.6)).toBe(false);
    });

    it('returns true just below threshold', () => {
      expect(shouldUseAI(0.59)).toBe(true);
    });

    it('returns false just above threshold', () => {
      expect(shouldUseAI(0.61)).toBe(false);
    });
  });
});
