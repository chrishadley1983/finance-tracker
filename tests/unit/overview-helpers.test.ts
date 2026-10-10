import { describe, it, expect } from 'vitest';
import {
  buildLede,
  ledeText,
  monthElapsed,
  monthRange,
  netCaption,
  netSeries,
  paceWord,
  parseMonthParam,
  shiftMonth,
  type LedeInput,
} from '@/lib/dashboard/overview';

const NOW = new Date(2026, 9, 7, 12); // Wed 7 October 2026
const OCT = { year: 2026, month: 10 };
const SEP = { year: 2026, month: 9 };

const base = (over: Partial<LedeInput> = {}): LedeInput => ({
  month: OCT,
  now: NOW,
  spent: 1148,
  plan: 3400,
  income: 4100,
  overCategories: [],
  uncategorised: 0,
  ...over,
});

describe('month helpers', () => {
  it('parses ?month=YYYY-MM and falls back to the current month', () => {
    expect(parseMonthParam('2026-09', NOW)).toEqual(SEP);
    expect(parseMonthParam(null, NOW)).toEqual(OCT);
    expect(parseMonthParam('2026-13', NOW)).toEqual(OCT);
    expect(parseMonthParam('nonsense', NOW)).toEqual(OCT);
  });

  it('does not allow future months', () => {
    expect(parseMonthParam('2026-11', NOW)).toEqual(OCT);
    expect(parseMonthParam('2027-01', NOW)).toEqual(OCT);
  });

  it('shifts across year boundaries', () => {
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth({ year: 2025, month: 12 }, 1)).toEqual({ year: 2026, month: 1 });
    expect(shiftMonth(OCT, -12)).toEqual({ year: 2025, month: 10 });
  });

  it('gives calendar month bounds without time-zone drift', () => {
    expect(monthRange(OCT)).toEqual({ start: '2026-10-01', end: '2026-10-31' });
    expect(monthRange({ year: 2028, month: 2 })).toEqual({ start: '2028-02-01', end: '2028-02-29' });
  });

  it('reports how far through the month we are', () => {
    expect(monthElapsed(OCT, NOW)).toBeCloseTo(7 / 31);
    expect(monthElapsed(SEP, NOW)).toBe(1);
  });
});

describe('paceWord', () => {
  it('describes spending against an even pace', () => {
    expect(paceWord(50, 100, 0.5)).toBe('on');
    expect(paceWord(60, 100, 0.5)).toBe('a little ahead of');
    expect(paceWord(80, 100, 0.5)).toBe('well ahead of');
    expect(paceWord(40, 100, 0.5)).toBe('a little behind');
    expect(paceWord(10, 100, 0.5)).toBe('well behind');
  });
});

describe('buildLede', () => {
  it('builds the full current-month sentence', () => {
    const text = ledeText(buildLede(base({ overCategories: ['Eating out'], uncategorised: 6 })));
    expect(text).toBe(
      "You've spent £1,148 of a £3,400 plan with 24 days to go, a little ahead of pace. Eating out is already over. £4,100 has come in. 6 transactions need a category."
    );
  });

  it('links the uncategorised count to the review queue', () => {
    const parts = buildLede(base({ uncategorised: 1 }));
    const link = parts.find((p) => p.href);
    expect(link).toEqual({ text: '1 transaction', href: '/review' });
    expect(ledeText(parts)).toContain('1 transaction needs a category.');
  });

  it('omits clauses that do not apply', () => {
    const text = ledeText(buildLede(base({ income: 0 })));
    expect(text).toBe("You've spent £1,148 of a £3,400 plan with 24 days to go, a little ahead of pace.");
  });

  it('names two over-budget categories, then summarises more', () => {
    expect(ledeText(buildLede(base({ overCategories: ['Eating out', 'Shopping'] })))).toContain('Eating out and Shopping are already over.');
    expect(ledeText(buildLede(base({ overCategories: ['Eating out', 'Shopping', 'Pets'] })))).toContain('Eating out and 2 others are already over.');
  });

  it('says when total spending is over the plan', () => {
    expect(ledeText(buildLede(base({ spent: 3600, income: 0 })))).toBe("You've spent £3,600, £200 over a £3,400 plan, with 24 days to go.");
  });

  it('copes with no plan', () => {
    expect(ledeText(buildLede(base({ plan: 0, income: 0 })))).toBe("You've spent £1,148 so far this month.");
  });

  it('uses the past tense for past months', () => {
    const text = ledeText(buildLede(base({ month: SEP, spent: 3210, overCategories: ['Groceries'], income: 5260 })));
    expect(text).toBe('You spent £3,210 of £3,400 in September. Groceries went over. £5,260 came in.');
  });

  it('describes a past month that went over plan', () => {
    expect(ledeText(buildLede(base({ month: SEP, spent: 3700, income: 0 })))).toBe('You spent £3,700 in September, £300 over the £3,400 plan.');
  });

  it('handles a month with nothing recorded', () => {
    expect(ledeText(buildLede(base({ spent: 0, income: 0 })))).toBe('Nothing has been recorded for October yet.');
    expect(ledeText(buildLede(base({ month: SEP, spent: 0, income: 0 })))).toBe('Nothing was recorded for September.');
  });

  it('marks figures for emphasis', () => {
    const parts = buildLede(base());
    expect(parts.filter((p) => p.fig).map((p) => p.text)).toEqual(['£1,148', '£3,400', '£4,100']);
  });
});

describe('netSeries / netCaption', () => {
  const trend = [
    { month: 'Jul', income: 5000, expenses: 4000 },
    { month: 'Aug', income: 5000, expenses: 6000 },
    { month: 'Sep', income: 5000, expenses: 3000 },
    { month: 'Oct', income: 1000, expenses: 400 },
  ];

  it('computes net per month and marks the current month partial', () => {
    const s = netSeries(trend);
    expect(s.map((p) => p.net)).toEqual([1000, -1000, 2000, 600]);
    expect(s[3]).toMatchObject({ label: 'Oct so far', partial: true });
    expect(s[0].partial).toBe(false);
  });

  it('counts full months that kept money back', () => {
    expect(netCaption(netSeries(trend))).toBe('You kept money back in 2 of the last 3 full months.');
  });

  it('ignores months with no data', () => {
    const s = netSeries([{ month: 'Jun', income: 0, expenses: 0 }, ...trend]);
    expect(netCaption(s)).toBe('You kept money back in 2 of the last 3 full months.');
  });

  it('handles all-positive, all-negative and empty histories', () => {
    expect(netCaption(netSeries([trend[0], trend[2], trend[3]]))).toBe('You kept money back in every one of the last 2 full months.');
    expect(netCaption(netSeries([trend[1], trend[3]]))).toBe('You spent more than came in during the last full month.');
    expect(netCaption(netSeries([trend[3]]))).toBeNull();
  });
});
