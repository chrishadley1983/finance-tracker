import { describe, it, expect } from 'vitest';
import { entriesToSave } from '@/components/wealth/MonthlySnapshotForm';

const base = { accountName: 'A', accountType: 'isa' };

describe('entriesToSave', () => {
  it('never saves blank accounts (previously written as £0)', () => {
    expect(entriesToSave([{ ...base, accountId: 'a', balance: null }])).toEqual([]);
  });

  it('saves new values, including ones carried from last month', () => {
    const e = [
      { ...base, accountId: 'a', balance: 120, previousBalance: 120, carried: true },
      { ...base, accountId: 'b', balance: 50 },
    ];
    expect(entriesToSave(e).map((x) => x.accountId)).toEqual(['a', 'b']);
  });

  it('skips saved balances that did not change', () => {
    const e = [
      { ...base, accountId: 'a', balance: 100, savedBalance: 100, existingSnapshotId: 's1' },
      { ...base, accountId: 'b', balance: 75, savedBalance: 70, existingSnapshotId: 's2' },
    ];
    expect(entriesToSave(e).map((x) => x.accountId)).toEqual(['b']);
  });
});
