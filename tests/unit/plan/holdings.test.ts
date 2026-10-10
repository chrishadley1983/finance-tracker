/**
 * Gilt holdings valued at units × dirty / 100 (1 Oct 2026): platforms such as ii show index-linked gilts at the
 * clean price with no index ratio, which understated Chris's ISA and SIPP gilts by ~£235k.
 */
import { describe, it, expect } from 'vitest';
import { valueHoldings, newestHoldings } from '../../../plan/inputs/holdings.mjs';

const gilts = [
  { epic: 'TR37', name: '1 1/8% Index-linked Treasury Gilt 2037', clean: 90.17, dirty: 187.693, realYield: 2.12 },
  { epic: 'TR35', name: '1 1/8% Index-linked Treasury Gilt 2035', clean: 93.61, dirty: 100.398, realYield: 1.9 },
];

describe('gilt holdings at true value', () => {
  it('values each line at units × dirty / 100 and adds the cash and funds', () => {
    const v = valueHoldings({ 'CH ISA': [{ epic: 'TR37', units: 48128.01 }, { epic: 'TR35', units: 93013.77 }] }, gilts, { 'CH ISA': 551.47 });
    const acc = v.accounts[0];
    // 48,128.01 × 1.87693 = 90,333.0; 93,013.77 × 1.00398 = 93,384.0 (hand arithmetic)
    expect(acc.rows[0].value).toBeCloseTo(90333.0, 0);
    expect(acc.rows[1].value).toBeCloseTo(93384.0, 0);
    expect(acc.gilts).toBeCloseTo(183717.0, 0);
    expect(acc.total).toBeCloseTo(183717.0 + 551.47, 0);
    // the clean-price view (what ii shows) is far lower for the old, high-uplift gilt
    expect(acc.rows[0].cleanValue).toBeCloseTo(43397.0, 0);
    expect(acc.rows[0].indexRatio).toBeCloseTo(2.0815, 3);
    expect(v.missing).toEqual([]);
  });
  it('reports a gilt with no price and leaves the total open when no cash/funds are given', () => {
    const v = valueHoldings({ 'Chris II SIPP Pension': [{ epic: 'T99', units: 100 }] }, gilts);
    expect(v.missing).toEqual(['T99']);
    expect(v.accounts[0].total).toBeNull();
  });
  it('the holdings file names real accounts and the units bought on 29 Sep 2026', () => {
    const h = newestHoldings();
    expect(h).not.toBeNull();
    const accts = h!.data.accounts;
    expect(Object.keys(accts).sort()).toEqual(['CH ISA', 'Chris II SIPP Pension']);
    expect(accts['CH ISA'].reduce((s, l) => s + l.units, 0)).toBeCloseTo(214330.88, 2);
    expect(accts['Chris II SIPP Pension'].reduce((s, l) => s + l.units, 0)).toBeCloseTo(345170.26, 2);
  });
});
