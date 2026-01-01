import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/category-mappings/route';
import { GET as GET_BY_ID, PUT, DELETE } from '@/app/api/category-mappings/[id]/route';

// Valid UUIDs for testing
const TEST_MAPPING_ID = '550e8400-e29b-41d4-a716-446655440030';
const TEST_CATEGORY_ID = '550e8400-e29b-41d4-a716-446655440031';
const NEW_CATEGORY_ID = '550e8400-e29b-41d4-a716-446655440032';

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

describe('Category Mappings API', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup chain mocks
    const chainMock = {
      order: mockOrder,
      eq: mockEq,
      single: mockSingle,
      select: mockSelect,
    };

    mockSelect.mockReturnValue(chainMock);
    mockOrder.mockReturnValue(chainMock);
    mockEq.mockReturnValue(chainMock);
    mockSingle.mockResolvedValue({ data: null, error: null });
    mockInsert.mockReturnValue({ select: () => ({ single: mockSingle }) });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockDelete.mockReturnValue({ eq: mockEq });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/category-mappings', () => {
    it('returns a list of category mappings', async () => {
      const mockMappings = [
        {
          id: TEST_MAPPING_ID,
          pattern: 'TESCO',
          category_id: TEST_CATEGORY_ID,
          match_type: 'contains',
          confidence: 1.0,
          category: { name: 'Groceries', group_name: 'Food' },
        },
      ];
      mockOrder.mockResolvedValue({ data: mockMappings, error: null });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockMappings);
      expect(mockFrom).toHaveBeenCalledWith('category_mappings');
    });

    it('returns 500 on database error', async () => {
      mockOrder.mockResolvedValue({ data: null, error: { message: 'Database error' } });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Database error');
    });
  });

  describe('POST /api/category-mappings', () => {
    it('creates a new mapping with valid data', async () => {
      const newMapping = {
        pattern: 'AMAZON',
        category_id: TEST_CATEGORY_ID,
        match_type: 'contains',
        confidence: 0.9,
      };
      const createdMapping = { id: TEST_MAPPING_ID, ...newMapping };

      mockSingle.mockResolvedValue({ data: createdMapping, error: null });

      const request = new NextRequest('http://localhost/api/category-mappings', {
        method: 'POST',
        body: JSON.stringify(newMapping),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.pattern).toBe('AMAZON');
      expect(data.match_type).toBe('contains');
    });

    it('creates a mapping with default match_type', async () => {
      const newMapping = {
        pattern: 'SAINSBURY',
        category_id: TEST_CATEGORY_ID,
      };
      const createdMapping = { id: TEST_MAPPING_ID, ...newMapping, match_type: 'contains', confidence: 1.0 };

      mockSingle.mockResolvedValue({ data: createdMapping, error: null });

      const request = new NextRequest('http://localhost/api/category-mappings', {
        method: 'POST',
        body: JSON.stringify(newMapping),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.match_type).toBe('contains');
      expect(data.confidence).toBe(1.0);
    });

    it('creates a mapping with exact match type', async () => {
      const newMapping = {
        pattern: 'NETFLIX',
        category_id: TEST_CATEGORY_ID,
        match_type: 'exact',
      };
      const createdMapping = { id: TEST_MAPPING_ID, ...newMapping, confidence: 1.0 };

      mockSingle.mockResolvedValue({ data: createdMapping, error: null });

      const request = new NextRequest('http://localhost/api/category-mappings', {
        method: 'POST',
        body: JSON.stringify(newMapping),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.match_type).toBe('exact');
    });

    it('creates a mapping with regex match type', async () => {
      const newMapping = {
        pattern: '^UBER.*',
        category_id: TEST_CATEGORY_ID,
        match_type: 'regex',
      };
      const createdMapping = { id: TEST_MAPPING_ID, ...newMapping, confidence: 1.0 };

      mockSingle.mockResolvedValue({ data: createdMapping, error: null });

      const request = new NextRequest('http://localhost/api/category-mappings', {
        method: 'POST',
        body: JSON.stringify(newMapping),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.match_type).toBe('regex');
    });

    it('returns 400 when pattern is missing', async () => {
      const invalidMapping = {
        category_id: TEST_CATEGORY_ID,
      };

      const request = new NextRequest('http://localhost/api/category-mappings', {
        method: 'POST',
        body: JSON.stringify(invalidMapping),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('returns 400 when category_id is missing', async () => {
      const invalidMapping = {
        pattern: 'AMAZON',
      };

      const request = new NextRequest('http://localhost/api/category-mappings', {
        method: 'POST',
        body: JSON.stringify(invalidMapping),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('returns 400 when pattern is empty', async () => {
      const invalidMapping = {
        pattern: '',
        category_id: TEST_CATEGORY_ID,
      };

      const request = new NextRequest('http://localhost/api/category-mappings', {
        method: 'POST',
        body: JSON.stringify(invalidMapping),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('returns 400 for invalid match_type', async () => {
      const invalidMapping = {
        pattern: 'AMAZON',
        category_id: TEST_CATEGORY_ID,
        match_type: 'invalid_type',
      };

      const request = new NextRequest('http://localhost/api/category-mappings', {
        method: 'POST',
        body: JSON.stringify(invalidMapping),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('returns 400 for confidence out of range', async () => {
      const invalidMapping = {
        pattern: 'AMAZON',
        category_id: TEST_CATEGORY_ID,
        confidence: 1.5, // Out of range
      };

      const request = new NextRequest('http://localhost/api/category-mappings', {
        method: 'POST',
        body: JSON.stringify(invalidMapping),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/category-mappings/[id]', () => {
    it('returns a single mapping by ID', async () => {
      const mockMapping = {
        id: TEST_MAPPING_ID,
        pattern: 'TESCO',
        category_id: TEST_CATEGORY_ID,
        match_type: 'contains',
        confidence: 1.0,
        category: { name: 'Groceries', group_name: 'Food' },
      };
      mockSingle.mockResolvedValue({ data: mockMapping, error: null });

      const request = new NextRequest(`http://localhost/api/category-mappings/${TEST_MAPPING_ID}`);
      const response = await GET_BY_ID(request, { params: Promise.resolve({ id: TEST_MAPPING_ID }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe(TEST_MAPPING_ID);
      expect(data.pattern).toBe('TESCO');
    });

    it('returns 404 when mapping not found', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' }
      });

      const request = new NextRequest('http://localhost/api/category-mappings/nonexistent');
      const response = await GET_BY_ID(request, { params: Promise.resolve({ id: 'nonexistent' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Category mapping not found');
    });
  });

  describe('PUT /api/category-mappings/[id]', () => {
    it('updates mapping pattern', async () => {
      const updatedMapping = { id: TEST_MAPPING_ID, pattern: 'TESCO STORES' };
      mockSingle.mockResolvedValue({ data: updatedMapping, error: null });

      const request = new NextRequest(`http://localhost/api/category-mappings/${TEST_MAPPING_ID}`, {
        method: 'PUT',
        body: JSON.stringify({ pattern: 'TESCO STORES' }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: TEST_MAPPING_ID }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.pattern).toBe('TESCO STORES');
    });

    it('updates mapping category', async () => {
      const updatedMapping = { id: TEST_MAPPING_ID, category_id: NEW_CATEGORY_ID };
      mockSingle.mockResolvedValue({ data: updatedMapping, error: null });

      const request = new NextRequest(`http://localhost/api/category-mappings/${TEST_MAPPING_ID}`, {
        method: 'PUT',
        body: JSON.stringify({ category_id: NEW_CATEGORY_ID }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: TEST_MAPPING_ID }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.category_id).toBe(NEW_CATEGORY_ID);
    });

    it('updates mapping confidence', async () => {
      const updatedMapping = { id: TEST_MAPPING_ID, confidence: 0.75 };
      mockSingle.mockResolvedValue({ data: updatedMapping, error: null });

      const request = new NextRequest(`http://localhost/api/category-mappings/${TEST_MAPPING_ID}`, {
        method: 'PUT',
        body: JSON.stringify({ confidence: 0.75 }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: TEST_MAPPING_ID }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.confidence).toBe(0.75);
    });

    it('returns 404 when updating non-existent mapping', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' }
      });

      const request = new NextRequest('http://localhost/api/category-mappings/nonexistent', {
        method: 'PUT',
        body: JSON.stringify({ pattern: 'NEW PATTERN' }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: 'nonexistent' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Category mapping not found');
    });
  });

  describe('DELETE /api/category-mappings/[id]', () => {
    it('deletes a mapping and returns 204', async () => {
      mockEq.mockReturnValue({ error: null });

      const request = new NextRequest('http://localhost/api/category-mappings/123', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: '123' }) });

      expect(response.status).toBe(204);
    });

    it('returns 500 on database error during delete', async () => {
      mockEq.mockReturnValue({ error: { message: 'Delete failed' } });

      const request = new NextRequest('http://localhost/api/category-mappings/123', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: '123' }) });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Delete failed');
    });
  });
});
