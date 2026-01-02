import { describe, it, expect } from 'vitest';
import {
  normalizeDate,
  normalizeAmount,
  parseDebitCredit,
  normalizeDescription,
  extractPayee,
  formatDateToISO,
} from '@/lib/import/normalizers';

describe('Date Normalization', () => {
  describe('normalizeDate', () => {
    it('parses UK format DD/MM/YYYY', () => {
      const result = normalizeDate('15/01/2024');
      expect(result.date).not.toBeNull();
      expect(result.format).toBe('DD/MM/YYYY');
      expect(formatDateToISO(result.date!)).toBe('2024-01-15');
    });

    it('parses UK format with dashes DD-MM-YYYY', () => {
      const result = normalizeDate('15-01-2024');
      expect(result.date).not.toBeNull();
      expect(formatDateToISO(result.date!)).toBe('2024-01-15');
    });

    it('parses ISO format YYYY-MM-DD', () => {
      const result = normalizeDate('2024-01-15');
      expect(result.date).not.toBeNull();
      expect(result.format).toBe('YYYY-MM-DD');
      expect(formatDateToISO(result.date!)).toBe('2024-01-15');
    });

    it('parses text format DD MMM YYYY', () => {
      const result = normalizeDate('15 Jan 2024');
      expect(result.date).not.toBeNull();
      expect(formatDateToISO(result.date!)).toBe('2024-01-15');
    });

    it('parses full month name DD MMMM YYYY', () => {
      const result = normalizeDate('15 January 2024');
      expect(result.date).not.toBeNull();
      expect(formatDateToISO(result.date!)).toBe('2024-01-15');
    });

    it('parses UK datetime format', () => {
      const result = normalizeDate('15/01/2024 10:30:45');
      expect(result.date).not.toBeNull();
      expect(formatDateToISO(result.date!)).toBe('2024-01-15');
    });

    it('parses ISO datetime format', () => {
      const result = normalizeDate('2024-01-15 10:30:45');
      expect(result.date).not.toBeNull();
      expect(formatDateToISO(result.date!)).toBe('2024-01-15');
    });

    it('returns null for empty string', () => {
      const result = normalizeDate('');
      expect(result.date).toBeNull();
    });

    it('returns null for invalid date', () => {
      const result = normalizeDate('not a date');
      expect(result.date).toBeNull();
    });

    it('returns null for invalid date values', () => {
      const result = normalizeDate('32/01/2024');
      expect(result.date).toBeNull();
    });

    it('warns about ambiguous dates', () => {
      const result = normalizeDate('05/06/2024');
      expect(result.date).not.toBeNull();
      expect(result.warning).toContain('ambiguous');
    });

    it('uses expected format when provided', () => {
      const result = normalizeDate('15/01/2024', 'DD/MM/YYYY');
      expect(result.date).not.toBeNull();
      expect(result.format).toBe('DD/MM/YYYY');
    });

    it('handles single digit day and month', () => {
      const result = normalizeDate('5/1/2024');
      expect(result.date).not.toBeNull();
      expect(formatDateToISO(result.date!)).toBe('2024-01-05');
    });
  });

  describe('formatDateToISO', () => {
    it('formats date as YYYY-MM-DD', () => {
      const date = new Date(2024, 0, 15); // January 15, 2024
      expect(formatDateToISO(date)).toBe('2024-01-15');
    });

    it('pads single digit months and days', () => {
      const date = new Date(2024, 0, 5); // January 5, 2024
      expect(formatDateToISO(date)).toBe('2024-01-05');
    });
  });
});

