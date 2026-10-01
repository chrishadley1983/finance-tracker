// @ts-check
/**
 * Gilt holdings (1 Oct 2026). The newest file in plan/observations/holdings/ lists the index-linked gilts each
 * account holds, in units (= £ nominal). Platforms such as ii show linkers at the clean price with no index
 * ratio; the true value of a holding is units × the dirty price / 100 (the dirty price carries the inflation
 * uplift and accrued interest). `valueHoldings` is pure; `newestHoldings` reads the file.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'observations', 'holdings');

/** @returns {{ file: string, data: { asOf: string, source: string, accounts: Record<string, Array<{ epic: string, units: number }>> } } | null} */
export function newestHoldings() {
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  if (!files.length) return null;
  const file = files[files.length - 1];
  return { file, data: JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')) };
}

/**
 * @param {Record<string, Array<{ epic: string, units: number }>>} accounts
 * @param {Array<{ epic: string, name: string, clean: number, dirty: number, realYield: number }>} gilts  price rows
 * @param {Record<string, number>} [other]  per account: everything else in it (cash, funds), as the platform shows it
 */
export function valueHoldings(accounts, gilts, other = {}) {
  const price = Object.fromEntries(gilts.map((g) => [g.epic, g]));
  const missing = /** @type {string[]} */ ([]);
  const out = Object.entries(accounts).map(([account, lines]) => {
    const rows = lines.map((l) => {
      const g = price[l.epic];
      if (!g) { missing.push(l.epic); return { epic: l.epic, name: '', units: l.units, clean: NaN, dirty: NaN, indexRatio: NaN, value: NaN, cleanValue: NaN }; }
      return { epic: l.epic, name: g.name, units: l.units, clean: g.clean, dirty: g.dirty, indexRatio: g.dirty / g.clean, value: (l.units * g.dirty) / 100, cleanValue: (l.units * g.clean) / 100 };
    });
    const gilts = rows.reduce((s, r) => s + r.value, 0);
    const cleanOnly = rows.reduce((s, r) => s + r.cleanValue, 0);
    const extra = other[account];
    return { account, rows, gilts, cleanOnly, other: extra ?? null, total: extra === undefined ? null : gilts + extra };
  });
  return { accounts: out, missing };
}
