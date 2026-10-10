/**
 * Monthly balance entry: one request saves the month, upserting on
 * (account_id, date) and leaving accounts that weren't sent untouched.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { createFakeSupabase } from '../helpers/fake-supabase';

const db = vi.hoisted(() => ({ current: null as ReturnType<typeof createFakeSupabase> | null }));
vi.mock('@/lib/supabase/server', () => ({
  get supabaseAdmin() {
    return db.current!.client;
  },
}));

import { POST } from '@/app/api/wealth-snapshots/bulk/route';
import { GET } from '@/app/api/wealth-snapshots/route';

const u = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const [ISA, SIPP, CASH] = [u(1), u(2), u(3)];

const post = (body: unknown) =>
  POST(new NextRequest('http://localhost/api/wealth-snapshots/bulk', { method: 'POST', body: JSON.stringify(body) }));

describe('POST /api/wealth-snapshots/bulk', () => {
  beforeEach(() => {
    db.current = createFakeSupabase({
      accounts: [{ id: ISA, name: 'ISA', type: 'isa' }, { id: SIPP, name: 'SIPP', type: 'pension' }, { id: CASH, name: 'Cash', type: 'savings' }],
      wealth_snapshots: [
        { id: 's1', account_id: ISA, date: '2026-10-01', balance: 100 },
        { id: 's2', account_id: CASH, date: '2026-10-01', balance: 5000 },
      ],
    });
  });

  it('updates changed rows, adds new ones and leaves the rest alone', async () => {
    const res = await post({ date: '2026-10-01', entries: [{ account_id: ISA, balance: 150 }, { account_id: SIPP, balance: 900 }] });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ saved: 2 });
    const rows = db.current!.tables.wealth_snapshots;
    expect(rows).toHaveLength(3);
    expect(rows.find((r) => r.account_id === ISA)).toMatchObject({ id: 's1', balance: 150 });
    expect(rows.find((r) => r.account_id === SIPP)).toMatchObject({ balance: 900, date: '2026-10-01' });
    expect(rows.find((r) => r.account_id === CASH)).toMatchObject({ balance: 5000 });
  });

  it('rejects an empty save and bad input', async () => {
    expect((await post({ date: '2026-10-01', entries: [] })).status).toBe(400);
    expect((await post({ date: '1 Oct', entries: [{ account_id: ISA, balance: 1 }] })).status).toBe(400);
  });
});

describe('GET /api/wealth-snapshots', () => {
  it('returns account_id so the monthly form can match snapshots to accounts', async () => {
    db.current = createFakeSupabase({
      accounts: [{ id: ISA, name: 'ISA', type: 'isa' }],
      wealth_snapshots: [{ id: 's1', account_id: ISA, date: '2026-10-01', balance: 100 }],
    });
    const res = await GET(new NextRequest('http://localhost/api/wealth-snapshots?start_date=2026-10-01&end_date=2026-10-01'));
    const body = await res.json();
    expect(body.snapshots[0]).toMatchObject({ id: 's1', account_id: ISA, balance: 100 });
  });
});
