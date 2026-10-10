/**
 * Today's date in the UK (Europe/London), as YYYY-MM-DD.
 * `new Date().toISOString().slice(0, 10)` is the UTC date: between 00:00 and 01:00 BST it is still
 * yesterday, which stamped runs with the wrong date (and could collide with yesterday's run folder)
 * and, on 6 April, used the previous tax year.
 */
export function ukToday(/** @type {Date=} */ now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
