/**
 * Rules edited from the Categories page: "Test" uses the engine's matcher,
 * and create/update/delete leave an audit trail like the automated paths.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFakeSupabase } from '../../helpers/fake-supabase';

const db = vi.hoisted(() => ({ current: null as ReturnType<typeof createFakeSupabase> | null }));
vi.mock('@/lib/supabase/server', () => ({
  get supabaseAdmin() {
    return db.current!.client;
  },
}));

import { testRule, createRule, updateRule, deleteRule } from '@/lib/categorisation/rules-manager';

const GROC = 'cat-groceries';
const FUN = 'cat-fun';

beforeEach(() => {
  db.current = createFakeSupabase({
    categories: [{ id: GROC, name: 'Groceries' }, { id: FUN, name: 'Fun' }],
    transactions: [
      { id: 't1', date: '2026-10-01', description: 'ALDI STORES 123', amount: -20, account_id: 'a', category_id: null },
      { id: 't2', date: '2026-10-02', description: 'VIVALDI RESTAURANT', amount: -50, account_id: 'a', category_id: FUN },
      { id: 't3', date: '2026-10-03', description: 'Aldi', amount: -5, account_id: 'a', category_id: GROC },
    ],
    category_mappings: [],
    category_rule_events: [],
  });
});

describe('testRule', () => {
  it('matches on whole words like the engine ("aldi" does not hit "vivaldi")', async () => {
    const r = await testRule('aldi', 'contains', GROC);
    expect(r.transactions.map((t) => t.id).sort()).toEqual(['t1', 't3']);
    expect(r.totalMatched).toBe(2);
    expect(r.wouldChange).toBe(1);
  });
});

describe('rule audit trail', () => {
  it('logs created, repointed and deleted events from the UI', async () => {
    const rule = await createRule({ pattern: 'aldi', categoryId: GROC, matchType: 'contains' });
    expect(rule).not.toBeNull();
    await updateRule(rule!.id, { categoryId: FUN });
    await deleteRule(rule!.id);
    const events = db.current!.tables.category_rule_events.map((e) => [e.event, e.source, e.old_category_id, e.new_category_id]);
    expect(events).toEqual([
      ['created', 'ui', null, GROC],
      ['repointed', 'ui', GROC, FUN],
      ['deleted', 'ui', FUN, null],
    ]);
  });
});
