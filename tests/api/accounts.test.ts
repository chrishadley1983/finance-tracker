import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/accounts/route';
import { GET as GET_BY_ID, PUT, DELETE } from '@/app/api/accounts/[id]/route';

// Mock Supabase
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockOrder = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockOr = vi.fn();
const mockIn = vi.fn();
const mockRpc = vi.fn();
const mockLimit = vi.fn();

const mockFrom = vi.fn().mockReturnValue({
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
  delete: mockDelete,
});

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

describe('Accounts API', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup chain mocks for accounts query (with .or() and double .order())
    mockSelect.mockReturnValue({ order: mockOrder, eq: mockEq, single: mockSingle, in: mockIn });
    mockOrder.mockReturnValue({ order: mockOrder, or: mockOr, limit: mockLimit, data: [], error: null });
    mockOr.mockReturnValue({ data: [], error: null });
    mockEq.mockReturnValue({ single: mockSingle, select: mockSelect });
    mockSingle.mockResolvedValue({ data: null, error: null });
    mockInsert.mockReturnValue({ select: () => ({ single: mockSingle }) });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockDelete.mockReturnValue({ eq: mockEq });
    mockIn.mockReturnValue({ order: mockOrder, data: [], error: null });
    mockLimit.mockReturnValue({ single: mockSingle });

    // Mock RPC calls (for transaction stats)
    mockRpc.mockResolvedValue({ data: [], error: null });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/accounts', () => {
    const createRequest = (url = 'http://localhost:3000/api/accounts') =>
      new NextRequest(url);

    it('returns a list of accounts', async () => {
      const mockAccounts = [
        { id: '1', name: 'HSBC Current', type: 'current', provider: 'HSBC', is_active: true },
        { id: '2', name: 'Savings', type: 'savings', provider: 'HSBC', is_active: true },
      ];
      // Mock the chain: .select().order().order().or() -> returns accounts
      mockOr.mockReturnValue({ data: mockAccounts, error: null });
      // Mock rpc for transaction stats (returns empty - no transactions)
      mockRpc.mockResolvedValue({ data: [], error: null });

      const response = await GET(createRequest());
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.accounts).toBeDefined();
      expect(data.accounts.length).toBe(2);
      expect(mockFrom).toHaveBeenCalledWith('accounts');
    });

    it('returns 500 on database error', async () => {
      mockOr.mockReturnValue({ data: null, error: { message: 'Database error' } });

      const response = await GET(createRequest());
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Database error');
    });
  });

  describe('POST /api/accounts', () => {
    it('creates a new account with valid data', async () => {
      const newAccount = {
        name: 'Test Account',
        type: 'current',
        provider: 'Test Bank',
      };
      const createdAccount = { id: 'new-id', ...newAccount, is_active: true, sort_order: 0 };

      // Mock sequence:
      // 1. Check duplicate name: returns null (no duplicate)
      // 2. Get max sort_order: returns null (no existing accounts)
      // 3. Insert: returns created account
      let callCount = 0;
      mockSingle.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Duplicate check - no existing account with that name
          return Promise.resolve({ data: null, error: { code: 'PGRST116' } });
        } else if (callCount === 2) {
          // Max sort_order - no accounts
          return Promise.resolve({ data: null, error: null });
        } else {
          // Insert result
          return Promise.resolve({ data: createdAccount, error: null });
        }
      });

      const request = new NextRequest('http://localhost/api/accounts', {
        method: 'POST',
        body: JSON.stringify(newAccount),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.account.name).toBe('Test Account');
    });

    it('returns 400 for invalid account type', async () => {
      const invalidAccount = {
        name: 'Test Account',
        type: 'invalid_type',
        provider: 'Test Bank',
      };

      const request = new NextRequest('http://localhost/api/accounts', {
        method: 'POST',
        body: JSON.stringify(invalidAccount),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Validation error');
    });

    it('returns 400 when name is missing', async () => {
      const invalidAccount = {
        type: 'current',
        provider: 'Test Bank',
      };

      const request = new NextRequest('http://localhost/api/accounts', {
        method: 'POST',
        body: JSON.stringify(invalidAccount),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('returns 400 when provider is missing', async () => {
      const invalidAccount = {
        name: 'Test Account',
        type: 'current',
      };

      const request = new NextRequest('http://localhost/api/accounts', {
        method: 'POST',
        body: JSON.stringify(invalidAccount),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/accounts/[id]', () => {
    it('returns a single account by ID', async () => {
      const mockAccount = { id: '123', name: 'HSBC Current', type: 'current', provider: 'HSBC' };
      mockSingle.mockResolvedValue({ data: mockAccount, error: null });

      const request = new NextRequest('http://localhost/api/accounts/123');
      const response = await GET_BY_ID(request, { params: Promise.resolve({ id: '123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe('123');
    });

    it('returns 404 when account not found', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' }
      });

      const request = new NextRequest('http://localhost/api/accounts/nonexistent');
      const response = await GET_BY_ID(request, { params: Promise.resolve({ id: 'nonexistent' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Account not found');
    });
  });

  describe('PUT /api/accounts/[id]', () => {
    it('updates an account with valid data', async () => {
      const updatedAccount = { id: '123', name: 'Updated Name', type: 'current', provider: 'HSBC' };
      mockSingle.mockResolvedValue({ data: updatedAccount, error: null });

      const request = new NextRequest('http://localhost/api/accounts/123', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Updated Name' }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: '123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.name).toBe('Updated Name');
    });

    it('returns 404 when updating non-existent account', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' }
      });

      const request = new NextRequest('http://localhost/api/accounts/nonexistent', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Updated Name' }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: 'nonexistent' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Account not found');
    });

    it('returns 400 for invalid update data', async () => {
      const request = new NextRequest('http://localhost/api/accounts/123', {
        method: 'PUT',
        body: JSON.stringify({ type: 'invalid_type' }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: '123' }) });

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/accounts/[id]', () => {
    it('deletes an account and returns 204', async () => {
      mockEq.mockReturnValue({ error: null });

      const request = new NextRequest('http://localhost/api/accounts/123', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: '123' }) });

      expect(response.status).toBe(204);
    });

    it('returns 500 on database error during delete', async () => {
      mockEq.mockReturnValue({ error: { message: 'Delete failed' } });

      const request = new NextRequest('http://localhost/api/accounts/123', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: '123' }) });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Delete failed');
    });
  });
});
