import { describe, it, expect } from 'vitest';
import {
  getPromptForFormat,
  validateVisionResponse,
  parseAIResponse,
  HSBC_CURRENT_STATEMENT_PROMPT,
  GENERIC_STATEMENT_PROMPT,
  type ExtractedTransaction,
  type VisionExtractionResponse,
} from '@/lib/import/prompts/pdf-statement';

describe('PDF Statement Prompts', () => {
  describe('HSBC_CURRENT_STATEMENT_PROMPT', () => {
    it('should contain key extraction instructions', () => {
      expect(HSBC_CURRENT_STATEMENT_PROMPT).toContain('transactions');
      expect(HSBC_CURRENT_STATEMENT_PROMPT).toContain('JSON');
      expect(HSBC_CURRENT_STATEMENT_PROMPT).toContain('date');
      expect(HSBC_CURRENT_STATEMENT_PROMPT).toContain('description');
    });

    it('should mention HSBC-specific details', () => {
      expect(HSBC_CURRENT_STATEMENT_PROMPT).toContain('balance');
    });
  });

  describe('getPromptForFormat', () => {
    it('should return HSBC current prompt for hsbc_current', () => {
      const prompt = getPromptForFormat('hsbc_current');
      expect(prompt).toBe(HSBC_CURRENT_STATEMENT_PROMPT);
    });

    it('should default to generic prompt for unknown formats', () => {
      // @ts-expect-error - testing invalid format
      const prompt = getPromptForFormat('unknown_format');
      expect(prompt).toBe(GENERIC_STATEMENT_PROMPT);
    });

    it('should return generic prompt for generic format', () => {
      const prompt = getPromptForFormat('generic');
      expect(prompt).toBe(GENERIC_STATEMENT_PROMPT);
    });
  });

  describe('parseAIResponse', () => {
    it('should parse valid JSON response', () => {
      const jsonString = JSON.stringify({
        transactions: [
          {
            date: '01 Dec 25',
            paymentType: 'DD',
            description: 'Test',
            paidOut: 10.0,
            paidIn: null,
            balance: 100.0,
          },
        ],
        confidence: 0.95,
        warnings: [],
      });

      const result = parseAIResponse(jsonString) as VisionExtractionResponse;
      expect(result).toBeDefined();
      expect(result.transactions).toHaveLength(1);
    });

    it('should extract JSON from markdown code blocks', () => {
      const markdownResponse = `\`\`\`json
{
  "transactions": [
    {
      "date": "01 Dec 25",
      "paymentType": "DD",
      "description": "Test",
      "paidOut": 10.0,
      "paidIn": null,
      "balance": 100.0
    }
  ],
  "confidence": 0.95,
  "warnings": []
}
\`\`\``;

      const result = parseAIResponse(markdownResponse) as VisionExtractionResponse;
      expect(result.transactions).toHaveLength(1);
    });

    it('should throw for invalid JSON', () => {
      expect(() => parseAIResponse('not json at all')).toThrow();
    });

    it('should throw for empty response', () => {
      expect(() => parseAIResponse('')).toThrow();
    });

    it('should parse simple JSON without code blocks', () => {
      const response = `{"transactions": [], "confidence": 0.5, "warnings": ["No transactions found"]}`;

      const result = parseAIResponse(response) as VisionExtractionResponse;
      expect(result.confidence).toBe(0.5);
    });
  });

  describe('validateVisionResponse', () => {
    it('should accept valid response', () => {
      const validResponse: VisionExtractionResponse = {
        transactions: [
          {
            date: '01 Dec 25',
            paymentType: 'DD',
            description: 'Netflix',
            paidOut: 15.99,
            paidIn: null,
            balance: 1234.56,
          },
        ],
        confidence: 0.95,
        warnings: [],
      };

      expect(validateVisionResponse(validResponse)).toBe(true);
    });

    it('should accept response with optional fields', () => {
      const responseWithOptional: VisionExtractionResponse = {
        transactions: [],
        confidence: 0.5,
        warnings: ['No transactions found'],
        statementPeriod: {
          start: '01 Dec 25',
          end: '31 Dec 25',
        },
        accountInfo: {
          accountNumber: '12345678',
          sortCode: '40-50-60',
          accountName: 'Current Account',
        },
      };

      expect(validateVisionResponse(responseWithOptional)).toBe(true);
    });

    it('should reject null', () => {
      expect(validateVisionResponse(null)).toBe(false);
    });

    it('should reject undefined', () => {
      expect(validateVisionResponse(undefined)).toBe(false);
    });

    it('should reject non-object', () => {
      expect(validateVisionResponse('string')).toBe(false);
      expect(validateVisionResponse(123)).toBe(false);
      expect(validateVisionResponse([])).toBe(false);
    });

    it('should reject missing transactions', () => {
      expect(
        validateVisionResponse({
          confidence: 0.95,
          warnings: [],
        })
      ).toBe(false);
    });

    it('should reject non-array transactions', () => {
      expect(
        validateVisionResponse({
          transactions: 'not an array',
          confidence: 0.95,
          warnings: [],
        })
      ).toBe(false);
    });

    it('should reject missing confidence', () => {
      expect(
        validateVisionResponse({
          transactions: [],
          warnings: [],
        })
      ).toBe(false);
    });

    it('should reject non-number confidence', () => {
      expect(
        validateVisionResponse({
          transactions: [],
          confidence: 'high',
          warnings: [],
        })
      ).toBe(false);
    });

    it('should reject missing warnings', () => {
      expect(
        validateVisionResponse({
          transactions: [],
          confidence: 0.95,
        })
      ).toBe(false);
    });

    it('should reject non-array warnings', () => {
      expect(
        validateVisionResponse({
          transactions: [],
          confidence: 0.95,
          warnings: 'no warnings',
        })
      ).toBe(false);
    });

    it('should validate transaction structure', () => {
      // Transaction missing required fields
      expect(
        validateVisionResponse({
          transactions: [{ date: '01 Dec 25' }], // Missing description
          confidence: 0.95,
          warnings: [],
        })
      ).toBe(false);
    });

    it('should reject transaction with all null amounts', () => {
      // A transaction must have at least one of paidOut or paidIn
      const response = {
        transactions: [
          {
            date: '01 Dec 25',
            paymentType: null,
            description: 'Unknown entry',
            paidOut: null,
            paidIn: null,
            balance: null,
          },
        ],
        confidence: 0.5,
        warnings: ['Could not parse amounts'],
      };

      expect(validateVisionResponse(response)).toBe(false);
    });

    it('should accept transaction with only paidOut', () => {
      const response: VisionExtractionResponse = {
        transactions: [
          {
            date: '01 Dec 25',
            paymentType: null,
            description: 'Withdrawal',
            paidOut: 50.0,
            paidIn: null,
            balance: null,
          },
        ],
        confidence: 0.8,
        warnings: [],
      };

      expect(validateVisionResponse(response)).toBe(true);
    });

    it('should accept transaction with null date (continuation page)', () => {
      const response: VisionExtractionResponse = {
        transactions: [
          {
            date: null,
            paymentType: ')))',
            description: 'LIDL GB TONBRIDGE',
            paidOut: 25.50,
            paidIn: null,
            balance: 1000.00,
          },
        ],
        confidence: 0.85,
        warnings: [],
      };

      expect(validateVisionResponse(response)).toBe(true);
    });

    it('should reject transaction with empty string date', () => {
      const response = {
        transactions: [
          {
            date: '',
            paymentType: null,
            description: 'Test',
            paidOut: 10.0,
            paidIn: null,
            balance: null,
          },
        ],
        confidence: 0.8,
        warnings: [],
      };

      expect(validateVisionResponse(response)).toBe(false);
    });
  });

  describe('ExtractedTransaction type', () => {
    it('should allow valid transaction', () => {
      const tx: ExtractedTransaction = {
        date: '01 Dec 25',
        paymentType: 'DD',
        description: 'Test transaction',
        paidOut: 50.0,
        paidIn: null,
        balance: 1000.0,
      };

      expect(tx.date).toBe('01 Dec 25');
      expect(tx.paymentType).toBe('DD');
      expect(tx.description).toBe('Test transaction');
      expect(tx.paidOut).toBe(50.0);
      expect(tx.paidIn).toBeNull();
      expect(tx.balance).toBe(1000.0);
    });

    it('should allow credit transaction', () => {
      const tx: ExtractedTransaction = {
        date: '15 Dec 25',
        paymentType: 'TFR',
        description: 'Salary payment',
        paidOut: null,
        paidIn: 2500.0,
        balance: 3500.0,
      };

      expect(tx.paidOut).toBeNull();
      expect(tx.paidIn).toBe(2500.0);
    });
  });
});
