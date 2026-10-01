/**
 * Business Stock valuation (1 Oct 2026, Chris's rules): LISTED at list value less fees (cost if no list value),
 * other in-stock statuses at cost, BrickLink parts at a share of remaining list value, backlog already moved to
 * BrickLink excluded. Rules come from plan/assumptions.json (stock.*).
 */
import { describe, it, expect } from 'vitest';
import { valueStock } from '../../../plan/inputs/stock.mjs';
import assumptionsFile from '../../../plan/assumptions.json';

const e = assumptionsFile.entries as unknown as Record<string, { value: unknown }>;
const rules = { inStockStatuses: e['stock.inStockStatuses'].value as string[], listedStatus: e['stock.listedStatus'].value as string, listedFeeRate: e['stock.listedFeeRate'].value as number, partsShareOfList: e['stock.partsShareOfList'].value as number, excludeStorageLocations: e['stock.excludeStorageLocations'].value as string[] };

describe('Business Stock valuation', () => {
  it('values listed at list less 18%, everything else in stock at cost, parts at 33% of list', () => {
    const v = valueStock(rules, [
      { status: 'LISTED', cost: 10, listing_value: 100 },        // 82
      { status: 'LISTED', cost: 7, listing_value: null },         // no list value → cost 7
      { status: 'BACKLOG', cost: 20, listing_value: 50 },         // cost 20
      { status: 'BACKLOG', cost: 5, listing_value: 9, storage_location: 'MOVED TO BL' }, // excluded
      { status: 'PART OUT', cost: 3, listing_value: 8 },          // cost 3
      { status: 'SOLD', cost: 99, listing_value: 999 },           // not in stock
    ], [{ remaining_price: 300, remaining_quantity: 4 }, { remaining_price: 50, remaining_quantity: 0 }]);
    expect(v.byStatus.LISTED.value).toBeCloseTo(89, 6);
    expect(v.byStatus.BACKLOG.value).toBe(20);
    expect(v.byStatus['PART OUT'].value).toBe(3);
    expect(v.byStatus.SOLD).toBeUndefined();
    expect(v.excluded).toEqual({ units: 1, cost: 5 });
    expect(v.parts).toEqual({ uploads: 1, list: 300, value: 99 });
    expect(v.total).toBeCloseTo(89 + 20 + 3 + 99, 6);
  });
  it('the rules are the 1 Oct 2026 decisions', () => {
    expect(rules.listedFeeRate).toBe(0.18);
    expect(rules.partsShareOfList).toBe(0.33);
    expect(rules.inStockStatuses).toEqual(['NOT YET RECEIVED', 'BACKLOG', 'LISTED', 'PART OUT', 'RETURNED']);
  });
});
