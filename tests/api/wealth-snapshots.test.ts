import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/wealth-snapshots/route';
import { GET as GET_BY_ID, PUT, DELETE } from '@/app/api/wealth-snapshots/[id]/route';

// Valid UUIDs for testing
const TEST_SNAPSHOT_ID = '550e8400-e29b-41d4-a716-446655440020';
const TEST_ACCOUNT_ID = '550e8400-e29b-41d4-a716-446655440021';
const NEW_ACCOUNT_ID = '550e8400-e29b-41d4-a716-446655440022';

// Mock Supabase
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockOrder = vi.fn();
const mockEq = vi.fn();
const mockGte = vi.fn();
const mockLte = vi.fn();
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
  mockGte: MockFn;
  mockLte: MockFn;
  mockSingle: MockFn;
  mockSelect: MockFn;
}, resolveData: { data: unknown; error: unknown } = { data: [], error: null }) => {
  const chain: Record<string, unknown> = {};
  chain.order = (...args: unknown[]) => { mocks.mockOrder(...args); return chain; };
  chain.eq = (...args: unknown[]) => { mocks.mockEq(...args); return chain; };
  chain.gte = (...args: unknown[]) => { mocks.mockGte(...args); return chain; };
  chain.lte = (...args: unknown[]) => { mocks.mockLte(...args); return chain; };
  chain.single = mocks.mockSingle;
  chain.select = (...args: unknown[]) => { mocks.mockSelect(...args); return chain; };
  chain.then = (resolve: (value: { data: unknown; error: unknown }) => void) => {
    resolve(resolveData);
  };
  return chain;
};

