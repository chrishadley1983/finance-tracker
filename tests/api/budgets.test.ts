import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/budgets/route';
import { GET as GET_BY_ID, PUT, DELETE } from '@/app/api/budgets/[id]/route';

// Valid UUIDs for testing
const TEST_BUDGET_ID = '550e8400-e29b-41d4-a716-446655440010';
const TEST_CATEGORY_ID = '550e8400-e29b-41d4-a716-446655440011';
const NEW_CATEGORY_ID = '550e8400-e29b-41d4-a716-446655440012';

// Mock Supabase
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockOrder = vi.fn();
const mockEq = vi.fn();
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MockFn = ReturnType<typeof vi.fn<(...args: any[]) => any>>;

// Helper to create thenable chain mock
const createThenableChain = (mocks: {
  mockOrder: MockFn;
  mockEq: MockFn;
  mockSingle: MockFn;
  mockSelect: MockFn;
}, resolveData: { data: unknown; error: unknown } = { data: [], error: null }) => {
  const chain: Record<string, unknown> = {};
  chain.order = (...args: unknown[]) => { mocks.mockOrder(...args); return chain; };
  chain.eq = (...args: unknown[]) => { mocks.mockEq(...args); return chain; };
  chain.single = mocks.mockSingle;
  chain.select = (...args: unknown[]) => { mocks.mockSelect(...args); return chain; };
  chain.then = (resolve: (value: { data: unknown; error: unknown }) => void) => {
    resolve(resolveData);
  };
  return chain;
};

