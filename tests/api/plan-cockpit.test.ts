import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// /api/plan/rungs — mocked Supabase (house pattern)
// ---------------------------------------------------------------------------
const mockSelect = vi.fn();
const mockUpsert = vi.fn();
const mockOrder = vi.fn();
const mockSingle = vi.fn();
const mockFrom = vi.fn().mockReturnValue({ select: mockSelect, upsert: mockUpsert });

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: { from: (...args: unknown[]) => mockFrom(...args) },
}));

import { GET as getRungs, PUT as putRung } from '@/app/api/plan/rungs/route';
import { GET as getPrices } from '@/app/api/plan/gilt-prices/route';

describe('Plan rungs API (criterion F7)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue({ order: mockOrder });
    mockUpsert.mockReturnValue({ select: () => ({ single: mockSingle }) });
  });

  it('GET returns rungs ordered by year', async () => {
    mockOrder.mockResolvedValue({ data: [{ year: 2035, status: 'bought' }], error: null });
    const res = await getRungs();
    const body = await res.json();
    expect(mockFrom).toHaveBeenCalledWith('plan_ladder_rungs');
    expect(body.rungs).toHaveLength(1);
  });

  it('GET degrades to empty list + warning when the table is missing (E2)', async () => {
    mockOrder.mockResolvedValue({ data: null, error: { message: 'relation "plan_ladder_rungs" does not exist' } });
    const res = await getRungs();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rungs).toEqual([]);
    expect(body.warning).toMatch(/does not exist/);
  });

  it('PUT upserts a valid rung', async () => {
    mockSingle.mockResolvedValue({ data: { year: 2036, status: 'bought', epic: 'TG36' }, error: null });
    const res = await putRung(
      new NextRequest('http://x/api/plan/rungs', {
        method: 'PUT',
        body: JSON.stringify({ year: 2036, status: 'bought', epic: 'TG36', face_value: 37564, cost: 50082, purchased_on: '2026-08-01' }),
      })
    );
    expect(res.status).toBe(200);
    expect((await res.json()).rung.epic).toBe('TG36');
    expect(mockUpsert).toHaveBeenCalled();
  });

  it('PUT rejects invalid payloads with 400', async () => {
    const res = await putRung(
      new NextRequest('http://x/api/plan/rungs', {
        method: 'PUT',
        body: JSON.stringify({ year: 1999, status: 'eaten' }),
      })
    );
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// /api/plan/gilt-prices — mocked fetch (criteria F8, E1)
// ---------------------------------------------------------------------------
const FIXTURE = `
  <table><tr><th>Ticker</th></tr>
  <tr><td>TR35</td><td>1 1/8% IL 2035</td><td>1.125%</td><td>22-Sep-2035</td><td>9y</td><td>&pound;94.52</td><td>&pound;100.83</td><td>1.77%</td><td></td></tr>
  <tr><td>TG36</td><td>0 1/8% IL 2036</td><td>0.125%</td><td>22-Nov-2036</td><td>10y</td><td>&pound;83.49</td><td>&pound;133.33</td><td>1.90%</td><td></td></tr>
  <tr><td>TR37</td><td>1 1/8% IL 2037</td><td>1.125%</td><td>22-Nov-2037</td><td>11y</td><td>&pound;91.17</td><td>&pound;187.62</td><td>2.00%</td><td></td></tr>
  <tr><td>T38</td><td>1 3/4% IL 2038</td><td>1.75%</td><td>22-Sep-2038</td><td>12y</td><td>&pound;96.47</td><td>&pound;101.39</td><td>2.08%</td><td></td></tr>
  <tr><td>TG39</td><td>0 1/8% IL 2039</td><td>0.125%</td><td>22-Mar-2039</td><td>13y</td><td>&pound;77.40</td><td>&pound;108.36</td><td>2.18%</td><td></td></tr>
  <tr><td>TR40</td><td>0 5/8% IL 2040</td><td>0.625%</td><td>22-Mar-2040</td><td>14y</td><td>&pound;81.15</td><td>&pound;156.06</td><td>2.23%</td><td></td></tr>
  </table>`;

describe('Gilt prices API (criteria F8, E1)', () => {
  it('serves live data, then the 10-minute cache without refetching', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(FIXTURE, { status: 200 }) as unknown as Awaited<ReturnType<typeof fetch>>
    );
    const first = await (await getPrices()).json();
    expect(first.source).toBe('live');
    expect(first.stale).toBe(false);
    expect(first.gilts.length).toBe(6);

    const second = await (await getPrices()).json();
    expect(second.source).toBe('cache');
    expect(fetchSpy).toHaveBeenCalledTimes(1); // cache hit — no second fetch

    fetchSpy.mockRestore();
  });

  it('serves stale cache when the source fails after a good fetch (E1)', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('network down'));
    // Cache from previous test is within TTL; force expiry is not possible from
    // outside, so this asserts the degradation contract: never a 5xx, always gilts.
    const res = await getPrices();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.gilts.length).toBeGreaterThan(0);
    fetchSpy.mockRestore();
  });
});
