import { describe, it, expect } from 'vitest';
import {
  parseCSVString,
  detectDelimiter,
  detectEncoding,
} from '@/lib/import/parser';

describe('CSV Parser', () => {
  describe('detectDelimiter', () => {
    it('detects comma delimiter', () => {
      const content = 'Date,Description,Amount\n2024-01-01,Test,100';
      expect(detectDelimiter(content)).toBe(',');
    });

    it('detects semicolon delimiter', () => {
      const content = 'Date;Description;Amount\n2024-01-01;Test;100';
      expect(detectDelimiter(content)).toBe(';');
    });

    it('detects tab delimiter', () => {
      const content = 'Date\tDescription\tAmount\n2024-01-01\tTest\t100';
      expect(detectDelimiter(content)).toBe('\t');
    });

    it('handles quoted fields with embedded commas', () => {
      const content = 'Date,Description,Amount\n2024-01-01,"Test, with comma",100';
      expect(detectDelimiter(content)).toBe(',');
    });

    it('defaults to comma for ambiguous content', () => {
      const content = 'single column\nno delimiters';
      expect(detectDelimiter(content)).toBe(',');
    });
  });

  describe('detectEncoding', () => {
    it('detects UTF-8 BOM', () => {
      const buffer = new Uint8Array([0xef, 0xbb, 0xbf, 0x68, 0x65, 0x6c, 0x6c, 0x6f]).buffer;
      expect(detectEncoding(buffer)).toBe('utf-8');
    });

    it('detects UTF-16 LE BOM', () => {
      const buffer = new Uint8Array([0xff, 0xfe, 0x68, 0x00]).buffer;
      expect(detectEncoding(buffer)).toBe('utf-16le');
    });

    it('detects UTF-16 BE BOM', () => {
      const buffer = new Uint8Array([0xfe, 0xff, 0x00, 0x68]).buffer;
      expect(detectEncoding(buffer)).toBe('utf-16be');
    });

    it('defaults to UTF-8 for valid UTF-8 content', () => {
      const buffer = new Uint8Array([0x68, 0x65, 0x6c, 0x6c, 0x6f]).buffer;
      expect(detectEncoding(buffer)).toBe('utf-8');
    });
  });

  describe('parseCSVString', () => {
    it('parses simple CSV with headers', () => {
      const content = 'Date,Description,Amount\n2024-01-01,Test,100\n2024-01-02,Test2,200';
      const result = parseCSVString(content);

      expect(result.headers).toEqual(['Date', 'Description', 'Amount']);
      expect(result.rows).toHaveLength(2);
      expect(result.totalRows).toBe(2);
      expect(result.delimiter).toBe(',');
    });

    it('handles quoted fields', () => {
      const content = 'Date,Description,Amount\n2024-01-01,"Test, with comma",100';
      const result = parseCSVString(content);

      expect(result.rows[0][1]).toBe('Test, with comma');
    });

    it('handles embedded newlines in quotes', () => {
      const content = 'Date,Description,Amount\n2024-01-01,"Line 1\nLine 2",100';
      const result = parseCSVString(content);

      expect(result.rows[0][1]).toBe('Line 1\nLine 2');
    });

    it('trims whitespace from values', () => {
      const content = 'Date,Description,Amount\n  2024-01-01  ,  Test  ,  100  ';
      const result = parseCSVString(content);

      expect(result.rows[0][0]).toBe('2024-01-01');
      expect(result.rows[0][1]).toBe('Test');
      expect(result.rows[0][2]).toBe('100');
    });

    it('skips empty rows', () => {
      const content = 'Date,Description,Amount\n2024-01-01,Test,100\n\n2024-01-02,Test2,200';
      const result = parseCSVString(content);

      expect(result.rows).toHaveLength(2);
    });

    it('handles headerless CSV', () => {
      const content = '2024-01-01,Test,100\n2024-01-02,Test2,200';
      const result = parseCSVString(content, { hasHeader: false });

      expect(result.headers).toEqual([]);
      expect(result.rows).toHaveLength(2);
    });

    it('skips initial rows when specified', () => {
      const content = 'Bank Statement\nGenerated: 2024-01-01\nDate,Description,Amount\n2024-01-01,Test,100';
      const result = parseCSVString(content, { skipRows: 2 });

      expect(result.headers).toEqual(['Date', 'Description', 'Amount']);
      expect(result.rows).toHaveLength(1);
    });

    it('removes BOM from content', () => {
      const content = '\uFEFFDate,Description,Amount\n2024-01-01,Test,100';
      const result = parseCSVString(content);

      expect(result.headers[0]).toBe('Date');
    });

    it('uses specified delimiter', () => {
      const content = 'Date;Description;Amount\n2024-01-01;Test;100';
      const result = parseCSVString(content, { delimiter: ';' });

      expect(result.headers).toEqual(['Date', 'Description', 'Amount']);
    });
  });

  describe('HSBC format parsing', () => {
    it('parses HSBC current account format', () => {
      const content = `Date,Type,Description,Paid Out,Paid In,Balance
15/01/2024,DD,NETFLIX,12.99,,1234.56
16/01/2024,CR,SALARY,,2500.00,3734.56`;

      const result = parseCSVString(content);

      expect(result.headers).toEqual(['Date', 'Type', 'Description', 'Paid Out', 'Paid In', 'Balance']);
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0][2]).toBe('NETFLIX');
      expect(result.rows[0][3]).toBe('12.99');
      expect(result.rows[1][4]).toBe('2500.00');
    });

    it('parses HSBC credit card format', () => {
      const content = `Date,Description,Amount
15/01/2024,AMAZON UK,45.99
16/01/2024,PAYMENT RECEIVED,-100.00`;

      const result = parseCSVString(content);

      expect(result.headers).toEqual(['Date', 'Description', 'Amount']);
      expect(result.rows).toHaveLength(2);
    });
  });

  describe('Monzo format parsing', () => {
    it('parses Monzo export format', () => {
      const content = `Transaction ID,Date,Time,Type,Name,Emoji,Category,Amount,Currency,Local amount,Local currency,Notes and #tags,Address,Receipt,Description,Category split,Money Out,Money In
tx_123,15/01/2024,12:30:00,Card Payment,Tesco,🛒,Groceries,-25.50,GBP,-25.50,GBP,,,,"Card payment",,25.50,`;

      const result = parseCSVString(content);

      expect(result.headers).toContain('Transaction ID');
      expect(result.headers).toContain('Category');
      expect(result.rows).toHaveLength(1);
    });
  });
});
