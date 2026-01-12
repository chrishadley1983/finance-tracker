import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/investments/route';

// Mock Supabase
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockOrder = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockIn = vi.fn();

const mockFrom = vi.fn().mockReturnValue({
  select: mockSelect,
  insert: mockInsert,
});

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

describe('Investments API', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup chain mocks
    mockSelect.mockReturnValue({ order: mockOrder, eq: mockEq, single: mockSingle, in: mockIn });
    mockOrder.mockReturnValue({ eq: mockEq, data: [], error: null });
    mockEq.mockReturnValue({ eq: mockEq, order: mockOrder, data: [], error: null });
    mockSingle.mockResolvedValue({ data: null, error: null });
    mockInsert.mockReturnValue({ select: () => ({ single: mockSingle }) });
    mockIn.mockReturnValue({ order: mockOrder, data: [], error: null });
  });

  afterEach(() => {
    // vi.restoreAllMocks(); - removed to preserve module mocks
  });

  describe('GET /api/investments', () => {
    it('returns empty array when no investment accounts exist', async () => {
      // Mock accounts query chain: .select().eq().eq().order()
      mockEq.mockReturnValue({ eq: () => ({ order: () => ({ data: [], error: null }) }) });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.accounts).toEqual([]);
    });

    it('returns investment accounts with latest valuations', async () => {
      const mockAccounts = [
        {
          id: 'acc-1',
          name: 'Vanguard ISA',
          type: 'investment',
          provider: 'Vanguard',
          investment_provider: 'vanguard',
          investment_type: 'isa',
          is_active: true,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'acc-2',
          name: 'Workplace Pension',
          type: 'investment',
          provider: 'Legal & General',
          investment_provider: 'legal_and_general',
          investment_type: 'workplace_pension',
          is_active: true,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ];

      const mockValuations = [
        {
          id: 'val-1',
          account_id: 'acc-1',
          date: '2024-06-01',
          value: 50000,
          notes: null,
          created_at: '2024-06-01T00:00:00Z',
          updated_at: '2024-06-01T00:00:00Z',
        },
      ];

      // First call returns accounts
      let fromCallCount = 0;
      mockFrom.mockImplementation((table: string) => {
        fromCallCount++;
        if (table === 'accounts') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  order: () => ({ data: mockAccounts, error: null }),
                }),
              }),
            }),
          };
        }
        if (table === 'investment_valuations') {
          return {
            select: () => ({
              in: () => ({
                order: () => ({ data: mockValuations, error: null }),
              }),
            }),
          };
        }
        return { select: mockSelect };
      });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.accounts).toHaveLength(2);
      expect(data.accounts[0].name).toBe('Vanguard ISA');
      expect(data.accounts[0].latestValuation).toBeDefined();
      expect(data.accounts[0].latestValuation.value).toBe(50000);
      expect(data.accounts[1].latestValuation).toBeNull();
    });

    it('returns 500 on database error', async () => {
      mockFrom.mockImplementation(() => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              order: () => ({ data: null, error: { message: 'Database error' } }),
            }),
          }),
        }),
      }));

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch investment accounts');
    });
  });

  describe('POST /api/investments', () => {
    it('creates a new investment account with valid data', async () => {
      const newAccount = {
        name: 'New ISA',
        investmentProvider: 'vanguard',
        investmentType: 'isa',
      };

      const createdAccount = {
        id: 'new-id',
        name: 'New ISA',
        type: 'investment',
        provider: 'Vanguard',
        investment_provider: 'vanguard',
        investment_type: 'isa',
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      mockFrom.mockImplementation(() => ({
        insert: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: createdAccount, error: null }),
          }),
        }),
      }));

      const request = new NextRequest('http://localhost/api/investments', {
        method: 'POST',
        body: JSON.stringify(newAccount),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.account.name).toBe('New ISA');
      expect(data.account.investmentProvider).toBe('vanguard');
    });

    it('returns 400 for invalid investment provider', async () => {
      const invalidAccount = {
        name: 'Test ISA',
        investmentProvider: 'invalid_provider',
        investmentType: 'isa',
      };

      const request = new NextRequest('http://localhost/api/investments', {
        method: 'POST',
        body: JSON.stringify(invalidAccount),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Validation failed');
    });

    it('returns 400 for invalid investment type', async () => {
      const invalidAccount = {
        name: 'Test Account',
        investmentProvider: 'vanguard',
        investmentType: 'invalid_type',
      };

      const request = new NextRequest('http://localhost/api/investments', {
        method: 'POST',
        body: JSON.stringify(invalidAccount),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Validation failed');
    });

    it('returns 400 when name is missing', async () => {
      const invalidAccount = {
        investmentProvider: 'vanguard',
        investmentType: 'isa',
      };

      const request = new NextRequest('http://localhost/api/investments', {
        method: 'POST',
        body: JSON.stringify(invalidAccount),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('returns 400 when investmentProvider is missing', async () => {
      const invalidAccount = {
        name: 'Test Account',
        investmentType: 'isa',
      };

      const request = new NextRequest('http://localhost/api/investments', {
        method: 'POST',
        body: JSON.stringify(invalidAccount),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it('returns 500 on database error during creation', async () => {
      const validAccount = {
        name: 'New ISA',
        investmentProvider: 'vanguard',
        investmentType: 'isa',
      };

      mockFrom.mockImplementation(() => ({
        insert: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: null, error: { message: 'Insert failed' } }),
          }),
        }),
      }));

      const request = new NextRequest('http://localhost/api/investments', {
        method: 'POST',
        body: JSON.stringify(validAccount),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to create investment account');
    });

    it('accepts optional account reference', async () => {
      const newAccount = {
        name: 'New SIPP',
        investmentProvider: 'interactive_investor',
        investmentType: 'sipp',
        accountReference: 'REF-12345',
      };

      const createdAccount = {
        id: 'new-id',
        name: 'New SIPP',
        type: 'investment',
        provider: 'Interactive Investor',
        investment_provider: 'interactive_investor',
        investment_type: 'sipp',
        hsbc_account_id: 'REF-12345',
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      mockFrom.mockImplementation(() => ({
        insert: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: createdAccount, error: null }),
          }),
        }),
      }));

      const request = new NextRequest('http://localhost/api/investments', {
        method: 'POST',
        body: JSON.stringify(newAccount),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.account.name).toBe('New SIPP');
    });
  });
});
