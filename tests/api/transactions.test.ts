import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/transactions/route';
import { GET as GET_BY_ID, PUT, DELETE } from '@/app/api/transactions/[id]/route';

// Valid UUIDs for testing
const TEST_ACCOUNT_ID = '550e8400-e29b-41d4-a716-446655440001';
const TEST_CATEGORY_ID = '550e8400-e29b-41d4-a716-446655440002';
const TEST_TRANSACTION_ID = '550e8400-e29b-41d4-a716-446655440003';
const NEW_CATEGORY_ID = '550e8400-e29b-41d4-a716-446655440004';

// Mock Supabase
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockOrder = vi.fn();
const mockEq = vi.fn();
const mockGte = vi.fn();
const mockLte = vi.fn();
const mockRange = vi.fn();
const mockSingle = vi.fn();

const mockFrom = vi.fn().mockReturnValue({
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
  delete: mockDelete,
});

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

describe('Transactions API', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup chain mocks with proper chaining
    const chainMock = {
      order: mockOrder,
      eq: mockEq,
      gte: mockGte,
      lte: mockLte,
      range: mockRange,
      single: mockSingle,
      select: mockSelect,
    };

    mockSelect.mockReturnValue(chainMock);
    mockOrder.mockReturnValue(chainMock);
    mockEq.mockReturnValue(chainMock);
    mockGte.mockReturnValue(chainMock);
    mockLte.mockReturnValue(chainMock);
    mockRange.mockResolvedValue({ data: [], error: null });
    mockSingle.mockResolvedValue({ data: null, error: null });
    mockInsert.mockReturnValue({ select: () => ({ single: mockSingle }) });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockDelete.mockReturnValue({ eq: mockEq });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/transactions', () => {
    it('returns a list of transactions', async () => {
      const mockTransactions = [
        {
          id: TEST_TRANSACTION_ID,
          date: '2025-01-01',
          amount: -50.00,
          description: 'Groceries',
          account_id: TEST_ACCOUNT_ID,
          category_id: TEST_CATEGORY_ID,
          account: { name: 'HSBC Current' },
          category: { name: 'Groceries', group_name: 'Food' },
        },
      ];
      mockRange.mockResolvedValue({ data: mockTransactions, error: null });

      const request = new NextRequest('http://localhost/api/transactions');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockTransactions);
      expect(mockFrom).toHaveBeenCalledWith('transactions');
    });

    it('filters transactions by account_id', async () => {
      mockRange.mockResolvedValue({ data: [], error: null });

      const request = new NextRequest(`http://localhost/api/transactions?account_id=${TEST_ACCOUNT_ID}`);
      await GET(request);

      expect(mockEq).toHaveBeenCalledWith('account_id', TEST_ACCOUNT_ID);
    });

    it('filters transactions by category_id', async () => {
      mockRange.mockResolvedValue({ data: [], error: null });

      const request = new NextRequest(`http://localhost/api/transactions?category_id=${TEST_CATEGORY_ID}`);
      await GET(request);

      expect(mockEq).toHaveBeenCalledWith('category_id', TEST_CATEGORY_ID);
    });

    it('filters transactions by date range', async () => {
      mockRange.mockResolvedValue({ data: [], error: null });

      const request = new NextRequest('http://localhost/api/transactions?start_date=2025-01-01&end_date=2025-01-31');
      await GET(request);

      expect(mockGte).toHaveBeenCalledWith('date', '2025-01-01');
      expect(mockLte).toHaveBeenCalledWith('date', '2025-01-31');
    });

    it('applies pagination with limit and offset', async () => {
      mockRange.mockResolvedValue({ data: [], error: null });

      const request = new NextRequest('http://localhost/api/transactions?limit=50&offset=100');
      await GET(request);

      expect(mockRange).toHaveBeenCalledWith(100, 149);
    });

    it('uses default pagination when not specified', async () => {
      mockRange.mockResolvedValue({ data: [], error: null });

      const request = new NextRequest('http://localhost/api/transactions');
      await GET(request);

      expect(mockRange).toHaveBeenCalledWith(0, 99); // Default limit 100, offset 0
    });

    it('returns 500 on database error', async () => {
      mockRange.mockResolvedValue({ data: null, error: { message: 'Database error' } });

      const request = new NextRequest('http://localhost/api/transactions');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Database error');
    });

    it('returns 400 for invalid date format in start_date', async () => {
      const request = new NextRequest('http://localhost/api/transactions?start_date=invalid-date');
      const response = await GET(request);

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/transactions', () => {
    it('creates a new transaction with valid data', async () => {
      const newTransaction = {
        date: '2025-01-15',
        amount: -25.50,
        description: 'Coffee shop',
        account_id: TEST_ACCOUNT_ID,
        category_id: TEST_CATEGORY_ID,
      };
      const createdTransaction = { id: TEST_TRANSACTION_ID, ...newTransaction, categorisation_source: 'manual' };

      mockSingle.mockResolvedValue({ data: createdTransaction, error: null });

      const request = new NextRequest('http://localhost/api/transactions', {
        method: 'POST',
        body: JSON.stringify(newTransaction),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.amount).toBe(-25.50);
      expect(data.description).toBe('Coffee shop');
    });

    it('creates a transaction without category_id', async () => {
      const newTransaction = {
        date: '2025-01-15',
        amount: -25.50,
        description: 'Uncategorized expense',
        account_id: TEST_ACCOUNT_ID,
      };
      const createdTransaction = { id: TEST_TRANSACTION_ID, ...newTransaction, category_id: null, categorisation_source: 'manual' };

      mockSingle.mockResolvedValue({ data: createdTransaction, error: null });

      const request = new NextRequest('http://localhost/api/transactions', {
        method: 'POST',
        body: JSON.stringify(newTransaction),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.category_id).toBeNull();
    });

    it('returns 400 when date is missing', async () => {
      const invalidTransaction = {
        amount: -25.50,
        description: 'Coffee shop',
        account_id: TEST_ACCOUNT_ID,
      };

      const request = new NextRequest('http://localhost/api/transactions', {
        method: 'POST',
        body: JSON.stringify(invalidTransaction),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('returns 400 when account_id is missing', async () => {
      const invalidTransaction = {
        date: '2025-01-15',
        amount: -25.50,
        description: 'Coffee shop',
      };

      const request = new NextRequest('http://localhost/api/transactions', {
        method: 'POST',
        body: JSON.stringify(invalidTransaction),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('returns 400 for invalid date format', async () => {
      const invalidTransaction = {
        date: '15-01-2025', // Wrong format
        amount: -25.50,
        description: 'Coffee shop',
        account_id: TEST_ACCOUNT_ID,
      };

      const request = new NextRequest('http://localhost/api/transactions', {
        method: 'POST',
        body: JSON.stringify(invalidTransaction),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('returns 400 when description is empty', async () => {
      const invalidTransaction = {
        date: '2025-01-15',
        amount: -25.50,
        description: '',
        account_id: TEST_ACCOUNT_ID,
      };

      const request = new NextRequest('http://localhost/api/transactions', {
        method: 'POST',
        body: JSON.stringify(invalidTransaction),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/transactions/[id]', () => {
    it('returns a single transaction by ID', async () => {
      const mockTransaction = {
        id: TEST_TRANSACTION_ID,
        date: '2025-01-15',
        amount: -25.50,
        description: 'Coffee shop',
        account: { name: 'HSBC Current' },
        category: { name: 'Coffee', group_name: 'Food' },
      };
      mockSingle.mockResolvedValue({ data: mockTransaction, error: null });

      const request = new NextRequest(`http://localhost/api/transactions/${TEST_TRANSACTION_ID}`);
      const response = await GET_BY_ID(request, { params: Promise.resolve({ id: TEST_TRANSACTION_ID }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe(TEST_TRANSACTION_ID);
    });

    it('returns 404 when transaction not found', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' }
      });

      const request = new NextRequest('http://localhost/api/transactions/nonexistent');
      const response = await GET_BY_ID(request, { params: Promise.resolve({ id: 'nonexistent' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Transaction not found');
    });
  });

  describe('PUT /api/transactions/[id]', () => {
    it('updates transaction amount', async () => {
      const updatedTransaction = { id: TEST_TRANSACTION_ID, date: '2025-01-15', amount: -30.00, description: 'Coffee shop' };
      mockSingle.mockResolvedValue({ data: updatedTransaction, error: null });

      const request = new NextRequest(`http://localhost/api/transactions/${TEST_TRANSACTION_ID}`, {
        method: 'PUT',
        body: JSON.stringify({ amount: -30.00 }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: TEST_TRANSACTION_ID }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.amount).toBe(-30.00);
    });

    it('updates transaction category', async () => {
      const updatedTransaction = { id: TEST_TRANSACTION_ID, category_id: NEW_CATEGORY_ID };
      mockSingle.mockResolvedValue({ data: updatedTransaction, error: null });

      const request = new NextRequest(`http://localhost/api/transactions/${TEST_TRANSACTION_ID}`, {
        method: 'PUT',
        body: JSON.stringify({ category_id: NEW_CATEGORY_ID }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: TEST_TRANSACTION_ID }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.category_id).toBe(NEW_CATEGORY_ID);
    });

    it('returns 404 when updating non-existent transaction', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' }
      });

      const request = new NextRequest('http://localhost/api/transactions/nonexistent', {
        method: 'PUT',
        body: JSON.stringify({ amount: -30.00 }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: 'nonexistent' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Transaction not found');
    });

    it('returns 400 for invalid date format in update', async () => {
      const request = new NextRequest('http://localhost/api/transactions/123', {
        method: 'PUT',
        body: JSON.stringify({ date: 'invalid-date' }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: '123' }) });

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/transactions/[id]', () => {
    it('deletes a transaction and returns 204', async () => {
      mockEq.mockReturnValue({ error: null });

      const request = new NextRequest('http://localhost/api/transactions/123', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: '123' }) });

      expect(response.status).toBe(204);
    });

    it('returns 500 on database error during delete', async () => {
      mockEq.mockReturnValue({ error: { message: 'Delete failed' } });

      const request = new NextRequest('http://localhost/api/transactions/123', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: '123' }) });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Delete failed');
    });
  });
});
