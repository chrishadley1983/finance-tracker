import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/categories/route';
import { GET as GET_BY_ID, PUT, DELETE } from '@/app/api/categories/[id]/route';

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

describe('Categories API', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup chain mocks
    mockSelect.mockReturnValue({ order: mockOrder, eq: mockEq, single: mockSingle });
    mockOrder.mockReturnValue({ order: mockOrder, data: [], error: null });
    mockEq.mockReturnValue({ single: mockSingle, select: mockSelect });
    mockSingle.mockResolvedValue({ data: null, error: null });
    mockInsert.mockReturnValue({ select: () => ({ single: mockSingle }) });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockDelete.mockReturnValue({ eq: mockEq });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/categories', () => {
    const createRequest = (url = 'http://localhost/api/categories') => {
      return new NextRequest(url);
    };

    it('returns a list of categories ordered by display_order and name', async () => {
      const mockCategories = [
        { id: '1', name: 'Groceries', group_name: 'Food', is_income: false, display_order: 0 },
        { id: '2', name: 'Salary', group_name: 'Income', is_income: true, display_order: 1 },
      ];
      mockOrder.mockReturnValue({ order: mockOrder, data: mockCategories, error: null });

      const response = await GET(createRequest());
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockCategories);
      expect(mockFrom).toHaveBeenCalledWith('categories');
    });

    it('returns 500 on database error', async () => {
      mockOrder.mockReturnValue({ order: () => ({ data: null, error: { message: 'Database error' } }) });

      const response = await GET(createRequest());

      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/categories', () => {
    it('creates a new category with valid data', async () => {
      const newCategory = {
        name: 'Entertainment',
        group_name: 'Lifestyle',
      };
      const createdCategory = { id: 'new-id', ...newCategory, is_income: false, display_order: 0 };

      mockSingle.mockResolvedValue({ data: createdCategory, error: null });

      const request = new NextRequest('http://localhost/api/categories', {
        method: 'POST',
        body: JSON.stringify(newCategory),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.name).toBe('Entertainment');
    });

    it('creates an income category when is_income is true', async () => {
      const newCategory = {
        name: 'Salary',
        group_name: 'Income',
        is_income: true,
      };
      const createdCategory = { id: 'new-id', ...newCategory, display_order: 0 };

      mockSingle.mockResolvedValue({ data: createdCategory, error: null });

      const request = new NextRequest('http://localhost/api/categories', {
        method: 'POST',
        body: JSON.stringify(newCategory),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.is_income).toBe(true);
    });

    it('returns 400 when name is missing', async () => {
      const invalidCategory = {
        group_name: 'Lifestyle',
      };

      const request = new NextRequest('http://localhost/api/categories', {
        method: 'POST',
        body: JSON.stringify(invalidCategory),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('returns 400 when group_name is missing', async () => {
      const invalidCategory = {
        name: 'Entertainment',
      };

      const request = new NextRequest('http://localhost/api/categories', {
        method: 'POST',
        body: JSON.stringify(invalidCategory),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('returns 400 when name is empty string', async () => {
      const invalidCategory = {
        name: '',
        group_name: 'Lifestyle',
      };

      const request = new NextRequest('http://localhost/api/categories', {
        method: 'POST',
        body: JSON.stringify(invalidCategory),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/categories/[id]', () => {
    it('returns a single category by ID', async () => {
      const mockCategory = { id: '123', name: 'Groceries', group_name: 'Food', is_income: false };
      mockSingle.mockResolvedValue({ data: mockCategory, error: null });

      const request = new NextRequest('http://localhost/api/categories/123');
      const response = await GET_BY_ID(request, { params: Promise.resolve({ id: '123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe('123');
      expect(data.name).toBe('Groceries');
    });

    it('returns 404 when category not found', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' }
      });

      const request = new NextRequest('http://localhost/api/categories/nonexistent');
      const response = await GET_BY_ID(request, { params: Promise.resolve({ id: 'nonexistent' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Category not found');
    });
  });

  describe('PUT /api/categories/[id]', () => {
    it('updates a category name', async () => {
      const updatedCategory = { id: '123', name: 'Updated Category', group_name: 'Food', is_income: false };
      mockSingle.mockResolvedValue({ data: updatedCategory, error: null });

      const request = new NextRequest('http://localhost/api/categories/123', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Updated Category' }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: '123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.name).toBe('Updated Category');
    });

    it('updates category is_income flag', async () => {
      const updatedCategory = { id: '123', name: 'Salary', group_name: 'Income', is_income: true };
      mockSingle.mockResolvedValue({ data: updatedCategory, error: null });

      const request = new NextRequest('http://localhost/api/categories/123', {
        method: 'PUT',
        body: JSON.stringify({ is_income: true }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: '123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.is_income).toBe(true);
    });

    it('returns 404 when updating non-existent category', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' }
      });

      const request = new NextRequest('http://localhost/api/categories/nonexistent', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Updated Name' }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: 'nonexistent' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Category not found');
    });
  });

  describe('DELETE /api/categories/[id]', () => {
    it('deletes a category and returns 204', async () => {
      mockEq.mockReturnValue({ error: null });

      const request = new NextRequest('http://localhost/api/categories/123', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: '123' }) });

      expect(response.status).toBe(204);
    });

    it('returns 500 on database error during delete', async () => {
      mockEq.mockReturnValue({ error: { message: 'Foreign key constraint violation' } });

      const request = new NextRequest('http://localhost/api/categories/123', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: '123' }) });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Foreign key constraint violation');
    });
  });
});
