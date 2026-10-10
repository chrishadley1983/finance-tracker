/**
 * Pure helpers for the Overview page: month maths, the opening sentence and
 * the "what's left each month" series. No React, no fetch: easy to test.
 */
import { MONTH_NAMES, MONTH_SHORT, formatGBP } from '@/lib/format';

// ---- Months ----------------------------------------------------------------

/** A calendar month, 1-based. */
export interface YearMonth {
  year: number;
  month: number;
}

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function monthKey({ year, month }: YearMonth): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function currentMonth(now: Date = new Date()): YearMonth {
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export function compareMonths(a: YearMonth, b: YearMonth): number {
  return a.year !== b.year ? a.year - b.year : a.month - b.month;
}

/**
 * The month asked for in the URL (?month=YYYY-MM). Missing, malformed or
 * future months fall back to the current month.
 */
export function parseMonthParam(value: string | null | undefined, now: Date = new Date()): YearMonth {
  const today = currentMonth(now);
  const m = value ? MONTH_RE.exec(value) : null;
  if (!m) return today;
  const asked = { year: Number(m[1]), month: Number(m[2]) };
  return compareMonths(asked, today) > 0 ? today : asked;
}

export function shiftMonth({ year, month }: YearMonth, delta: number): YearMonth {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function daysInMonth({ year, month }: YearMonth): number {
  return new Date(year, month, 0).getDate();
}

/** First and last day as ISO dates (calendar days, no time zone shifts). */
export function monthRange(ym: YearMonth): { start: string; end: string } {
  const key = monthKey(ym);
  return { start: `${key}-01`, end: `${key}-${String(daysInMonth(ym)).padStart(2, '0')}` };
}

export function monthName(ym: YearMonth): string {
  return MONTH_NAMES[ym.month - 1];
}

export function monthShort(ym: YearMonth): string {
  return MONTH_SHORT[ym.month - 1];
}

export function isCurrentMonth(ym: YearMonth, now: Date = new Date()): boolean {
  return compareMonths(ym, currentMonth(now)) === 0;
}

/**
 * How far through the month we are (0..1), counting today as done. Past
 * months are 1; used for the even-pace tick on budget bars.
 */
export function monthElapsed(ym: YearMonth, now: Date = new Date()): number {
  const cmp = compareMonths(ym, currentMonth(now));
  if (cmp < 0) return 1;
  if (cmp > 0) return 0;
  return now.getDate() / daysInMonth(ym);
}

// ---- Opening sentence -------------------------------------------------------

export interface LedeInput {
  month: YearMonth;
  now?: Date;
  /** Spending this month (positive). */
  spent: number;
  /** Planned spending (sum of expense budgets, positive). */
  plan: number;
  /** Money in this month (positive). */
  income: number;
  /** Expense categories already over budget, biggest overspend first. */
  overCategories: string[];
  /** Transactions without a category. */
  uncategorised: number;
}

/** A piece of the sentence: plain, emphasised (a figure) or a link. */
export interface LedePart {
  text: string;
  strong?: boolean;
  fig?: boolean;
  href?: string;
}

export type PaceWord = 'well ahead of' | 'a little ahead of' | 'on' | 'a little behind' | 'well behind';

/** Spending pace against an even spread of the plan over the month. */
export function paceWord(spent: number, plan: number, elapsed: number): PaceWord {
  const diff = spent / plan - elapsed;
  if (diff > 0.15) return 'well ahead of';
  if (diff > 0.05) return 'a little ahead of';
  if (diff < -0.15) return 'well behind';
  if (diff < -0.05) return 'a little behind';
  return 'on';
}

function joinNames(names: string[]): string {
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names[0]} and ${names.length - 1} others`;
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/**
 * "You've spent £2,148 of a £3,400 plan with 24 days to go, a little ahead of
 * pace. Groceries is already over. £4,100 has come in. 6 transactions need a
 * category." Clauses that don't apply are left out; past months use the past tense.
 */
export function buildLede(input: LedeInput): LedePart[] {
  const now = input.now ?? new Date();
  const { month, spent, plan, income, overCategories, uncategorised } = input;
  const live = isCurrentMonth(month, now);
  const name = monthName(month);
  const money = (n: number): LedePart => ({ text: formatGBP(n), strong: true, fig: true });
  const parts: LedePart[] = [];
  const say = (...p: (string | LedePart)[]) => p.forEach((x) => parts.push(typeof x === 'string' ? { text: x } : x));

  if (spent <= 0 && income <= 0) {
    say(live ? `Nothing has been recorded for ${name} yet.` : `Nothing was recorded for ${name}.`);
  } else if (live) {
    const toGo = daysInMonth(month) - now.getDate();
    const left = toGo === 0 ? 'on the last day of the month' : `with ${toGo} ${plural(toGo, 'day', 'days')} to go`;
    if (plan > 0 && spent > plan) {
      say("You've spent ", money(spent), ', ', money(spent - plan), ' over a ', money(plan), ` plan, ${left}.`);
    } else if (plan > 0) {
      say("You've spent ", money(spent), ' of a ', money(plan), ` plan ${left}, ${paceWord(spent, plan, monthElapsed(month, now))} pace.`);
    } else {
      say("You've spent ", money(spent), ' so far this month.');
    }
  } else if (plan > 0 && spent > plan) {
    say('You spent ', money(spent), ` in ${name}, `, money(spent - plan), ' over the ', money(plan), ' plan.');
  } else if (plan > 0) {
    say('You spent ', money(spent), ' of ', money(plan), ` in ${name}.`);
  } else {
    say('You spent ', money(spent), ` in ${name}.`);
  }

  if (overCategories.length > 0) {
    const names = joinNames(overCategories);
    const many = overCategories.length > 1;
    say(' ', { text: names, strong: true }, live ? ` ${many ? 'are' : 'is'} already over.` : ' went over.');
  }

  if (income > 0) {
    say(' ', money(income), live ? ' has come in.' : ' came in.');
  }

  if (uncategorised > 0) {
    say(
      ' ',
      { text: `${uncategorised} ${plural(uncategorised, 'transaction', 'transactions')}`, href: '/review' },
      ` ${plural(uncategorised, 'needs', 'need')} a category.`
    );
  }
  return parts;
}

export function ledeText(parts: LedePart[]): string {
  return parts.map((p) => p.text).join('');
}

// ---- What's left each month ------------------------------------------------

export interface TrendPoint {
  month: string;
  income: number;
  expenses: number;
}

export interface NetPoint {
  label: string;
  net: number;
  partial: boolean;
  /** No income or spending recorded at all. */
  empty: boolean;
}

/**
 * Net (income minus spending) per month, oldest first. The last point is the
 * current month and is marked partial ("Oct so far").
 */
export function netSeries(trend: TrendPoint[]): NetPoint[] {
  return trend.map((p, i) => {
    const partial = i === trend.length - 1;
    return {
      label: partial ? `${p.month} so far` : p.month,
      net: Math.round(p.income - p.expenses),
      partial,
      empty: p.income === 0 && p.expenses === 0,
    };
  });
}

/** "You kept money back in 9 of the last 11 full months." */
export function netCaption(series: NetPoint[]): string | null {
  const full = series.filter((p) => !p.partial && !p.empty);
  if (full.length === 0) return null;
  const kept = full.filter((p) => p.net > 0).length;
  const months = plural(full.length, 'full month', `${full.length} full months`);
  const span = full.length === 1 ? 'the last full month' : `the last ${months}`;
  if (kept === full.length) return `You kept money back in every one of ${span}.`;
  if (kept === 0) return `You spent more than came in during ${full.length === 1 ? span : `each of ${span}`}.`;
  return `You kept money back in ${kept} of ${span}.`;
}
