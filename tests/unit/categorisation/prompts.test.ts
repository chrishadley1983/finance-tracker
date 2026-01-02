import { describe, it, expect } from 'vitest';
import {
  formatCategoriesList,
  formatTransaction,
  formatTransactionsList,
  buildSingleCategorisePrompt,
  buildBatchCategorisePrompt,
  validateSingleResponse,
  validateBatchResponse,
  type Category,
  type TransactionForCategorisation,
} from '@/lib/categorisation/prompts/categorise';

describe('Categorisation Prompts', () => {
  const mockCategories: Category[] = [
    { id: 'cat-1', name: 'Groceries', groupName: 'Essential', isIncome: false },
    { id: 'cat-2', name: 'Transport', groupName: 'Essential', isIncome: false },
    { id: 'cat-3', name: 'Entertainment', groupName: 'Discretionary', isIncome: false },
    { id: 'cat-4', name: 'Salary', groupName: 'Income', isIncome: true },
  ];

  const mockTransaction: TransactionForCategorisation = {
    date: '2024-01-15',
    description: 'TESCO STORES 1234',
    amount: -50.99,
  };

  describe('formatCategoriesList', () => {
    it('formats categories grouped by group name', () => {
      const result = formatCategoriesList(mockCategories);

      expect(result).toContain('Essential:');
      expect(result).toContain('Discretionary:');
      expect(result).toContain('Income:');
      expect(result).toContain('Groceries');
      expect(result).toContain('Transport');
      expect(result).toContain('Entertainment');
      expect(result).toContain('Salary');
    });

    it('marks income categories with [INCOME] tag', () => {
      const result = formatCategoriesList(mockCategories);

      expect(result).toContain('Salary');
      expect(result).toContain('[INCOME]');
    });

    it('includes category IDs', () => {
      const result = formatCategoriesList(mockCategories);

      expect(result).toContain('id: cat-1');
      expect(result).toContain('id: cat-4');
    });

    it('handles empty categories', () => {
      const result = formatCategoriesList([]);
      expect(result).toBe('');
    });
  });

  describe('formatTransaction', () => {
    it('formats expense transaction correctly', () => {
      const result = formatTransaction(mockTransaction);

      expect(result).toContain('Date: 2024-01-15');
      expect(result).toContain('Amount: -£50.99');
      expect(result).toContain('Description: "TESCO STORES 1234"');
    });

    it('formats income transaction with + sign', () => {
      const incomeTransaction: TransactionForCategorisation = {
        date: '2024-01-20',
        description: 'SALARY PAYMENT',
        amount: 2500.0,
      };

      const result = formatTransaction(incomeTransaction);

      expect(result).toContain('Amount: +£2500.00');
    });

    it('handles zero amounts', () => {
      const zeroTransaction: TransactionForCategorisation = {
        date: '2024-01-15',
        description: 'REFUND',
        amount: 0,
      };

      const result = formatTransaction(zeroTransaction);
      expect(result).toContain('+£0.00');
    });
  });

  describe('formatTransactionsList', () => {
    it('formats multiple transactions with indices', () => {
      const transactions: TransactionForCategorisation[] = [
        { date: '2024-01-15', description: 'TESCO', amount: -50 },
        { date: '2024-01-16', description: 'AMAZON', amount: -25 },
        { date: '2024-01-17', description: 'SALARY', amount: 2500 },
      ];

      const result = formatTransactionsList(transactions);

      expect(result).toContain('0. Date: 2024-01-15');
      expect(result).toContain('1. Date: 2024-01-16');
      expect(result).toContain('2. Date: 2024-01-17');
    });

    it('handles empty list', () => {
      const result = formatTransactionsList([]);
      expect(result).toBe('');
    });
  });

  describe('buildSingleCategorisePrompt', () => {
    it('includes transaction details', () => {
      const prompt = buildSingleCategorisePrompt(mockTransaction, mockCategories);

      expect(prompt).toContain('2024-01-15');
      expect(prompt).toContain('TESCO STORES 1234');
      expect(prompt).toContain('£50.99');
      expect(prompt).toContain('expense');
    });

    it('includes categories list', () => {
      const prompt = buildSingleCategorisePrompt(mockTransaction, mockCategories);

      expect(prompt).toContain('Groceries');
      expect(prompt).toContain('Essential:');
    });

    it('includes JSON response format', () => {
      const prompt = buildSingleCategorisePrompt(mockTransaction, mockCategories);

      expect(prompt).toContain('categoryId');
      expect(prompt).toContain('confidence');
      expect(prompt).toContain('reasoning');
    });
  });

  describe('buildBatchCategorisePrompt', () => {
    it('includes all transactions', () => {
      const transactions: TransactionForCategorisation[] = [
        { date: '2024-01-15', description: 'TESCO', amount: -50 },
        { date: '2024-01-16', description: 'AMAZON', amount: -25 },
      ];

      const prompt = buildBatchCategorisePrompt(transactions, mockCategories);

      expect(prompt).toContain('TESCO');
      expect(prompt).toContain('AMAZON');
      expect(prompt).toContain('0.');
      expect(prompt).toContain('1.');
    });

    it('includes categories list', () => {
      const transactions: TransactionForCategorisation[] = [
        { date: '2024-01-15', description: 'TEST', amount: -10 },
      ];

      const prompt = buildBatchCategorisePrompt(transactions, mockCategories);

      expect(prompt).toContain('Groceries');
      expect(prompt).toContain('Entertainment');
    });
  });

  describe('validateSingleResponse', () => {
    it('validates correct response', () => {
      const response = {
        categoryId: 'cat-1',
        categoryName: 'Groceries',
        confidence: 0.85,
        reasoning: 'Looks like a grocery store',
      };

      expect(validateSingleResponse(response)).toBe(true);
    });

    it('validates response with alternatives', () => {
      const response = {
        categoryId: 'cat-1',
        categoryName: 'Groceries',
        confidence: 0.85,
        reasoning: 'Looks like a grocery store',
        alternatives: [
          { categoryId: 'cat-2', categoryName: 'Shopping', confidence: 0.6 },
        ],
      };

      expect(validateSingleResponse(response)).toBe(true);
    });

    it('rejects null', () => {
      expect(validateSingleResponse(null)).toBe(false);
    });

    it('rejects non-object', () => {
      expect(validateSingleResponse('string')).toBe(false);
    });

    it('rejects missing categoryId', () => {
      const response = {
        categoryName: 'Groceries',
        confidence: 0.85,
        reasoning: 'Test',
      };

      expect(validateSingleResponse(response)).toBe(false);
    });

    it('rejects missing categoryName', () => {
      const response = {
        categoryId: 'cat-1',
        confidence: 0.85,
        reasoning: 'Test',
      };

      expect(validateSingleResponse(response)).toBe(false);
    });

    it('rejects missing confidence', () => {
      const response = {
        categoryId: 'cat-1',
        categoryName: 'Groceries',
        reasoning: 'Test',
      };

      expect(validateSingleResponse(response)).toBe(false);
    });

    it('rejects missing reasoning', () => {
      const response = {
        categoryId: 'cat-1',
        categoryName: 'Groceries',
        confidence: 0.85,
      };

      expect(validateSingleResponse(response)).toBe(false);
    });

    it('rejects invalid alternatives', () => {
      const response = {
        categoryId: 'cat-1',
        categoryName: 'Groceries',
        confidence: 0.85,
        reasoning: 'Test',
        alternatives: 'not an array',
      };

      expect(validateSingleResponse(response)).toBe(false);
    });

    it('rejects alternatives with missing fields', () => {
      const response = {
        categoryId: 'cat-1',
        categoryName: 'Groceries',
        confidence: 0.85,
        reasoning: 'Test',
        alternatives: [{ categoryId: 'cat-2' }], // missing categoryName and confidence
      };

      expect(validateSingleResponse(response)).toBe(false);
    });
  });

  describe('validateBatchResponse', () => {
    it('validates correct batch response', () => {
      const response = [
        {
          index: 0,
          categoryId: 'cat-1',
          categoryName: 'Groceries',
          confidence: 0.85,
          reasoning: 'Test',
        },
        {
          index: 1,
          categoryId: 'cat-2',
          categoryName: 'Shopping',
          confidence: 0.9,
          reasoning: 'Test 2',
        },
      ];

      expect(validateBatchResponse(response)).toBe(true);
    });

    it('validates empty array', () => {
      expect(validateBatchResponse([])).toBe(true);
    });

    it('rejects non-array', () => {
      expect(validateBatchResponse('not array')).toBe(false);
    });

    it('rejects array with invalid items', () => {
      const response = [
        {
          index: 0,
          categoryId: 'cat-1',
          categoryName: 'Groceries',
          confidence: 0.85,
          reasoning: 'Test',
        },
        {
          index: 1,
          categoryId: 'cat-2',
          // missing categoryName
          confidence: 0.9,
          reasoning: 'Test 2',
        },
      ];

      expect(validateBatchResponse(response)).toBe(false);
    });

    it('rejects items missing index', () => {
      const response = [
        {
          categoryId: 'cat-1',
          categoryName: 'Groceries',
          confidence: 0.85,
          reasoning: 'Test',
        },
      ];

      expect(validateBatchResponse(response)).toBe(false);
    });
  });
});