describe('Budgets API', () => {
  let thenableChain: ReturnType<typeof createThenableChain>;

  beforeEach(() => {
    vi.clearAllMocks();

    thenableChain = createThenableChain({ mockOrder, mockEq, mockSingle, mockSelect });
    mockSelect.mockReturnValue(thenableChain);
    mockSingle.mockResolvedValue({ data: null, error: null });
    mockInsert.mockReturnValue({ select: () => ({ single: mockSingle }) });
    // Update chain: .update().eq().select().single()
    mockUpdate.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: mockSingle
        })
      })
    });
    mockDelete.mockReturnValue({ eq: mockEq });
  });

  afterEach(() => {
    // Don't use restoreAllMocks() as it would restore the module mock
  });

  describe('GET /api/budgets', () => {
    it('returns a list of budgets', async () => {
      const mockBudgets = [
        {
          id: TEST_BUDGET_ID,
          category_id: TEST_CATEGORY_ID,
          year: 2025,
          month: 1,
          amount: 500.00,
          category: { name: 'Groceries', group_name: 'Food' },
        },
      ];
      // Create chain that resolves to mockBudgets
      const successChain = createThenableChain(
        { mockOrder, mockEq, mockSingle, mockSelect },
        { data: mockBudgets, error: null }
      );
      mockSelect.mockReturnValue(successChain);

      const request = new NextRequest('http://localhost/api/budgets');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockBudgets);
      expect(mockFrom).toHaveBeenCalledWith('budgets');
    });

    it('filters budgets by year', async () => {
      const request = new NextRequest('http://localhost/api/budgets?year=2025');
      await GET(request);

      expect(mockEq).toHaveBeenCalledWith('year', 2025);
    });

    it('filters budgets by month', async () => {
      const request = new NextRequest('http://localhost/api/budgets?month=6');
      await GET(request);

      expect(mockEq).toHaveBeenCalledWith('month', 6);
    });

    it('filters budgets by category_id', async () => {
      const request = new NextRequest(`http://localhost/api/budgets?category_id=${TEST_CATEGORY_ID}`);
      await GET(request);

      expect(mockEq).toHaveBeenCalledWith('category_id', TEST_CATEGORY_ID);
    });

    it('returns 500 on database error', async () => {
      // Create chain that resolves to error
      const errorChain = createThenableChain(
        { mockOrder, mockEq, mockSingle, mockSelect },
        { data: null, error: { message: 'Database error' } }
      );
      mockSelect.mockReturnValue(errorChain);

      const request = new NextRequest('http://localhost/api/budgets');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Database error');
    });

    it('returns 400 for invalid year', async () => {
      const request = new NextRequest('http://localhost/api/budgets?year=1999');
      const response = await GET(request);

      expect(response.status).toBe(400);
    });

    it('returns 400 for invalid month', async () => {
      const request = new NextRequest('http://localhost/api/budgets?month=13');
      const response = await GET(request);

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/budgets', () => {
    it('creates a new budget with valid data', async () => {
      const newBudget = {
        category_id: TEST_CATEGORY_ID,
        year: 2025,
        month: 3,
        amount: 750.00,
      };
      const createdBudget = { id: TEST_BUDGET_ID, ...newBudget };

      mockSingle.mockResolvedValue({ data: createdBudget, error: null });

      const request = new NextRequest('http://localhost/api/budgets', {
        method: 'POST',
        body: JSON.stringify(newBudget),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.amount).toBe(750.00);
      expect(data.year).toBe(2025);
    });

    it('returns 400 when category_id is missing', async () => {
      const invalidBudget = {
        year: 2025,
        month: 3,
        amount: 750.00,
      };

      const request = new NextRequest('http://localhost/api/budgets', {
        method: 'POST',
        body: JSON.stringify(invalidBudget),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('returns 400 when year is missing', async () => {
      const invalidBudget = {
        category_id: TEST_CATEGORY_ID,
        month: 3,
        amount: 750.00,
      };

      const request = new NextRequest('http://localhost/api/budgets', {
        method: 'POST',
        body: JSON.stringify(invalidBudget),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('returns 400 for negative amount', async () => {
      const invalidBudget = {
        category_id: TEST_CATEGORY_ID,
        year: 2025,
        month: 3,
        amount: -100,
      };

      const request = new NextRequest('http://localhost/api/budgets', {
        method: 'POST',
        body: JSON.stringify(invalidBudget),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/budgets/[id]', () => {
    it('returns a single budget by ID', async () => {
      const mockBudget = {
        id: TEST_BUDGET_ID,
        category_id: TEST_CATEGORY_ID,
        year: 2025,
        month: 1,
        amount: 500.00,
        category: { name: 'Groceries', group_name: 'Food' },
      };
      mockSingle.mockResolvedValue({ data: mockBudget, error: null });

      const request = new NextRequest(`http://localhost/api/budgets/${TEST_BUDGET_ID}`);
      const response = await GET_BY_ID(request, { params: Promise.resolve({ id: TEST_BUDGET_ID }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe(TEST_BUDGET_ID);
    });

    it('returns 404 when budget not found', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' }
      });

      const request = new NextRequest('http://localhost/api/budgets/nonexistent');
      const response = await GET_BY_ID(request, { params: Promise.resolve({ id: 'nonexistent' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Budget not found');
    });
  });

  describe('PUT /api/budgets/[id]', () => {
    it('updates budget amount', async () => {
      const updatedBudget = { id: TEST_BUDGET_ID, amount: 800.00 };
      mockSingle.mockResolvedValue({ data: updatedBudget, error: null });

      const request = new NextRequest(`http://localhost/api/budgets/${TEST_BUDGET_ID}`, {
        method: 'PUT',
        body: JSON.stringify({ amount: 800.00 }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: TEST_BUDGET_ID }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.amount).toBe(800.00);
    });

    it('updates budget category', async () => {
      const updatedBudget = { id: TEST_BUDGET_ID, category_id: NEW_CATEGORY_ID };
      mockSingle.mockResolvedValue({ data: updatedBudget, error: null });

      const request = new NextRequest(`http://localhost/api/budgets/${TEST_BUDGET_ID}`, {
        method: 'PUT',
        body: JSON.stringify({ category_id: NEW_CATEGORY_ID }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: TEST_BUDGET_ID }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.category_id).toBe(NEW_CATEGORY_ID);
    });

    it('returns 404 when updating non-existent budget', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' }
      });

      const request = new NextRequest('http://localhost/api/budgets/nonexistent', {
        method: 'PUT',
        body: JSON.stringify({ amount: 800.00 }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: 'nonexistent' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Budget not found');
    });
  });

  describe('DELETE /api/budgets/[id]', () => {
    it('deletes a budget and returns 204', async () => {
      mockEq.mockReturnValue({ error: null });

      const request = new NextRequest('http://localhost/api/budgets/123', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: '123' }) });

      expect(response.status).toBe(204);
    });

    it('returns 500 on database error during delete', async () => {
      mockEq.mockReturnValue({ error: { message: 'Delete failed' } });

      const request = new NextRequest('http://localhost/api/budgets/123', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: '123' }) });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Delete failed');
    });
  });
});
