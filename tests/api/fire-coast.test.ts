import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from '@/app/api/fire/coast/route';

// Mock Supabase
const mockSelect = vi.fn();
const mockLimit = vi.fn();
const mockSingle = vi.fn();
const mockEq = vi.fn();
const mockRpc = vi.fn();

const mockFrom = vi.fn().mockReturnValue({
  select: mockSelect,
});

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

describe('Fire Coast API', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup chain mocks
    mockSelect.mockReturnValue({ limit: mockLimit, eq: mockEq });
    mockLimit.mockReturnValue({ single: mockSingle });
    mockEq.mockReturnValue({ eq: mockEq, data: [], error: null });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/fire/coast', () => {
    it('returns coast FIRE calculations when inputs are configured', async () => {
      const mockInputs = {
        id: 'input-1',
        current_age: 35,
        target_retirement_age: 50,
        annual_spend: 40000,
        withdrawal_rate: 4,
        expected_return: 7,
        exclude_property_from_fire: true,
      };

      const mockAccounts = [
        { id: 'acc-1', name: 'ISA', type: 'investment', include_in_net_worth: true },
        { id: 'acc-2', name: 'Pension', type: 'pension', include_in_net_worth: true },
      ];

      const mockBalanceData = [
        { account_id: 'acc-1', current_balance: 100000 },
        { account_id: 'acc-2', current_balance: 150000 },
      ];

      // Mock fire_inputs query
      let fromCallCount = 0;
      mockFrom.mockImplementation((table: string) => {
        fromCallCount++;
        if (table === 'fire_inputs') {
          return {
            select: () => ({
              limit: () => ({
                single: () => Promise.resolve({ data: mockInputs, error: null }),
              }),
            }),
          };
        }
        if (table === 'accounts') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({ data: mockAccounts, error: null }),
              }),
            }),
          };
        }
        return { select: mockSelect };
      });

      mockRpc.mockResolvedValue({ data: mockBalanceData, error: null });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.coastFire).toBeDefined();
      expect(data.coastFire.value).toBeGreaterThan(0);
      expect(data.coastFire.currentNetWorth).toBe(250000);
      expect(data.inputs.currentAge).toBe(35);
      expect(data.inputs.targetRetirementAge).toBe(50);
      expect(data.inputs.yearsLeft).toBe(15);
      expect(data.settings.annualSpend).toBe(40000);
      expect(data.settings.withdrawalRate).toBe(4);
      expect(data.settings.expectedReturn).toBe(7);
    });

    it('returns coastFire null when fire inputs not configured', async () => {
      mockFrom.mockImplementation(() => ({
        select: () => ({
          limit: () => ({
            single: () => Promise.resolve({ data: null, error: { code: 'PGRST116' } }),
          }),
        }),
      }));

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.coastFire).toBeNull();
      expect(data.error).toContain('not configured');
    });

    it('calculates Coast FIRE correctly based on formula', async () => {
      // Coast FIRE = (Annual Spend / SWR) / (1 + Return)^Years
      // With: spend=40000, SWR=4%, return=7%, years=15
      // FIRE Number = 40000 / 0.04 = 1,000,000
      // Coast FIRE = 1,000,000 / (1.07)^15 = 1,000,000 / 2.759 = ~362,446

      const mockInputs = {
        current_age: 35,
        target_retirement_age: 50,
        annual_spend: 40000,
        withdrawal_rate: 4,
        expected_return: 7,
        exclude_property_from_fire: true,
      };

      mockFrom.mockImplementation((table: string) => {
        if (table === 'fire_inputs') {
          return {
            select: () => ({
              limit: () => ({
                single: () => Promise.resolve({ data: mockInputs, error: null }),
              }),
            }),
          };
        }
        if (table === 'accounts') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({ data: [], error: null }),
              }),
            }),
          };
        }
        return { select: mockSelect };
      });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);

      // Expected FIRE number at retirement = 40000 / 0.04 = 1,000,000
      expect(data.coastFire.fireNumberAtRetirement).toBe(1000000);

      // Coast FIRE should be around 362,000-363,000
      expect(data.coastFire.value).toBeGreaterThan(350000);
      expect(data.coastFire.value).toBeLessThan(375000);
    });

    it('calculates isCoastFI correctly when net worth exceeds coast target', async () => {
      const mockInputs = {
        current_age: 35,
        target_retirement_age: 50,
        annual_spend: 40000,
        withdrawal_rate: 4,
        expected_return: 7,
        exclude_property_from_fire: true,
      };

      const mockAccounts = [
        { id: 'acc-1', name: 'ISA', type: 'investment', include_in_net_worth: true },
      ];

      // High net worth that should exceed coast FIRE target
      const mockBalanceData = [{ account_id: 'acc-1', current_balance: 500000 }];

      mockFrom.mockImplementation((table: string) => {
        if (table === 'fire_inputs') {
          return {
            select: () => ({
              limit: () => ({
                single: () => Promise.resolve({ data: mockInputs, error: null }),
              }),
            }),
          };
        }
        if (table === 'accounts') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({ data: mockAccounts, error: null }),
              }),
            }),
          };
        }
        return { select: mockSelect };
      });

      mockRpc.mockResolvedValue({ data: mockBalanceData, error: null });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.coastFire.isCoastFI).toBe(true);
      expect(data.coastFire.surplus).toBeGreaterThan(0);
      expect(data.coastFire.progress).toBeGreaterThan(100);
    });

    it('calculates isCoastFI false when net worth below coast target', async () => {
      const mockInputs = {
        current_age: 35,
        target_retirement_age: 50,
        annual_spend: 40000,
        withdrawal_rate: 4,
        expected_return: 7,
        exclude_property_from_fire: true,
      };

      const mockAccounts = [
        { id: 'acc-1', name: 'ISA', type: 'investment', include_in_net_worth: true },
      ];

      // Low net worth that should not meet coast FIRE target
      const mockBalanceData = [{ account_id: 'acc-1', current_balance: 100000 }];

      mockFrom.mockImplementation((table: string) => {
        if (table === 'fire_inputs') {
          return {
            select: () => ({
              limit: () => ({
                single: () => Promise.resolve({ data: mockInputs, error: null }),
              }),
            }),
          };
        }
        if (table === 'accounts') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({ data: mockAccounts, error: null }),
              }),
            }),
          };
        }
        return { select: mockSelect };
      });

      mockRpc.mockResolvedValue({ data: mockBalanceData, error: null });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.coastFire.isCoastFI).toBe(false);
      expect(data.coastFire.surplus).toBeLessThan(0);
      expect(data.coastFire.progress).toBeLessThan(100);
    });

    it('excludes property accounts when excludeProperty is true', async () => {
      const mockInputs = {
        current_age: 40,
        target_retirement_age: 55,
        annual_spend: 50000,
        withdrawal_rate: 4,
        expected_return: 7,
        exclude_property_from_fire: true,
      };

      // Property should be filtered out
      const mockAccounts = [
        { id: 'acc-1', name: 'ISA', type: 'investment', include_in_net_worth: true },
        { id: 'acc-2', name: 'House', type: 'property', include_in_net_worth: true },
      ];

      mockFrom.mockImplementation((table: string) => {
        if (table === 'fire_inputs') {
          return {
            select: () => ({
              limit: () => ({
                single: () => Promise.resolve({ data: mockInputs, error: null }),
              }),
            }),
          };
        }
        if (table === 'accounts') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({ data: mockAccounts, error: null }),
              }),
            }),
          };
        }
        return { select: mockSelect };
      });

      // Only non-property account should be fetched
      mockRpc.mockResolvedValue({
        data: [{ account_id: 'acc-1', current_balance: 200000 }],
        error: null,
      });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.coastFire.currentNetWorth).toBe(200000);
      expect(data.inputs.excludeProperty).toBe(true);
    });

    it('returns 500 on accounts fetch error', async () => {
      const mockInputs = {
        current_age: 40,
        target_retirement_age: 55,
        annual_spend: 50000,
        withdrawal_rate: 4,
        expected_return: 7,
      };

      mockFrom.mockImplementation((table: string) => {
        if (table === 'fire_inputs') {
          return {
            select: () => ({
              limit: () => ({
                single: () => Promise.resolve({ data: mockInputs, error: null }),
              }),
            }),
          };
        }
        if (table === 'accounts') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({ data: null, error: { message: 'DB error' } }),
              }),
            }),
          };
        }
        return { select: mockSelect };
      });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch accounts');
    });

    it('uses default values when inputs have nulls', async () => {
      const mockInputs = {
        current_age: null,
        target_retirement_age: null,
        annual_spend: null,
        withdrawal_rate: null,
        expected_return: null,
        exclude_property_from_fire: null,
      };

      mockFrom.mockImplementation((table: string) => {
        if (table === 'fire_inputs') {
          return {
            select: () => ({
              limit: () => ({
                single: () => Promise.resolve({ data: mockInputs, error: null }),
              }),
            }),
          };
        }
        if (table === 'accounts') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({ data: [], error: null }),
              }),
            }),
          };
        }
        return { select: mockSelect };
      });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.inputs.currentAge).toBe(40); // default
      expect(data.inputs.targetRetirementAge).toBe(50); // default
      expect(data.settings.annualSpend).toBe(50000); // default
      expect(data.settings.withdrawalRate).toBe(4); // default
      expect(data.settings.expectedReturn).toBe(7); // default
    });
  });
});
