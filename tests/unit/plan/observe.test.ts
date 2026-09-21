/**
 * Phase 3: the pure shaping behind the observation adapters, with fixtures.
 * No database here — the adapters are thin and the shaping is what can be wrong.
 */
import { describe, it, expect } from 'vitest';
import assumptionsFile from '../../../plan/assumptions.json';
import payslipAug from '../../../plan/observations/payslips/2026-08.json';
import { buildAssumptions } from '../../../plan/inputs/assumptions.mjs';
import { latestPerAccount, potsFromSnapshots, classifyIncomeSource, incomeBySource, validatePayslip, driftReport } from '../../../plan/inputs/observe.mjs';

const a = buildAssumptions(assumptionsFile as never).values;

describe('observation shaping (phase 3)', () => {
  it('latestPerAccount keeps the newest row per account and reports the latest date', () => {
    const r = latestPerAccount([
      { date: '2026-08-01', balance: 100, account: { name: 'CH ISA', type: 'isa' } },
      { date: '2026-09-01', balance: '276716', account: { name: 'CH ISA', type: 'isa' } },
      { date: '2026-09-01', balance: 5, account: null },
      { date: '2026-07-01', balance: 1, account: { name: 'Other Savings', type: 'savings' } },
    ]);
    expect(r.asOf).toBe('2026-09-01');
    expect(r.accounts.map((x) => [x.name, x.balance, x.date])).toEqual([['CH ISA', 276716, '2026-09-01'], ['Other Savings', 1, '2026-07-01']]);
  });

  it('potsFromSnapshots maps every account in accounts.potsMap onto a pots key and lists the missing ones', () => {
    const map = a.accounts.potsMap as Record<string, string>;
    expect(Object.keys(map).length).toBeGreaterThanOrEqual(7);
    const accounts = Object.keys(map).slice(0, -1).map((name, i) => ({ name, balance: 1000 * (i + 1), date: '2026-09-01' }));
    const r = potsFromSnapshots(a, accounts);
    expect(Object.keys(r.observed).length).toBe(accounts.length);
    expect(r.missing).toEqual([Object.keys(map).slice(-1)[0]]);
    for (const key of Object.values(map)) expect(key).toMatch(/^pots\./);
  });

  it('classifyIncomeSource recognises the household income lines', () => {
    const c = (description: string, category: string | null = null, account: string | null = 'HSBC Joint Current Account', amount = 500) => classifyIncomeSource({ description, category, account, amount });
    expect(c('ACCENTURE UK LIM', 'Abby Income', undefined, 4511.6)).toBe('abbySalary');
    expect(c('ACCENTURE  UK  LIM CR', 'Abby Income', undefined, 112.5)).toBe('abbyReimbursement');
    expect(c('BI WORLDWIDE LIMIT CR', 'Other income')).toBe('abbyReimbursement');
    expect(c('Hadley Bricks', 'Chris Income')).toBe('hbDrawings');
    expect(c('Hadley Bricks Sent from Monzo CR', 'Chris Income')).toBe('hbDrawings');
    expect(c('Stripe Payments UKSHOPIFY', 'Chris Income')).toBe('hbSalesCredits');
    expect(c('HMRC CHILD BENEFIT', 'Other income')).toBe('childBenefit');
    expect(c('COTTRELL IF+JE 26/27 CR', 'Other income')).toBe('cottrellAnnual');
    expect(c('PEOPLE FOR RESEARCPFR-26047-B', 'Other income')).toBe('chrisSideIncome');
    expect(c('Deel Inc. Micro1 Inc', 'Other income', 'HSBC Joint Current Account', 1089.99)).toBe('chrisSideIncome');
    expect(c('CHQ IN AT 404032', 'Chris Income')).toBe('oneOff');
    expect(c('HADLEY P&SA Max birthday', 'Gift in')).toBe('gifts');
    expect(c('Direct Accenture Pension Contribution', 'Other income', 'Investment Contributions')).toBe('contributions');
    expect(c('Direct Share Purchase', 'Other income', 'Investment Contributions')).toBe('contributions');
    expect(c('SOMETHING NEW', 'Other income')).toBe('other');
  });

  it('incomeBySource separates spendable from contributions and recurring from one-offs', () => {
    const r = incomeBySource([
      { date: '2026-08-28', amount: 4511.6, description: 'ACCENTURE UK LIM', category: 'Abby Income', account: 'HSBC Joint Current Account' },
      { date: '2026-08-31', amount: 900, description: 'Direct Accenture Pension Contribution', category: 'Other income', account: 'Investment Contributions' },
      { date: '2026-09-09', amount: 460, description: 'Hadley Bricks', category: 'Chris Income', account: 'HSBC Joint Current Account' },
      { date: '2026-07-02', amount: 3386.63, description: 'CHQ IN AT 404032', category: 'Chris Income', account: 'HSBC Joint Current Account' },
      { date: '2026-09-04', amount: 539.4, description: 'HMRC CHILD BENEFIT', category: 'Other income', account: 'HSBC Joint Current Account' },
    ]);
    expect(r.total).toBeCloseTo(9797.63, 2);
    expect(r.contributions).toBe(900);
    expect(r.spendable).toBeCloseTo(8897.63, 2);
    expect(r.recurring).toBeCloseTo(8897.63 - 3386.63, 2);
    expect(r.abbyTakeHome).toBe(4511.6);
    expect(r.hbDrawings).toBe(460);
    expect(r.childBenefit).toBe(539.4);
  });

  it('validatePayslip accepts the August 2026 file and rejects a broken one', () => {
    expect(validatePayslip(payslipAug)).toEqual([]);
    expect(validatePayslip({ ...payslipAug, taxMonth: 13 })).toContain('taxMonth must be 1..12');
    expect(validatePayslip({ ...payslipAug, ytdTaxable: 100 }).some((p) => /ytdTaxable/.test(p))).toBe(true);
  });

  it('driftReport applies the architecture tolerances', () => {
    const okPots = { observed: { 'pots.chrisIiIsa': { value: a.pots.chrisIiIsa * 1.01, date: '2026-10-01', account: 'CH ISA' } } };
    const amberPots = { observed: { 'pots.chrisIiIsa': { value: a.pots.chrisIiIsa * 1.05, date: '2026-10-01', account: 'CH ISA' } } };
    const redPots = { observed: { 'pots.chrisIiIsa': { value: a.pots.chrisIiIsa * 1.2, date: '2026-10-01', account: 'CH ISA' } } };
    expect(driftReport(a, { pots: okPots }, '2026-10-02').verdict).toBe('GREEN');
    expect(driftReport(a, { pots: amberPots }, '2026-10-02').verdict).toBe('AMBER');
    expect(driftReport(a, { pots: redPots }, '2026-10-02').verdict).toBe('RED');
    expect(driftReport(a, { runRate: { trailing12moSpend: a.spend.planLine + 1_000 } }, '2026-10-02').verdict).toBe('GREEN');
    expect(driftReport(a, { runRate: { trailing12moSpend: a.spend.planLine + 5_000 } }, '2026-10-02').verdict).toBe('AMBER');
    expect(driftReport(a, { runRate: { trailing12moSpend: a.spend.planLine + 20_000 } }, '2026-10-02').verdict).toBe('RED');
    expect(driftReport(a, { payslip: payslipAug }, '2026-09-21').items.find((i) => i.item === 'payslip age')?.level).toBe('OK');
    expect(driftReport(a, { payslip: payslipAug }, '2026-11-20').items.find((i) => i.item === 'payslip age')?.level).toBe('RED');
    expect(driftReport(a, { payslip: { ...payslipAug, basicMonthly: 6300 } }, '2026-09-21').items.find((i) => i.item === 'payslip.basicAnnual')?.level).toBe('RED');
  });
});
