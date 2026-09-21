// @ts-check
/**
 * Number formatting shared by every renderer. Formatting is the only thing a
 * renderer may do to a number: no arithmetic, no literals (see render.mjs).
 */

/** £1,234 (whole pounds) */
export const gbp = (/** @type {number} */ n) => (n < 0 ? '−' : '') + '£' + Math.round(Math.abs(n)).toLocaleString('en-GB');
/** £98.7k / £2.28M from a value in POUNDS */
export const gbpShort = (/** @type {number} */ n) => {
  const s = n < 0 ? '−' : '';
  const v = Math.abs(n);
  if (v >= 1e6) return s + '£' + (v / 1e6).toFixed(2) + 'M';
  if (v >= 1e4) return s + '£' + Math.round(v / 1e3) + 'k';
  if (v >= 1e3) return s + '£' + (v / 1e3).toFixed(1) + 'k';
  return s + '£' + Math.round(v);
};
/** from a value in £k (the ledger's unit): 2284.3 → £2.28M, 98.7 → £98.7k */
export const gbpFromK = (/** @type {number} */ k) => gbpShort(k * 1000);
/** ledger cell: whole £k with thousands separators, '–' for zero/undefined */
export const kCell = (/** @type {number|undefined|null} */ k) => (k === undefined || k === null || Math.abs(k) < 0.5 ? '–' : Math.round(k).toLocaleString('en-GB'));
export const k1 = (/** @type {number} */ k) => k.toFixed(1);
/** ledger tax cell: one decimal, '–' below the display threshold (0.05 £k) */
export const kTax = (/** @type {number} */ k) => (k >= 0.05 ? k.toFixed(1) : '–');
export const pct = (/** @type {number} */ x, dp = 1) => (x * 100).toFixed(dp) + '%';
export const pctPoints = (/** @type {number} */ p, dp = 2) => p.toFixed(dp) + '%';
export const int = (/** @type {number} */ n) => Math.round(n).toLocaleString('en-GB');
export const dec = (/** @type {number} */ n, dp = 2) => n.toFixed(dp);
export const dateGB = (/** @type {string} */ iso) => { const [y, m, d] = iso.slice(0, 10).split('-').map(Number); return `${d} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]} ${y}`; };
export const yr = (/** @type {number} */ y) => String(y);