describe('Amount Normalization', () => {
  describe('normalizeAmount', () => {
    it('parses simple positive number', () => {
      expect(normalizeAmount('100')).toBe(100);
      expect(normalizeAmount('100.00')).toBe(100);
      expect(normalizeAmount('123.45')).toBe(123.45);
    });

    it('parses negative with minus sign', () => {
      expect(normalizeAmount('-100')).toBe(-100);
      expect(normalizeAmount('-123.45')).toBe(-123.45);
    });

    it('parses positive with plus sign', () => {
      expect(normalizeAmount('+100')).toBe(100);
    });

    it('parses parentheses format (100.00)', () => {
      expect(normalizeAmount('(100.00)')).toBe(-100);
      expect(normalizeAmount('(50)')).toBe(-50);
    });

    it('parses trailing minus format 100.00-', () => {
      expect(normalizeAmount('100.00-')).toBe(-100);
    });

    it('parses DR/CR format', () => {
      expect(normalizeAmount('100.00 DR')).toBe(-100);
      expect(normalizeAmount('100.00DR')).toBe(-100);
      expect(normalizeAmount('100.00 CR')).toBe(100);
      expect(normalizeAmount('100.00CR')).toBe(100);
    });

    it('strips currency symbols', () => {
      expect(normalizeAmount('£100.00')).toBe(100);
      expect(normalizeAmount('$50.00')).toBe(50);
      expect(normalizeAmount('€75.00')).toBe(75);
      expect(normalizeAmount('£ 100.00')).toBe(100);
    });

    it('handles thousand separators with period decimal', () => {
      expect(normalizeAmount('1,234.56')).toBe(1234.56);
      expect(normalizeAmount('1,234,567.89')).toBe(1234567.89);
    });

    it('handles European format with comma decimal', () => {
      expect(normalizeAmount('1.234,56', { decimalSeparator: ',' })).toBe(1234.56);
    });

    it('handles space as thousand separator', () => {
      expect(normalizeAmount('1 234.56')).toBe(1234.56);
    });

    it('returns null for empty/invalid values', () => {
      expect(normalizeAmount('')).toBeNull();
      expect(normalizeAmount('   ')).toBeNull();
      expect(normalizeAmount('not a number')).toBeNull();
      expect(normalizeAmount(null as unknown as string)).toBeNull();
    });

    it('applies isDebit option', () => {
      expect(normalizeAmount('100', { isDebit: true })).toBe(-100);
      expect(normalizeAmount('-100', { isDebit: true })).toBe(-100);
    });

    it('rounds to 2 decimal places', () => {
      expect(normalizeAmount('100.999')).toBe(101);
      expect(normalizeAmount('100.994')).toBe(100.99);
    });
  });

  describe('parseDebitCredit', () => {
    it('returns negative for debit value', () => {
      expect(parseDebitCredit('100.00', '')).toBe(-100);
      expect(parseDebitCredit('50', undefined)).toBe(-50);
    });

    it('returns positive for credit value', () => {
      expect(parseDebitCredit('', '100.00')).toBe(100);
      expect(parseDebitCredit(undefined, '50')).toBe(50);
    });

    it('prioritizes debit over credit', () => {
      expect(parseDebitCredit('100', '200')).toBe(-100);
    });

    it('returns null when both empty', () => {
      expect(parseDebitCredit('', '')).toBeNull();
      expect(parseDebitCredit(undefined, undefined)).toBeNull();
      expect(parseDebitCredit('  ', '  ')).toBeNull();
    });

    it('returns null for zero values', () => {
      expect(parseDebitCredit('0', '')).toBeNull();
      expect(parseDebitCredit('', '0')).toBeNull();
    });
  });
});

describe('Description Normalization', () => {
  describe('normalizeDescription', () => {
    it('trims whitespace', () => {
      expect(normalizeDescription('  Test  ')).toBe('Test');
    });

    it('collapses multiple spaces', () => {
      expect(normalizeDescription('Test   with   spaces')).toBe('Test with spaces');
    });

    it('removes excessive special characters', () => {
      expect(normalizeDescription('Test^^^value')).toBe('Testvalue');
    });

    it('preserves meaningful special characters', () => {
      expect(normalizeDescription("Test's value")).toBe("Test's value");
      expect(normalizeDescription('Test & Co')).toBe('Test & Co');
      // Note: trailing dots are stripped by the normalizer
      expect(normalizeDescription('Test & Co.')).toBe('Test & Co');
    });

    it('truncates long descriptions', () => {
      const longDesc = 'A'.repeat(600);
      const result = normalizeDescription(longDesc);
      expect(result.length).toBe(500);
      expect(result.endsWith('...')).toBe(true);
    });

    it('returns empty string for empty input', () => {
      expect(normalizeDescription('')).toBe('');
      expect(normalizeDescription(null as unknown as string)).toBe('');
    });
  });

  describe('extractPayee', () => {
    it('removes CARD PAYMENT TO prefix', () => {
      expect(extractPayee('CARD PAYMENT TO TESCO')).toBe('TESCO');
    });

    it('removes DIRECT DEBIT TO prefix', () => {
      expect(extractPayee('DIRECT DEBIT TO NETFLIX')).toBe('NETFLIX');
    });

    it('removes trailing dates', () => {
      expect(extractPayee('TESCO 15/01/2024')).toBe('TESCO');
      expect(extractPayee('TESCO 15 JAN')).toBe('TESCO');
    });

    it('removes reference numbers', () => {
      expect(extractPayee('TESCO REF: 12345')).toBe('TESCO');
      expect(extractPayee('TESCO 123456789')).toBe('TESCO');
    });

    it('handles VIS prefix', () => {
      expect(extractPayee('VIS TESCO')).toBe('TESCO');
    });
  });
});
