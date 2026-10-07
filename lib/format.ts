/**
 * Shared display formatters (currency, percentages, month names, dates).
 *
 * Pure functions with no React or server-only imports, so this module is safe
 * to use from client components, server components, API routes and lib code.
 */

export interface FormatGBPOptions {
  /** Show pence (2 fraction digits). Default false: whole pounds (0 fraction digits). */
  pence?: boolean;
  /** Prefix positive values with '+' (zero stays unsigned). Default false. */
  signed?: boolean;
}

const gbpFormatters = new Map<string, Intl.NumberFormat>();

function getGBPFormatter(pence: boolean, signed: boolean): Intl.NumberFormat {
  const key = `${pence ? 1 : 0}${signed ? 1 : 0}`;
  let formatter = gbpFormatters.get(key);
  if (!formatter) {
    const digits = pence ? 2 : 0;
    formatter = new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
      ...(signed ? { signDisplay: 'exceptZero' as const } : {}),
    });
    gbpFormatters.set(key, formatter);
  }
  return formatter;
}

/**
 * Format an amount as GBP, e.g. formatGBP(1234.5) => "£1,235",
 * formatGBP(1234.5, { pence: true }) => "£1,234.50", formatGBP(-5) => "-£5".
 */
export function formatGBP(amount: number, opts?: FormatGBPOptions): string {
  return getGBPFormatter(opts?.pence ?? false, opts?.signed ?? false).format(amount);
}

/**
 * Compact GBP for chart axes and labels: "£1.2M", "£450k", "£999".
 * Values below £1,000 (including negatives) are shown as whole pounds via toFixed.
 */
export function formatGBPCompact(amount: number): string {
  if (amount >= 1000000) {
    return `£${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `£${(amount / 1000).toFixed(0)}k`;
  }
  return `£${amount.toFixed(0)}`;
}

/** Format a value that is already a percentage, e.g. formatPercent(4.256) => "4.26%". */
export function formatPercent(value: number, digits: number = 2): string {
  return `${value.toFixed(digits)}%`;
}

/** Full month names, January-first (index 0 = January). */
export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

/** Three-letter month names, January-first (index 0 = Jan). */
export const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

/** en-GB date as "d MMM yyyy", e.g. "5 Mar 2025". */
export function formatDateGB(date: string | number | Date): string {
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Short calendar day from an ISO date (YYYY-MM-DD), e.g. "16 Oct". Parsed as a
 * calendar day, so it never shifts with the time zone.
 */
export function formatDayMonth(isoDate: string): string {
  const [, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  return `${d} ${MONTH_SHORT[m - 1]}`;
}

/** en-GB date as "dd MMM yyyy", e.g. "05 Mar 2025". */
export function formatDateGBPadded(date: string | number | Date): string {
  return new Date(date).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/**
 * Day heading for grouped lists, e.g. "Tue 7 October" (the year is added
 * when it is not the current year: "Mon 30 December 2024").
 * Takes an ISO date (YYYY-MM-DD) and treats it as a calendar day.
 */
export function formatDayHeading(isoDate: string, now: Date = new Date()): string {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  const weekday = WEEKDAY_SHORT[new Date(y, m - 1, d).getDay()];
  const base = `${weekday} ${d} ${MONTH_NAMES[m - 1]}`;
  return y === now.getFullYear() ? base : `${base} ${y}`;
}
