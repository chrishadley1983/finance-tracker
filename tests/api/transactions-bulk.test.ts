import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { PUT, DELETE } from '@/app/api/transactions/bulk/route';

// Valid UUIDs for testing
const UUID_1 = '11111111-1111-1111-1111-111111111111';
const UUID_2 = '22222222-2222-2222-2222-222222222222';
const UUID_3 = '33333333-3333-3333-3333-333333333333';
const CAT_UUID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

// Mock Supabase
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockIn = vi.fn();
const mockSelect = vi.fn();

const mockFrom = vi.fn().mockReturnValue({
  update: mockUpdate,
  delete: mockDelete,
});

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

describe('Transactions Bulk API', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup chain mocks
    mockUpdate.mockReturnValue({ in: mockIn });
    mockDelete.mockReturnValue({ in: mockIn });
    mockIn.mockReturnValue({ select: mockSelect, error: null });
    mockSelect.mockResolvedValue({ data: [], error: null });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('PUT /api/transactions/bulk', () => {
    it('updates multiple transactions with category_id', async () => {
      const updateData = {
        ids: [UUID_1, UUID_2, UUID_3],
        update: {
          category_id: CAT_UUID,
        },
      };

      mockIn.mockReturnValue({
        select: () => ({
          data: [{ id: UUID_1 }, { id: UUID_2 }, { id: UUID_3 }],
          error: null,
        }),
      });

      const request = new NextRequest('http://localhost/api/transactions/bulk', {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.updated).toBe(3);
      expect(mockFrom).toHaveBeenCalledWith('transactions');
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('updates multiple transactions with date', async () => {
      const updateData = {
        ids: [UUID_1, UUID_2],
        update: {
          date: '2024-06-15',
        },
      };

      mockIn.mockReturnValue({
        select: () => ({
          data: [{ id: UUID_1 }, { id: UUID_2 }],
          error: null,
        }),
      });

      const request = new NextRequest('http://localhost/api/transactions/bulk', {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.updated).toBe(2);
    });

    it('updates categorisation_source', async () => {
      const updateData = {
        ids: [UUID_1],
        update: {
          category_id: CAT_UUID,
          categorisation_source: 'manual',
        },
      };

      mockIn.mockReturnValue({
        select: () => ({
          data: [{ id: UUID_1 }],
          error: null,
        }),
      });

      const request = new NextRequest('http://localhost/api/transactions/bulk', {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('returns 400 for empty ids array', async () => {
      const updateData = {
        ids: [],
        update: {
          category_id: CAT_UUID,
        },
      };

      const request = new NextRequest('http://localhost/api/transactions/bulk', {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Validation error');
    });

    it('returns 400 for missing ids', async () => {
      const updateData = {
        update: {
          category_id: CAT_UUID,
        },
      };

      const request = new NextRequest('http://localhost/api/transactions/bulk', {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });

      const response = await PUT(request);

      expect(response.status).toBe(400);
    });

    it('returns 400 for missing update object', async () => {
      const updateData = {
        ids: [UUID_1, UUID_2],
      };

      const request = new NextRequest('http://localhost/api/transactions/bulk', {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });

      const response = await PUT(request);

      expect(response.status).toBe(400);
    });

    it('returns 400 for invalid UUID format', async () => {
      const updateData = {
        ids: ['not-a-uuid', 'also-not-uuid'],
        update: {
          category_id: CAT_UUID,
        },
      };

      const request = new NextRequest('http://localhost/api/transactions/bulk', {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });

      const response = await PUT(request);

      expect(response.status).toBe(400);
    });

    it('returns 500 on database error', async () => {
      const updateData = {
        ids: [UUID_1],
        update: {
          category_id: CAT_UUID,
        },
      };

      mockIn.mockReturnValue({
        select: () => ({
          data: null,
          error: { message: 'Database error' },
        }),
      });

      const request = new NextRequest('http://localhost/api/transactions/bulk', {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Database error');
    });

    it('handles update with no matching transactions', async () => {
      const updateData = {
        ids: [UUID_1, UUID_2],
        update: {
          category_id: CAT_UUID,
        },
      };

      mockIn.mockReturnValue({
        select: () => ({
          data: [],
          error: null,
        }),
      });

      const request = new NextRequest('http://localhost/api/transactions/bulk', {
        method: 'PUT',
        body: JSON.stringify(updateData),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.updated).toBe(0);
    });
  });

  describe('DELETE /api/transactions/bulk', () => {
    it('deletes multiple transactions', async () => {
      const deleteData = {
        ids: [UUID_1, UUID_2, UUID_3],
      };

      // Mock chain: first delete hashes, then delete transactions
      mockFrom.mockImplementation(() => {
        return {
          delete: () => ({
            in: () => ({ error: null }),
          }),
        };
      });

      const request = new NextRequest('http://localhost/api/transactions/bulk', {
        method: 'DELETE',
        body: JSON.stringify(deleteData),
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.deleted).toBe(3);
    });

    it('deletes associated hashes before transactions', async () => {
      const deleteData = {
        ids: [UUID_1],
      };

      const fromCalls: string[] = [];
      mockFrom.mockImplementation((table: string) => {
        fromCalls.push(table);
        return {
          delete: () => ({
            in: () => ({ error: null }),
          }),
        };
      });

      const request = new NextRequest('http://localhost/api/transactions/bulk', {
        method: 'DELETE',
        body: JSON.stringify(deleteData),
      });

      await DELETE(request);

      // Should call hashes table first, then transactions
      expect(fromCalls).toContain('imported_transaction_hashes');
      expect(fromCalls).toContain('transactions');
      expect(fromCalls.indexOf('imported_transaction_hashes')).toBeLessThan(
        fromCalls.indexOf('transactions')
      );
    });

    it('returns 400 for empty ids array', async () => {
      const deleteData = {
        ids: [],
      };

      const request = new NextRequest('http://localhost/api/transactions/bulk', {
        method: 'DELETE',
        body: JSON.stringify(deleteData),
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Validation error');
    });

    it('returns 400 for missing ids', async () => {
      const deleteData = {};

      const request = new NextRequest('http://localhost/api/transactions/bulk', {
        method: 'DELETE',
        body: JSON.stringify(deleteData),
      });

      const response = await DELETE(request);

      expect(response.status).toBe(400);
    });

    it('returns 400 for invalid id types', async () => {
      const deleteData = {
        ids: [123, 456], // Should be strings
      };

      const request = new NextRequest('http://localhost/api/transactions/bulk', {
        method: 'DELETE',
        body: JSON.stringify(deleteData),
      });

      const response = await DELETE(request);

      expect(response.status).toBe(400);
    });

    it('returns 400 for invalid UUID format', async () => {
      const deleteData = {
        ids: ['not-a-uuid'],
      };

      const request = new NextRequest('http://localhost/api/transactions/bulk', {
        method: 'DELETE',
        body: JSON.stringify(deleteData),
      });

      const response = await DELETE(request);

      expect(response.status).toBe(400);
    });

    it('returns 500 on database error during delete', async () => {
      const deleteData = {
        ids: [UUID_1],
      };

      mockFrom.mockImplementation((table: string) => {
        if (table === 'transactions') {
          return {
            delete: () => ({
              in: () => ({ error: { message: 'Delete failed' } }),
            }),
          };
        }
        // Hashes delete succeeds
        return {
          delete: () => ({
            in: () => ({ error: null }),
          }),
        };
      });

      const request = new NextRequest('http://localhost/api/transactions/bulk', {
        method: 'DELETE',
        body: JSON.stringify(deleteData),
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Delete failed');
    });

    it('handles single transaction delete', async () => {
      const deleteData = {
        ids: [UUID_1],
      };

      mockFrom.mockImplementation(() => ({
        delete: () => ({
          in: () => ({ error: null }),
        }),
      }));

      const request = new NextRequest('http://localhost/api/transactions/bulk', {
        method: 'DELETE',
        body: JSON.stringify(deleteData),
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.deleted).toBe(1);
    });
  });
});
