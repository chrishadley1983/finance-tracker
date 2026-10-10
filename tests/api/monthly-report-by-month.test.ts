/** GET /api/monthly-reports/YYYY-MM: one saved report's HTML and metadata. */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { createFakeSupabase } from '../helpers/fake-supabase';

const db = vi.hoisted(() => ({ current: null as ReturnType<typeof createFakeSupabase> | null, user: true as boolean }));
vi.mock('@/lib/supabase/server', () => ({
  get supabaseAdmin() {
    return db.current!.client;
  },
  createAuthClient: async () => ({ auth: { getUser: async () => ({ data: { user: db.user ? { id: 'u' } : null } }) } }),
}));

import { GET } from '@/app/api/monthly-reports/[month]/route';

const call = (month: string) =>
  GET(new NextRequest(`http://localhost/api/monthly-reports/${month}`), { params: Promise.resolve({ month }) });

beforeEach(() => {
  db.user = true;
  db.current = createFakeSupabase({
    monthly_reports: [
      { year: 2026, month: 9, report_html: '<html>Sept</html>', report_data: { savings_rate: 31 }, generated_at: '2026-10-03T08:12:00Z' },
    ],
  });
});

describe('GET /api/monthly-reports/[month]', () => {
  it('returns the stored report', async () => {
    const res = await call('2026-09');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      year: 2026,
      month: 9,
      generatedAt: '2026-10-03T08:12:00Z',
      reportData: { savings_rate: 31 },
      html: '<html>Sept</html>',
    });
  });
  it('404s when none is saved', async () => {
    expect((await call('2026-08')).status).toBe(404);
  });
  it('400s on a malformed month', async () => {
    expect((await call('2026-9')).status).toBe(400);
    expect((await call('2026-13')).status).toBe(400);
  });
  it('requires a signed-in user', async () => {
    db.user = false;
    expect((await call('2026-09')).status).toBe(401);
  });
});