describe('Wealth Snapshots API', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const thenableChain = createThenableChain({ mockOrder, mockEq, mockGte, mockLte, mockSingle, mockSelect });
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
    vi.restoreAllMocks();
  });

  describe('GET /api/wealth-snapshots', () => {
    it('returns a list of wealth snapshots', async () => {
      const mockSnapshots = [
        {
          id: TEST_SNAPSHOT_ID,
          account_id: TEST_ACCOUNT_ID,
          date: '2025-01-01',
          balance: 50000.00,
          notes: 'End of month snapshot',
          account: { name: 'HSBC Current', type: 'current' },
        },
      ];
      // Create chain that resolves to mockSnapshots
      const successChain = createThenableChain(
        { mockOrder, mockEq, mockGte, mockLte, mockSingle, mockSelect },
        { data: mockSnapshots, error: null }
      );
      mockSelect.mockReturnValue(successChain);

      const request = new NextRequest('http://localhost/api/wealth-snapshots');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockSnapshots);
      expect(mockFrom).toHaveBeenCalledWith('wealth_snapshots');
    });

    it('filters snapshots by account_id', async () => {
      const request = new NextRequest(`http://localhost/api/wealth-snapshots?account_id=${TEST_ACCOUNT_ID}`);
      await GET(request);

      expect(mockEq).toHaveBeenCalledWith('account_id', TEST_ACCOUNT_ID);
    });

    it('filters snapshots by date range', async () => {
      const request = new NextRequest('http://localhost/api/wealth-snapshots?start_date=2025-01-01&end_date=2025-12-31');
      await GET(request);

      expect(mockGte).toHaveBeenCalledWith('date', '2025-01-01');
      expect(mockLte).toHaveBeenCalledWith('date', '2025-12-31');
    });

    it('returns 500 on database error', async () => {
      // Create chain that resolves to error
      const errorChain = createThenableChain(
        { mockOrder, mockEq, mockGte, mockLte, mockSingle, mockSelect },
        { data: null, error: { message: 'Database error' } }
      );
      mockSelect.mockReturnValue(errorChain);

      const request = new NextRequest('http://localhost/api/wealth-snapshots');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Database error');
    });

    it('returns 400 for invalid date format in start_date', async () => {
      const request = new NextRequest('http://localhost/api/wealth-snapshots?start_date=invalid-date');
      const response = await GET(request);

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/wealth-snapshots', () => {
    it('creates a new wealth snapshot with valid data', async () => {
      const newSnapshot = {
        account_id: TEST_ACCOUNT_ID,
        date: '2025-01-15',
        balance: 52000.00,
        notes: 'Mid-month check',
      };
      const createdSnapshot = { id: TEST_SNAPSHOT_ID, ...newSnapshot };

      mockSingle.mockResolvedValue({ data: createdSnapshot, error: null });

      const request = new NextRequest('http://localhost/api/wealth-snapshots', {
        method: 'POST',
        body: JSON.stringify(newSnapshot),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.balance).toBe(52000.00);
      expect(data.date).toBe('2025-01-15');
    });

    it('creates a snapshot without notes', async () => {
      const newSnapshot = {
        account_id: TEST_ACCOUNT_ID,
        date: '2025-01-15',
        balance: 52000.00,
      };
      const createdSnapshot = { id: TEST_SNAPSHOT_ID, ...newSnapshot, notes: null };

      mockSingle.mockResolvedValue({ data: createdSnapshot, error: null });

      const request = new NextRequest('http://localhost/api/wealth-snapshots', {
        method: 'POST',
        body: JSON.stringify(newSnapshot),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.notes).toBeNull();
    });

    it('returns 400 when account_id is missing', async () => {
      const invalidSnapshot = {
        date: '2025-01-15',
        balance: 52000.00,
      };

      const request = new NextRequest('http://localhost/api/wealth-snapshots', {
        method: 'POST',
        body: JSON.stringify(invalidSnapshot),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('returns 400 when date is missing', async () => {
      const invalidSnapshot = {
        account_id: TEST_ACCOUNT_ID,
        balance: 52000.00,
      };

      const request = new NextRequest('http://localhost/api/wealth-snapshots', {
        method: 'POST',
        body: JSON.stringify(invalidSnapshot),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('returns 400 for invalid date format', async () => {
      const invalidSnapshot = {
        account_id: TEST_ACCOUNT_ID,
        date: '15-01-2025', // Wrong format
        balance: 52000.00,
      };

      const request = new NextRequest('http://localhost/api/wealth-snapshots', {
        method: 'POST',
        body: JSON.stringify(invalidSnapshot),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/wealth-snapshots/[id]', () => {
    it('returns a single snapshot by ID', async () => {
      const mockSnapshot = {
        id: TEST_SNAPSHOT_ID,
        account_id: TEST_ACCOUNT_ID,
        date: '2025-01-01',
        balance: 50000.00,
        account: { name: 'HSBC Current', type: 'current' },
      };
      mockSingle.mockResolvedValue({ data: mockSnapshot, error: null });

      const request = new NextRequest(`http://localhost/api/wealth-snapshots/${TEST_SNAPSHOT_ID}`);
      const response = await GET_BY_ID(request, { params: Promise.resolve({ id: TEST_SNAPSHOT_ID }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe(TEST_SNAPSHOT_ID);
    });

    it('returns 404 when snapshot not found', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' }
      });

      const request = new NextRequest('http://localhost/api/wealth-snapshots/nonexistent');
      const response = await GET_BY_ID(request, { params: Promise.resolve({ id: 'nonexistent' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Wealth snapshot not found');
    });
  });

  describe('PUT /api/wealth-snapshots/[id]', () => {
    it('updates snapshot balance', async () => {
      const updatedSnapshot = { id: TEST_SNAPSHOT_ID, balance: 55000.00 };
      mockSingle.mockResolvedValue({ data: updatedSnapshot, error: null });

      const request = new NextRequest(`http://localhost/api/wealth-snapshots/${TEST_SNAPSHOT_ID}`, {
        method: 'PUT',
        body: JSON.stringify({ balance: 55000.00 }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: TEST_SNAPSHOT_ID }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.balance).toBe(55000.00);
    });

    it('updates snapshot account', async () => {
      const updatedSnapshot = { id: TEST_SNAPSHOT_ID, account_id: NEW_ACCOUNT_ID };
      mockSingle.mockResolvedValue({ data: updatedSnapshot, error: null });

      const request = new NextRequest(`http://localhost/api/wealth-snapshots/${TEST_SNAPSHOT_ID}`, {
        method: 'PUT',
        body: JSON.stringify({ account_id: NEW_ACCOUNT_ID }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: TEST_SNAPSHOT_ID }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.account_id).toBe(NEW_ACCOUNT_ID);
    });

    it('returns 404 when updating non-existent snapshot', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' }
      });

      const request = new NextRequest('http://localhost/api/wealth-snapshots/nonexistent', {
        method: 'PUT',
        body: JSON.stringify({ balance: 55000.00 }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: 'nonexistent' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Wealth snapshot not found');
    });

    it('returns 400 for invalid date format in update', async () => {
      const request = new NextRequest(`http://localhost/api/wealth-snapshots/${TEST_SNAPSHOT_ID}`, {
        method: 'PUT',
        body: JSON.stringify({ date: 'invalid-date' }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: TEST_SNAPSHOT_ID }) });

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/wealth-snapshots/[id]', () => {
    it('deletes a snapshot and returns 204', async () => {
      mockEq.mockReturnValue({ error: null });

      const request = new NextRequest('http://localhost/api/wealth-snapshots/123', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: '123' }) });

      expect(response.status).toBe(204);
    });

    it('returns 500 on database error during delete', async () => {
      mockEq.mockReturnValue({ error: { message: 'Delete failed' } });

      const request = new NextRequest('http://localhost/api/wealth-snapshots/123', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: '123' }) });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Delete failed');
    });
  });
});
