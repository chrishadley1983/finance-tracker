import { describe, it, expect } from 'vitest';
import {
  accountSchema,
  createAccountSchema,
  updateAccountSchema,
  accountTypeSchema,
} from '@/lib/validations/accounts';
import {
  categorySchema,
  createCategorySchema,
  updateCategorySchema,
} from '@/lib/validations/categories';
import {
  transactionSchema,
  createTransactionSchema,
  updateTransactionSchema,
  transactionQuerySchema,
  categorisationSourceSchema,
} from '@/lib/validations/transactions';
import {
  budgetSchema,
  createBudgetSchema,
  updateBudgetSchema,
  budgetQuerySchema,
} from '@/lib/validations/budgets';

describe('Account Validations', () => {
  describe('accountTypeSchema', () => {
    it('accepts valid account types', () => {
      expect(accountTypeSchema.parse('current')).toBe('current');
      expect(accountTypeSchema.parse('savings')).toBe('savings');
      expect(accountTypeSchema.parse('pension')).toBe('pension');
      expect(accountTypeSchema.parse('isa')).toBe('isa');
      expect(accountTypeSchema.parse('investment')).toBe('investment');
      expect(accountTypeSchema.parse('property')).toBe('property');
    });

    it('rejects invalid account types', () => {
      expect(() => accountTypeSchema.parse('invalid')).toThrow();
      expect(() => accountTypeSchema.parse('')).toThrow();
      expect(() => accountTypeSchema.parse(null)).toThrow();
    });
  });

  describe('createAccountSchema', () => {
    it('validates a valid account', () => {
      const result = createAccountSchema.parse({
        name: 'Test Account',
        type: 'current',
        provider: 'Test Bank',
      });
      expect(result.name).toBe('Test Account');
      expect(result.type).toBe('current');
      expect(result.provider).toBe('Test Bank');
      expect(result.is_active).toBe(true); // default
    });

    it('applies default values', () => {
      const result = createAccountSchema.parse({
        name: 'Test Account',
        type: 'savings',
        provider: 'Test Bank',
      });
      expect(result.is_active).toBe(true);
    });

    it('allows optional hsbc_account_id', () => {
      const result = createAccountSchema.parse({
        name: 'Test Account',
        type: 'current',
        provider: 'Test Bank',
        hsbc_account_id: 'hsbc123',
      });
      expect(result.hsbc_account_id).toBe('hsbc123');
    });

    it('rejects empty name', () => {
      expect(() =>
        createAccountSchema.parse({
          name: '',
          type: 'current',
          provider: 'Test Bank',
        })
      ).toThrow();
    });

    it('rejects name exceeding max length', () => {
      expect(() =>
        createAccountSchema.parse({
          name: 'a'.repeat(256),
          type: 'current',
          provider: 'Test Bank',
        })
      ).toThrow();
    });
  });

  describe('updateAccountSchema', () => {
    it('allows partial updates', () => {
      const result = updateAccountSchema.parse({ name: 'New Name' });
      expect(result.name).toBe('New Name');
      expect(result.type).toBeUndefined();
    });

    it('allows empty object', () => {
      const result = updateAccountSchema.parse({});
      expect(result).toEqual({});
    });
  });
});

describe('Category Validations', () => {
  describe('createCategorySchema', () => {
    it('validates a valid category', () => {
      const result = createCategorySchema.parse({
        name: 'Groceries',
        group_name: 'Food & Drink',
      });
      expect(result.name).toBe('Groceries');
      expect(result.group_name).toBe('Food & Drink');
      expect(result.is_income).toBe(false); // default
      expect(result.display_order).toBe(0); // default
    });

    it('accepts income categories', () => {
      const result = createCategorySchema.parse({
        name: 'Salary',
        group_name: 'Income',
        is_income: true,
      });
      expect(result.is_income).toBe(true);
    });

    it('rejects empty name', () => {
      expect(() =>
        createCategorySchema.parse({
          name: '',
          group_name: 'Test',
        })
      ).toThrow();
    });
  });

  describe('updateCategorySchema', () => {
    it('allows partial updates', () => {
      const result = updateCategorySchema.parse({ name: 'New Category' });
      expect(result.name).toBe('New Category');
      expect(result.group_name).toBeUndefined();
    });

    it('validates display_order is non-negative', () => {
      expect(() =>
        updateCategorySchema.parse({ display_order: -1 })
      ).toThrow();
    });
  });
});

