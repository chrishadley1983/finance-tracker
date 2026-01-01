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

describe('Accounts API', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup chain mocks
    mockSelect.mockReturnValue({ order: mockOrder, eq: mockEq, single: mockSingle });
    mockOrder.mockReturnValue({ data: [], error: null });
    mockEq.mockReturnValue({ single: mockSingle, select: mockSelect });
    mockSingle.mockResolvedValue({ data: null, error: null });
    mockInsert.mockReturnValue({ select: () => ({ single: mockSingle }) });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockDelete.mockReturnValue({ eq: mockEq });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/accounts', () => {
    it('returns a list of accounts', async () => {
      const mockAccounts = [
        { id: '1', name: 'HSBC Current', type: 'current', provider: 'HSBC', is_active: true },
        { id: '2', name: 'Savings', type: 'savings', provider: 'HSBC', is_active: true },
      ];
      mockOrder.mockReturnValue({ data: mockAccounts, error: null });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockAccounts);
      expect(mockFrom).toHaveBeenCalledWith('accounts');
    });

    it('returns 500 on database error', async () => {
      mockOrder.mockReturnValue({ data: null, error: { message: 'Database error' } });

      const response = await GET();
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
      const createdAccount = { id: 'new-id', ...newAccount, is_active: true };

      mockSingle.mockResolvedValue({ data: createdAccount, error: null });

      const request = new NextRequest('http://localhost/api/accounts', {
        method: 'POST',
        body: JSON.stringify(newAccount),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.name).toBe('Test Account');
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
