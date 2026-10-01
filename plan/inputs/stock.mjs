// @ts-check
/**
 * Business Stock valuation (1 Oct 2026). Pure: rows in, valuation out, rules from the assumptions (stock.*).
 * Unsold Hadley Bricks inventory: LISTED units at list value less fees (cost if they have no list value), every
 * other in-stock status at cost, and parted-out stock still on BrickLink at a share of its remaining list value.
 * Backlog units already moved into the BrickLink uploads are excluded so they are not counted twice.
 */

/**
 * @param {{ inStockStatuses: string[], listedStatus: string, listedFeeRate: number, partsShareOfList: number, excludeStorageLocations: string[] }} rules
 * @param {Array<{ status: string, cost: number|null, listing_value: number|null, storage_location?: string|null }>} items
 * @param {Array<{ remaining_price: number|null, remaining_quantity: number|null }>} uploads
 */
export function valueStock(rules, items, uploads) {
  /** @type {Record<string, { units: number, cost: number, list: number, value: number, noCost: number }>} */
  const byStatus = {};
  let excluded = 0, excludedCost = 0;
  for (const it of items) {
    if (!rules.inStockStatuses.includes(it.status)) continue;
    const cost = Number(it.cost ?? 0), list = Number(it.listing_value ?? 0);
    if (it.storage_location && rules.excludeStorageLocations.includes(it.storage_location)) { excluded++; excludedCost += cost; continue; }
    const value = it.status === rules.listedStatus && list > 0 ? list * (1 - rules.listedFeeRate) : cost;
    const s = (byStatus[it.status] ??= { units: 0, cost: 0, list: 0, value: 0, noCost: 0 });
    s.units++; s.cost += cost; s.list += list; s.value += value; if (!(cost > 0)) s.noCost++;
  }
  const live = uploads.filter((u) => Number(u.remaining_quantity ?? 0) > 0);
  const partsList = live.reduce((t, u) => t + Number(u.remaining_price ?? 0), 0);
  const parts = { uploads: live.length, list: partsList, value: partsList * rules.partsShareOfList };
  const items$ = Object.values(byStatus).reduce((t, s) => t + s.value, 0);
  return { byStatus, excluded: { units: excluded, cost: excludedCost }, parts, itemsValue: items$, total: items$ + parts.value };
}
