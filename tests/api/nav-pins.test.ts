import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { createFakeSupabase } from '../helpers/fake-supabase';

const db = vi.hoisted(() => ({ current: null as ReturnType<typeof createFakeSupabase> | null }));
vi.mock('@/lib/supabase/server', () => ({
  get supabaseAdmin() {
    return db.current!.client;
  },
}));

import { GET, POST, DELETE } from '@/app/api/nav-pins/route';

const post = (body: unknown) =>
  POST(new NextRequest('http://localhost/api/nav-pins', { method: 'POST', body: JSON.stringify(body) }));

describe('/api/nav-pins', () => {
  beforeEach(() => {
    db.current = createFakeSupabase({ nav_pins: [] });
  });

  it('pins pages in order, re-pinning updates the label instead of duplicating', async () => {
    expect((await post({ href: '/budgets', label: 'Budgets' })).status).toBe(201);
    await post({ href: '/reports', label: 'Reports' });
    await post({ href: '/budgets', label: 'October budget' });
    const { pins } = await (await GET()).json();
    expect(pins.map((p: { href: string; label: string }) => [p.href, p.label])).toEqual([
      ['/budgets', 'October budget'],
      ['/reports', 'Reports'],
    ]);
  });

  it('only accepts in-app paths', async () => {
    expect((await post({ href: 'https://evil.example', label: 'x' })).status).toBe(400);
    expect((await post({ href: '//evil.example', label: 'x' })).status).toBe(400);
    expect((await post({ href: '/ok', label: '' })).status).toBe(400);
  });

  it('unpins by href', async () => {
    await post({ href: '/budgets', label: 'Budgets' });
    const res = await DELETE(new NextRequest('http://localhost/api/nav-pins?href=%2Fbudgets', { method: 'DELETE' }));
    expect(res.status).toBe(204);
    expect(db.current!.tables.nav_pins).toHaveLength(0);
  });
});
