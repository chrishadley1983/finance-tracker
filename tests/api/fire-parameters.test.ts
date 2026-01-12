import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/fire-parameters/route';
import { GET as GET_BY_ID, PUT, DELETE } from '@/app/api/fire-parameters/[id]/route';

// Valid UUIDs for testing
const TEST_FIRE_ID = '550e8400-e29b-41d4-a716-446655440040';

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

describe('FIRE Parameters API', () => {
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
    // vi.restoreAllMocks(); - removed to preserve module mocks
  });

  describe('GET /api/fire-parameters', () => {
    it('returns a list of FIRE parameter scenarios', async () => {
      const mockScenarios = [
        {
          id: TEST_FIRE_ID,
          scenario_name: 'Conservative',
          annual_spend: 30000,
          withdrawal_rate: 3.5,
          expected_return: 5,
          retirement_age: 55,
          state_pension_age: 67,
          state_pension_amount: 10000,
        },
      ];
      mockOrder.mockResolvedValue({ data: mockScenarios, error: null });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockScenarios);
      expect(mockFrom).toHaveBeenCalledWith('fire_parameters');
    });

    it('returns 500 on database error', async () => {
      mockOrder.mockResolvedValue({ data: null, error: { message: 'Database error' } });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Database error');
    });
  });

  describe('POST /api/fire-parameters', () => {
    it('creates a new FIRE scenario with valid data', async () => {
      const newScenario = {
        scenario_name: 'Aggressive',
        annual_spend: 40000,
        withdrawal_rate: 4.0,
        expected_return: 7,
        retirement_age: 50,
        state_pension_age: 67,
        state_pension_amount: 10000,
      };
      const createdScenario = { id: TEST_FIRE_ID, ...newScenario };

      mockSingle.mockResolvedValue({ data: createdScenario, error: null });

      const request = new NextRequest('http://localhost/api/fire-parameters', {
        method: 'POST',
        body: JSON.stringify(newScenario),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.scenario_name).toBe('Aggressive');
      expect(data.withdrawal_rate).toBe(4.0);
    });

    it('returns 400 when scenario_name is missing', async () => {
      const invalidScenario = {
        annual_spend: 40000,
        withdrawal_rate: 4.0,
        expected_return: 7,
        retirement_age: 50,
        state_pension_age: 67,
        state_pension_amount: 10000,
      };

      const request = new NextRequest('http://localhost/api/fire-parameters', {
        method: 'POST',
        body: JSON.stringify(invalidScenario),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('returns 400 when scenario_name is empty', async () => {
      const invalidScenario = {
        scenario_name: '',
        annual_spend: 40000,
        withdrawal_rate: 4.0,
        expected_return: 7,
        retirement_age: 50,
        state_pension_age: 67,
        state_pension_amount: 10000,
      };

      const request = new NextRequest('http://localhost/api/fire-parameters', {
        method: 'POST',
        body: JSON.stringify(invalidScenario),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('returns 400 for negative annual_spend', async () => {
      const invalidScenario = {
        scenario_name: 'Invalid',
        annual_spend: -5000,
        withdrawal_rate: 4.0,
        expected_return: 7,
        retirement_age: 50,
        state_pension_age: 67,
        state_pension_amount: 10000,
      };

      const request = new NextRequest('http://localhost/api/fire-parameters', {
        method: 'POST',
        body: JSON.stringify(invalidScenario),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('returns 400 for withdrawal_rate over 100', async () => {
      const invalidScenario = {
        scenario_name: 'Invalid',
        annual_spend: 40000,
        withdrawal_rate: 150,
        expected_return: 7,
        retirement_age: 50,
        state_pension_age: 67,
        state_pension_amount: 10000,
      };

      const request = new NextRequest('http://localhost/api/fire-parameters', {
        method: 'POST',
        body: JSON.stringify(invalidScenario),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('returns 400 for retirement_age under 18', async () => {
      const invalidScenario = {
        scenario_name: 'Invalid',
        annual_spend: 40000,
        withdrawal_rate: 4.0,
        expected_return: 7,
        retirement_age: 15,
        state_pension_age: 67,
        state_pension_amount: 10000,
      };

      const request = new NextRequest('http://localhost/api/fire-parameters', {
        method: 'POST',
        body: JSON.stringify(invalidScenario),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('returns 400 for state_pension_age under 50', async () => {
      const invalidScenario = {
        scenario_name: 'Invalid',
        annual_spend: 40000,
        withdrawal_rate: 4.0,
        expected_return: 7,
        retirement_age: 50,
        state_pension_age: 45,
        state_pension_amount: 10000,
      };

      const request = new NextRequest('http://localhost/api/fire-parameters', {
        method: 'POST',
        body: JSON.stringify(invalidScenario),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/fire-parameters/[id]', () => {
    it('returns a single FIRE scenario by ID', async () => {
      const mockScenario = {
        id: TEST_FIRE_ID,
        scenario_name: 'Conservative',
        annual_spend: 30000,
        withdrawal_rate: 3.5,
        expected_return: 5,
        retirement_age: 55,
        state_pension_age: 67,
        state_pension_amount: 10000,
      };
      mockSingle.mockResolvedValue({ data: mockScenario, error: null });

      const request = new NextRequest(`http://localhost/api/fire-parameters/${TEST_FIRE_ID}`);
      const response = await GET_BY_ID(request, { params: Promise.resolve({ id: TEST_FIRE_ID }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe(TEST_FIRE_ID);
      expect(data.scenario_name).toBe('Conservative');
    });

    it('returns 404 when FIRE parameters not found', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' }
      });

      const request = new NextRequest('http://localhost/api/fire-parameters/nonexistent');
      const response = await GET_BY_ID(request, { params: Promise.resolve({ id: 'nonexistent' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('FIRE parameters not found');
    });
  });

  describe('PUT /api/fire-parameters/[id]', () => {
    it('updates scenario name', async () => {
      const updatedScenario = { id: TEST_FIRE_ID, scenario_name: 'Updated Conservative' };
      mockSingle.mockResolvedValue({ data: updatedScenario, error: null });

      const request = new NextRequest(`http://localhost/api/fire-parameters/${TEST_FIRE_ID}`, {
        method: 'PUT',
        body: JSON.stringify({ scenario_name: 'Updated Conservative' }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: TEST_FIRE_ID }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.scenario_name).toBe('Updated Conservative');
    });

    it('updates annual_spend', async () => {
      const updatedScenario = { id: TEST_FIRE_ID, annual_spend: 35000 };
      mockSingle.mockResolvedValue({ data: updatedScenario, error: null });

      const request = new NextRequest(`http://localhost/api/fire-parameters/${TEST_FIRE_ID}`, {
        method: 'PUT',
        body: JSON.stringify({ annual_spend: 35000 }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: TEST_FIRE_ID }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.annual_spend).toBe(35000);
    });

    it('updates withdrawal_rate', async () => {
      const updatedScenario = { id: TEST_FIRE_ID, withdrawal_rate: 3.0 };
      mockSingle.mockResolvedValue({ data: updatedScenario, error: null });

      const request = new NextRequest(`http://localhost/api/fire-parameters/${TEST_FIRE_ID}`, {
        method: 'PUT',
        body: JSON.stringify({ withdrawal_rate: 3.0 }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: TEST_FIRE_ID }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.withdrawal_rate).toBe(3.0);
    });

    it('updates retirement_age', async () => {
      const updatedScenario = { id: TEST_FIRE_ID, retirement_age: 60 };
      mockSingle.mockResolvedValue({ data: updatedScenario, error: null });

      const request = new NextRequest(`http://localhost/api/fire-parameters/${TEST_FIRE_ID}`, {
        method: 'PUT',
        body: JSON.stringify({ retirement_age: 60 }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: TEST_FIRE_ID }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.retirement_age).toBe(60);
    });

    it('returns 404 when updating non-existent scenario', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' }
      });

      const request = new NextRequest('http://localhost/api/fire-parameters/nonexistent', {
        method: 'PUT',
        body: JSON.stringify({ scenario_name: 'New Name' }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: 'nonexistent' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('FIRE parameters not found');
    });

    it('returns 400 for invalid withdrawal_rate in update', async () => {
      const request = new NextRequest(`http://localhost/api/fire-parameters/${TEST_FIRE_ID}`, {
        method: 'PUT',
        body: JSON.stringify({ withdrawal_rate: -5 }),
      });

      const response = await PUT(request, { params: Promise.resolve({ id: TEST_FIRE_ID }) });

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/fire-parameters/[id]', () => {
    it('deletes a FIRE scenario and returns 204', async () => {
      mockEq.mockReturnValue({ error: null });

      const request = new NextRequest('http://localhost/api/fire-parameters/123', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: '123' }) });

      expect(response.status).toBe(204);
    });

    it('returns 500 on database error during delete', async () => {
      mockEq.mockReturnValue({ error: { message: 'Delete failed' } });

      const request = new NextRequest('http://localhost/api/fire-parameters/123', {
        method: 'DELETE',
      });

      const response = await DELETE(request, { params: Promise.resolve({ id: '123' }) });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Delete failed');
    });
  });
});