describe('Transaction Validations', () => {
  describe('categorisationSourceSchema', () => {
    it('accepts valid sources', () => {
      expect(categorisationSourceSchema.parse('manual')).toBe('manual');
      expect(categorisationSourceSchema.parse('rule')).toBe('rule');
      expect(categorisationSourceSchema.parse('ai')).toBe('ai');
      expect(categorisationSourceSchema.parse('import')).toBe('import');
    });

    it('rejects invalid sources', () => {
      expect(() => categorisationSourceSchema.parse('invalid')).toThrow();
    });
  });

  describe('createTransactionSchema', () => {
    const validUuid = '550e8400-e29b-41d4-a716-446655440000';

    it('validates a valid transaction', () => {
      const result = createTransactionSchema.parse({
        date: '2024-01-15',
        amount: -50.00,
        description: 'Test transaction',
        account_id: validUuid,
      });
      expect(result.date).toBe('2024-01-15');
      expect(result.amount).toBe(-50.00);
      expect(result.description).toBe('Test transaction');
      expect(result.categorisation_source).toBe('manual'); // default
    });

    it('accepts valid date format', () => {
      const result = createTransactionSchema.parse({
        date: '2024-12-31',
        amount: 100,
        description: 'Test',
        account_id: validUuid,
      });
      expect(result.date).toBe('2024-12-31');
    });

    it('rejects invalid date format', () => {
      expect(() =>
        createTransactionSchema.parse({
          date: '2024/01/15',
          amount: 50,
          description: 'Test',
          account_id: validUuid,
        })
      ).toThrow();
    });

    it('rejects invalid date format (MM-DD-YYYY)', () => {
      expect(() =>
        createTransactionSchema.parse({
          date: '01-15-2024',
          amount: 50,
          description: 'Test',
          account_id: validUuid,
        })
      ).toThrow();
    });

    it('allows negative amounts (expenses)', () => {
      const result = createTransactionSchema.parse({
        date: '2024-01-15',
        amount: -100.50,
        description: 'Expense',
        account_id: validUuid,
      });
      expect(result.amount).toBe(-100.50);
    });

    it('allows positive amounts (income)', () => {
      const result = createTransactionSchema.parse({
        date: '2024-01-15',
        amount: 5000,
        description: 'Salary',
        account_id: validUuid,
      });
      expect(result.amount).toBe(5000);
    });

    it('rejects empty description', () => {
      expect(() =>
        createTransactionSchema.parse({
          date: '2024-01-15',
          amount: 50,
          description: '',
          account_id: validUuid,
        })
      ).toThrow();
    });

    it('rejects invalid account_id UUID', () => {
      expect(() =>
        createTransactionSchema.parse({
          date: '2024-01-15',
          amount: 50,
          description: 'Test',
          account_id: 'not-a-uuid',
        })
      ).toThrow();
    });
  });

  describe('transactionQuerySchema', () => {
    it('validates valid query params', () => {
      const result = transactionQuerySchema.parse({
        start_date: '2024-01-01',
        end_date: '2024-12-31',
        limit: 50,
        offset: 0,
      });
      expect(result.start_date).toBe('2024-01-01');
      expect(result.limit).toBe(50);
    });

    it('applies default limit', () => {
      const result = transactionQuerySchema.parse({});
      expect(result.limit).toBe(100);
      expect(result.offset).toBe(0);
    });

    it('coerces string numbers', () => {
      const result = transactionQuerySchema.parse({
        limit: '50' as unknown as number,
        offset: '10' as unknown as number,
      });
      expect(result.limit).toBe(50);
      expect(result.offset).toBe(10);
    });

    it('rejects limit exceeding max', () => {
      expect(() =>
        transactionQuerySchema.parse({ limit: 1001 })
      ).toThrow();
    });

    it('rejects negative offset', () => {
      expect(() =>
        transactionQuerySchema.parse({ offset: -1 })
      ).toThrow();
    });
  });
});

describe('Budget Validations', () => {
  describe('createBudgetSchema', () => {
    const validUuid = '550e8400-e29b-41d4-a716-446655440000';

    it('validates a valid budget', () => {
      const result = createBudgetSchema.parse({
        category_id: validUuid,
        year: 2024,
        month: 6,
        amount: 500,
      });
      expect(result.year).toBe(2024);
      expect(result.month).toBe(6);
      expect(result.amount).toBe(500);
    });

    it('rejects year below minimum', () => {
      expect(() =>
        createBudgetSchema.parse({
          category_id: validUuid,
          year: 1999,
          month: 1,
          amount: 100,
        })
      ).toThrow();
    });

    it('rejects year above maximum', () => {
      expect(() =>
        createBudgetSchema.parse({
          category_id: validUuid,
          year: 2101,
          month: 1,
          amount: 100,
        })
      ).toThrow();
    });

    it('rejects month below 1', () => {
      expect(() =>
        createBudgetSchema.parse({
          category_id: validUuid,
          year: 2024,
          month: 0,
          amount: 100,
        })
      ).toThrow();
    });

    it('rejects month above 12', () => {
      expect(() =>
        createBudgetSchema.parse({
          category_id: validUuid,
          year: 2024,
          month: 13,
          amount: 100,
        })
      ).toThrow();
    });

    it('rejects negative amount', () => {
      expect(() =>
        createBudgetSchema.parse({
          category_id: validUuid,
          year: 2024,
          month: 6,
          amount: -100,
        })
      ).toThrow();
    });

    it('allows zero amount', () => {
      const result = createBudgetSchema.parse({
        category_id: validUuid,
        year: 2024,
        month: 6,
        amount: 0,
      });
      expect(result.amount).toBe(0);
    });
  });

  describe('budgetQuerySchema', () => {
    it('validates valid query params', () => {
      const result = budgetQuerySchema.parse({
        year: 2024,
        month: 6,
      });
      expect(result.year).toBe(2024);
      expect(result.month).toBe(6);
    });

    it('allows empty query', () => {
      const result = budgetQuerySchema.parse({});
      expect(result.year).toBeUndefined();
      expect(result.month).toBeUndefined();
    });

    it('coerces string numbers', () => {
      const result = budgetQuerySchema.parse({
        year: '2024' as unknown as number,
        month: '6' as unknown as number,
      });
      expect(result.year).toBe(2024);
      expect(result.month).toBe(6);
    });
  });
});
