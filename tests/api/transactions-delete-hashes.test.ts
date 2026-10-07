/**
 * Deleting one imported transaction must remove its import hash first: the
 * live FK has no ON DELETE CASCADE, so the delete would otherwise fail.
 */
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createFakeSupabase } from '../helpers/fake-supabase';

const db = vi.hoisted(() => ({ current: null as ReturnType<typeof createFakeSupabase> | null }));
vi.mock('@/lib/supabase/server', () => ({
  get supabaseAdmin() {
    return db.current!.client;
  },
}));

import { DELETE } from '@/app/api/transactions/[id]/route';

describe('DELETE /api/transactions/[id]', () => {
  it('removes the import hash rows along with the transaction', async () => {
    db.current = createFakeSupabase({
      transactions: [{ id: 't1' }, { id: 't2' }],
      imported_transaction_hashes: [
        { id: 'h1', transaction_id: 't1', hash: 'a' },
        { id: 'h2', transaction_id: 't2', hash: 'b' },
      ],
    });
    const res = await DELETE(new NextRequest('http://localhost/api/transactions/t1', { method: 'DELETE' }), {
      params: Promise.resolve({ id: 't1' }),
    } as never);
    expect(res.status).toBe(204);
    expect(db.current.tables.transactions.map((t) => t.id)).toEqual(['t2']);
    expect(db.current.tables.imported_transaction_hashes.map((h) => h.id)).toEqual(['h2']);
  });
});
