/**
 * Today's date in the UK (Europe/London), as YYYY-MM-DD.
 * `new Date().toISOString().slice(0, 10)` is the UTC date: between 00:00 and 01:00 BST it is still
 * yesterday, which stamped runs with the wrong date (and could collide with yesterday's run folder)
 * and, on 6 April, used the previous tax year.
 */
export function ukToday(/** @type {Date=} */ now = new Date()) {
  // Built from parts: a locale's whole-date format (e.g. en-CA) has changed across ICU releases.
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = (/** @type {string} */ t) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}
