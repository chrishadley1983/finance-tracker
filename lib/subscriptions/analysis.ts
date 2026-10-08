/**
 * Subscriptions: cost maths and the checks against real bank transactions.
 *
 * Pure functions (no I/O) so the API route stays thin and the rules are testable.
 * Ported from the Peter Dashboard's subscriptions health check (moved here 6 Oct 2026),
 * with one addition: a cancelled or paused subscription that is still being charged.
 *
 * Variable-amount subscriptions (usage billing, or an amount stored as an average, e.g. council tax
 * over 10 months) are checked on their last 12 months' total rather than on the last single charge.
 * Seasonal ones (a summer gardener) cost like active ones but are never chased for missing charges.
 */

import { formatDayMonth } from '@/lib/format';

export const FREQUENCIES = ['weekly', 'fortnightly', 'monthly', 'quarterly', 'termly', 'half_termly', 'annual'] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export const SCOPES = ['personal', 'business'] as const;
export const STATUSES = ['active', 'seasonal', 'paused', 'cancelled', 'trial'] as const;

/** Statuses whose cost counts toward the totals. */
export const COSTED_STATUSES: readonly string[] = ['active', 'seasonal'];

export function isCosted(status: string | null | undefined): boolean {
  return COSTED_STATUSES.includes(status ?? 'active');
}

const PER_YEAR: Record<Frequency, number> = {
  weekly: 52,
  fortnightly: 26,
  monthly: 12,
  quarterly: 4,
  termly: 3,
  half_termly: 6,
  annual: 1,
};

/** Longest normal gap between charges before a payment counts as missing. */
const EXPECTED_GAP_DAYS: Record<Frequency, number> = {
  weekly: 10,
  fortnightly: 20,
  monthly: 45,
  quarterly: 105,
  termly: 140,
  half_termly: 70, // a half term of ~7 weeks plus a 2-week holiday
  annual: 400,
};

/** Approximate period, used only to project the next charge from the last one. */
const PERIOD_DAYS: Record<Frequency, number> = {
  weekly: 7,
  fortnightly: 14,
  monthly: 30,
  quarterly: 91,
  termly: 122,
  half_termly: 61,
  annual: 365,
};

/** A charge more than this far from the stored amount counts as a price change (allows for FX). */
export const PRICE_TOLERANCE = 0.1;

/** A variable-amount subscription whose last-12-months total is this far from its annual cost is flagged. */
export const VARIABLE_TOLERANCE = 0.15;

/** The 12-month window used for variable-amount subscriptions. */
export const VARIABLE_WINDOW_DAYS = 365;

/** A variable-amount subscription needs a charge at least this old before its 12-month total is trusted. */
export const VARIABLE_MIN_HISTORY_DAYS = 330;

/** A cancelled or paused subscription charged within this many days is flagged. */
export const STILL_CHARGING_DAYS = 45;

/** Cancellation deadlines within this many days are flagged. */
export const CANCEL_WINDOW_DAYS = 14;

function asFrequency(f: string | null | undefined): Frequency {
  return (FREQUENCIES as readonly string[]).includes(f ?? '') ? (f as Frequency) : 'monthly';
}

export function annualCost(amount: number, frequency: string): number {
  return Math.abs(amount) * PER_YEAR[asFrequency(frequency)];
}

export function monthlyCost(amount: number, frequency: string): number {
  return annualCost(amount, frequency) / 12;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Today's date in the UK, as YYYY-MM-DD. */
export function ukToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(now);
}

/** Whole days from a to b (ISO dates, UTC midnight). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

export function addDays(iso: string, days: number): string {
  return new Date(Date.parse(iso) + days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * The usable part of a stored bank pattern, or null if none. A '*' inside is a wildcard
 * ("PAYPAL *NETFLIX"); leading and trailing ones are dropped, as the match is a substring anyway.
 */
