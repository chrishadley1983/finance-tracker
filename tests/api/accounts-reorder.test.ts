import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const updates: { values: unknown; id: unknown }[] = [];
let failId: string | null = null;

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: {
    from: () => ({
      update: (values: unknown) => ({
        eq: (_col: string, id: string) => {
          updates.push({ values, id });
          return Promise.resolve({ data: null, error: id === failId ? { message: 'boom' } : null });
        },
      }),
    }),
  },
}));

import { POST } from '@/app/api/accounts/reorder/route';

const A = '550e8400-e29b-41d4-a716-446655440001';
const B = '550e8400-e29b-41d4-a716-446655440002';
const post = (body: unknown) =>
  new NextRequest('http://localhost/api/accounts/reorder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

describe('POST /api/accounts/reorder', () => {
  beforeEach(() => {
    updates.length = 0;
    failId = null;
  });

  it('sets each sort_order', async () => {
    const res = await POST(post({ accounts: [{ id: A, sort_order: 1 }, { id: B, sort_order: 0 }] }));
    expect(res.status).toBe(200);
    expect(updates).toEqual([
      { values: { sort_order: 1 }, id: A },
      { values: { sort_order: 0 }, id: B },
    ]);
  });

  it('returns 500 with the failed ids when an update fails', async () => {
    failId = B;
    const res = await POST(post({ accounts: [{ id: A, sort_order: 1 }, { id: B, sort_order: 0 }] }));
    expect(res.status).toBe(500);
    expect((await res.json()).failed).toEqual([B]);
  });

  it('rejects bad input', async () => {
    expect((await POST(post({ accounts: [{ id: 'x', sort_order: 1 }] }))).status).toBe(400);
    expect((await POST(post('{nope'))).status).toBe(400);
  });
});