export function cleanPattern(pattern: string | null | undefined): string | null {
  const clean = (pattern ?? '').trim().replace(/^[\s*]+|[\s*]+$/g, '');
  return clean.length > 0 ? clean : null;
}

/** Escape LIKE wildcards so a pattern is matched literally inside %…%. */
export function likeLiteral(text: string): string {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** A cleaned pattern as a LIKE body (wrap in %…%): '*' matches anything, everything else literally. */
export function likePattern(pattern: string): string {
  return pattern.split('*').map(likeLiteral).join('%');
}

/** Whether `text` contains `pattern` (case-insensitive, '*' matches anything): the in-memory twin of likePattern. */
export function patternMatches(pattern: string, text: string): boolean {
  const body = pattern
    .split('*')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(body, 'i').test(text);
}

export interface SubscriptionRow {
  id: string;
  name: string;
  provider: string | null;
  scope: string;
  category: string | null;
  amount: number;
  currency: string | null;
  frequency: string;
  next_renewal_date: string | null;
  cancellation_notice_days: number | null;
  bank_description_pattern: string | null;
  status: string | null;
  payment_method: string | null;
  plan_tier: string | null;
  notes: string | null;
  url: string | null;
  auto_renew: boolean | null;
  billing_day: number | null;
  start_date: string | null;
  end_date: string | null;
  /** True when charges vary (usage billing, an averaged amount): checked on the 12-month total. */
  variable_amount?: boolean | null;
}

export interface Charge {
  date: string;
  amount: number; // negative = money out
  description: string;
}

export type SignalType =
  | 'still_charging'
  | 'missed_payment'
  | 'price_change'
  | 'cancel_window'
  | 'no_charges_found'
  | 'no_bank_pattern';

export interface Signal {
  type: SignalType;
  message: string;
}

export interface AssessedSubscription extends SubscriptionRow {
  monthly_cost: number;
  annual_cost: number;
  last_charged: string | null;
  last_amount: number | null;
  /** Variable-amount only: total of matching charges in the last 12 months, when there's enough history. */
  twelve_month_total: number | null;
  charges_found: number;
  next_due: string | null;
  next_due_source: 'renewal_date' | 'projected' | null;
  signals: Signal[];
}

const gbp = (n: number) => `£${n.toFixed(2)}`;

/**
 * Check one subscription against its matching charges (newest first) as of `today` (YYYY-MM-DD).
 */
export function assessSubscription(sub: SubscriptionRow, charges: Charge[], today: string): AssessedSubscription {
  const frequency = asFrequency(sub.frequency);
  const stored = Math.abs(Number(sub.amount));
  const status = sub.status ?? 'active';
  const pattern = cleanPattern(sub.bank_description_pattern);
  const latest = charges[0] ?? null;
  const signals: Signal[] = [];

  const lastCharged = latest ? latest.date : null;
  const lastAmount = latest ? round2(Math.abs(latest.amount)) : null;

  let twelveMonthTotal: number | null = null;
  if (sub.variable_amount && charges.length > 0) {
    const oldest = charges[charges.length - 1];
    if (daysBetween(oldest.date, today) >= VARIABLE_MIN_HISTORY_DAYS) {
      const since = addDays(today, -VARIABLE_WINDOW_DAYS);
      twelveMonthTotal = round2(charges.filter((c) => c.date > since).reduce((t, c) => t + Math.abs(c.amount), 0));
    }
  }

  if (status === 'cancelled' || status === 'paused') {
    if (latest && daysBetween(latest.date, today) <= STILL_CHARGING_DAYS) {
      signals.push({
        type: 'still_charging',
        message: `Marked ${status} but charged ${gbp(lastAmount!)} on ${latest.date}`,
      });
    }
  } else {
    if (!pattern) {
      signals.push({ type: 'no_bank_pattern', message: 'No bank description pattern, so charges can’t be checked' });
    } else if (!latest) {
      signals.push({ type: 'no_charges_found', message: 'No matching charge in the last 400 days' });
    } else {
      if (sub.variable_amount) {
        // Too little history to total a year: skip rather than false-flag.
        const expected = annualCost(stored, frequency);
        if (twelveMonthTotal !== null && expected > 0 && Math.abs(twelveMonthTotal - expected) / expected > VARIABLE_TOLERANCE) {
          signals.push({
            type: 'price_change',
            message: `Last 12 months ${gbp(twelveMonthTotal)} vs ${gbp(expected)} expected`,
          });
        }
      } else if (stored > 0 && Math.abs(lastAmount! - stored) / stored > PRICE_TOLERANCE) {
        signals.push({
          type: 'price_change',
          message: `Last charge ${gbp(lastAmount!)} vs ${gbp(stored)} recorded`,
        });
      }
      const since = daysBetween(latest.date, today);
      const gap = EXPECTED_GAP_DAYS[frequency];
      // A seasonal subscription goes quiet out of season, so a gap isn't a missed payment.
      if (status !== 'seasonal' && since > gap) {
        signals.push({
          type: 'missed_payment',
          message: `No charge for ${since} days (expected within ${gap})`,
        });
      }
    }

    if (sub.cancellation_notice_days && sub.next_renewal_date) {
      const deadline = addDays(sub.next_renewal_date, -sub.cancellation_notice_days);
      const until = daysBetween(today, deadline);
      if (until >= 0 && until <= CANCEL_WINDOW_DAYS) {
        signals.push({
          type: 'cancel_window',
          message: `Cancel by ${formatDayMonth(deadline)} to stop the ${formatDayMonth(sub.next_renewal_date)} renewal`,
        });
      }
    }
  }

  let nextDue: string | null = null;
  let nextDueSource: AssessedSubscription['next_due_source'] = null;
  // Seasonal ones only show a set renewal date: projecting from the last charge would run out of season.
  if (status === 'active' || status === 'trial' || status === 'seasonal') {
    if (sub.next_renewal_date && sub.next_renewal_date >= today) {
      nextDue = sub.next_renewal_date;
      nextDueSource = 'renewal_date';
    } else if (status !== 'seasonal' && latest && !signals.some((x) => x.type === 'missed_payment')) {
      // A subscription that has stopped charging has no believable next date, so none is projected.
      let projected = addDays(latest.date, PERIOD_DAYS[frequency]);
      // Roll forward past today so a slightly late charge still shows the next one.
      for (let i = 0; i < 24 && projected < today; i++) projected = addDays(projected, PERIOD_DAYS[frequency]);
      nextDue = projected;
      nextDueSource = 'projected';
    }
  }

  return {
    ...sub,
    amount: Number(sub.amount),
    monthly_cost: round2(monthlyCost(stored, frequency)),
    annual_cost: round2(annualCost(stored, frequency)),
    last_charged: lastCharged,
    last_amount: lastAmount,
    twelve_month_total: twelveMonthTotal,
    charges_found: charges.length,
    next_due: nextDue,
    next_due_source: nextDueSource,
    signals,
  };
}

export interface Summary {
  active_count: number;
  total_count: number;
  monthly: number;
  annual: number;
  personal_monthly: number;
  business_monthly: number;
  by_category: { category: string; count: number; monthly: number }[];
  needs_attention: number;
}

export function summarise(subs: AssessedSubscription[]): Summary {
  const active = subs.filter((s) => isCosted(s.status));
  const sum = (rows: AssessedSubscription[]) => round2(rows.reduce((t, s) => t + monthlyCost(s.amount, s.frequency), 0));
  const cats = new Map<string, { count: number; monthly: number }>();
  for (const s of active) {
    const key = s.category || 'Uncategorised';
    const c = cats.get(key) ?? { count: 0, monthly: 0 };
    c.count += 1;
    c.monthly += monthlyCost(s.amount, s.frequency);
    cats.set(key, c);
  }
  return {
    active_count: active.length,
    total_count: subs.length,
    monthly: sum(active),
    annual: round2(active.reduce((t, s) => t + annualCost(s.amount, s.frequency), 0)),
    personal_monthly: sum(active.filter((s) => s.scope === 'personal')),
    business_monthly: sum(active.filter((s) => s.scope === 'business')),
    by_category: Array.from(cats.entries())
      .map(([category, c]) => ({ category, count: c.count, monthly: round2(c.monthly) }))
      .sort((a, b) => b.monthly - a.monthly),
    needs_attention: subs.filter((s) => s.signals.some((x) => x.type !== 'no_bank_pattern')).length,
  };
}

/** Merchants that repeat but aren't subscriptions (shops, food, travel, fees, transfers). */
export const NOT_SUBSCRIPTIONS = [
  'aldi', 'tesco', 'sainsbury', 'lidl', 'asda', 'waitrose', 'co-op',
  'morrisons', 'marks and spencer', 'm&s', 'ocado',
  'pret a manger', 'costa', 'starbucks', 'greggs', 'mcdonalds',
  'nandos', 'pizza', 'burger', 'kitchen', 'restaurant', 'cafe',
  'bar ', 'pub ', 'deli', 'bakery', 'chippy',
  'tfl travel', 'ringgo', 'parking', 'petrol', 'shell', 'bp ',
  'amazon marketplace', 'amazon.co.uk', 'ebay', 'paypal',
  'hsbc', 'non-sterling', 'transaction fee', 'interest',
  'atm', 'cash', 'withdrawal',
  'stocks green prima', 'burnhill', 'next directory', 'box bar',
  'se hildenborough', 'accenture', 'mmbill', 'mmbil',
];

/** Group key for a bank description: lower case, trailing reference/date numbers dropped. */
export function normaliseDescription(description: string): string {
  return description
    .toLowerCase()
    .trim()
    .replace(/\s+\d{2,}[/-]\d{2,}.*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface UntrackedCandidate {
  key: string;
  description: string;
  occurrences: number;
  average_amount: number;
  first_seen: string;
  last_seen: string;
}

/**
 * Repeating, fixed-amount outgoings that no subscription's pattern covers: likely untracked subscriptions.
 * `charges` are outgoing (amount < 0), any order.
 */
export function findUntracked(
  charges: Charge[],
  trackedPatterns: string[],
  dismissed: string[],
): UntrackedCandidate[] {
  const tracked = trackedPatterns;
  const excluded = dismissed.map((p) => p.toLowerCase());
  const groups = new Map<string, Charge[]>();
  for (const c of charges) {
    const key = normaliseDescription(c.description);
    if (!key) continue;
    const g = groups.get(key) ?? [];
    g.push(c);
    groups.set(key, g);
  }

  const out: UntrackedCandidate[] = [];
  for (const [key, txs] of Array.from(groups.entries())) {
    if (txs.length < 3) continue;
    if (NOT_SUBSCRIPTIONS.some((x) => key.includes(x))) continue;
    if (excluded.some((x) => key.includes(x))) continue;
    if (tracked.some((x) => patternMatches(x, key))) continue;

    const amounts = txs.map((t) => Math.abs(t.amount));
    const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    if (avg < 2) continue;
    const sd = Math.sqrt(amounts.reduce((a, b) => a + (b - avg) ** 2, 0) / amounts.length);
    if (sd / avg > 0.2) continue; // varies too much to be a fixed charge

    const sorted = [...txs].sort((a, b) => a.date.localeCompare(b.date));
    out.push({
      key,
      description: sorted[sorted.length - 1].description.slice(0, 60),
      occurrences: txs.length,
      average_amount: round2(avg),
      first_seen: sorted[0].date,
      last_seen: sorted[sorted.length - 1].date,
    });
  }
  return out.sort((a, b) => b.last_seen.localeCompare(a.last_seen) || b.average_amount - a.average_amount);
}
