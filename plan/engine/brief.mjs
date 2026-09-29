// @ts-check
/**
 * The one-page brief (29 Sep 2026): Plan E explained for Abby. Pure — it only
 * re-arranges the assumptions and the run's own outputs into the shapes the
 * one-pager draws (who holds what, the phases after 2035, who pays each year,
 * how it could go). All arithmetic for the page lives here; the renderer only
 * formats. Shares are fractions 0–1 (the renderer prints them as CSS widths).
 */

/**
 * @param {any} a  assumptions (values)
 * @param {{ ladder: any, ledger: any, scenarios: any, pivot: any, expensive?: any }} o  the run's outputs so far
 */
export function buildBrief(a, o) {
  const P = a.pots, L = a.ladder;
  // 1. What sits where — today's money, by account and by role.
  // Which rung years each holder's gilts cover (the ISA straddling gilt is shared).
  const hold = (/** @type {string} */ h) => { const ys = (o.ladder?.isa?.byHolder?.rows ?? []).filter((/** @type {any} */ x) => x.holder === h).flatMap((/** @type {any} */ x) => x.coversYears); return ys.length ? { from: Math.min(...ys), to: Math.max(...ys) } : { from: null, to: null }; };
  /** @type {Array<{ id: string, account: string, holder: string, holds: string, role: 'ladder'|'growth'|'reserve', amount: number, share: number, from?: number|null, to?: number|null }>} */
  const rows = [
    { id: 'chrisIsaGilts', account: 'ii ISA', holder: 'Chris', holds: 'Index-linked gilts', role: 'ladder', amount: P.chrisIiIsa, share: 0, ...hold('chris') },
    { id: 'abbyIsaGilts', account: 'ii ISA (new, from Vanguard)', holder: 'Abby', holds: 'Index-linked gilts', role: 'ladder', amount: L.abbyIiIsaTransfer, share: 0, ...hold('abby') },
    { id: 'chrisSippGilts', account: 'ii SIPP', holder: 'Chris', holds: 'Index-linked gilts', role: 'ladder', amount: L.sippBudgetReal, share: 0, from: a.dates.chrisPensionAccessYear + 1, to: L.lastYear },
    { id: 'abbyDc', account: 'Accenture pension (L&G)', holder: 'Abby', holds: 'Global shares; receives the salary-sacrifice AVCs', role: 'growth', amount: P.abbyAccentureDc, share: 0 },
    { id: 'chrisAcn', account: 'Accenture pension (L&G)', holder: 'Chris', holds: 'Global Equity Tracker', role: 'growth', amount: P.chrisAccenturePension, share: 0 },
    { id: 'abbyVanguard', account: 'Vanguard ISA (what stays)', holder: 'Abby', holds: 'Global shares (LifeStrategy)', role: 'growth', amount: P.abbyVanguardIsa - L.abbyIiIsaTransfer, share: 0 },
    { id: 'chrisSippEquity', account: 'ii SIPP (the rest)', holder: 'Chris', holds: 'Global shares', role: 'growth', amount: L.sippEquityRetained, share: 0 },
    { id: 'cash', account: 'Savings', holder: 'Joint', holds: 'Cash reserve', role: 'reserve', amount: P.cashBuffer, share: 0 },
    { id: 'crypto', account: 'Crypto', holder: 'Joint', holds: 'Bitcoin and Ether', role: 'reserve', amount: P.crypto, share: 0 },
    { id: 'shares', account: 'Accenture shares', holder: 'Abby', holds: 'Employee shares', role: 'reserve', amount: P.accentureShares, share: 0 },
  ];
  const total = rows.reduce((s, r) => s + r.amount, 0);
  for (const r of rows) r.share = r.amount / total;
  const role = (/** @type {string} */ id) => { const amount = rows.filter((r) => r.role === id).reduce((s, r) => s + r.amount, 0); return { amount, share: amount / total }; };
  const where = { total, rows, roles: { ladder: role('ladder'), growth: role('growth'), reserve: role('reserve') } };

  // Ages are shown as the age each of us turns in a given year.
  const turns = (/** @type {number} */ year) => ({ chris: year - a.dates.chrisBirthYear, abby: year - a.dates.abbyBirthYear });
  const retireYear = a.dates.planRetirementYear;

  // 2. What we have committed to until 2035.
  const r = o.pivot?.retune;
  const avcTotalReal = o.ledger ? o.ledger.avcSchedule.reduce((/** @type {number} */ s, /** @type {number} */ x) => s + x, 0) + o.ledger.avcSchedule.length * o.ledger.payrollReal : null; // £k
  const commitments = {
    firstTaxYear: a.pivot.firstTaxYear, lastTaxYearEnd: a.pivot.firstTaxYear + a.pivot.years,
    aniHeldAt: a.hicbc.operatingTarget, hicbcFrom: a.hicbc.lowerThreshold,
    extraSacrificeThisYear: r?.extraSacrifice ?? null, takeHomeCutThisYear: r?.takeHomeCut ?? null, cbKeptThisYear: r?.cbKept ?? null,
    costPerPound: r && r.extraSacrifice > 0 ? r.takeHomeCut / r.extraSacrifice : null,
    intoAbbyPensionReal: avcTotalReal === null ? null : avcTotalReal * 1000,
    spendLine: a.spend.planLine, hbTakeHome: a.income.hbPreRetirement,
    couponsPerYear: o.ladder?.coupons ? Object.values(o.ladder.coupons)[0] : null, // the first full coupon year
    reserve: P.otherSavings, cashFloor: a.ledger.cashFloor, abbyTransfer: L.abbyIiIsaTransfer,
  };

  // 3a. The floor the gilts buy, and the phases after retirement.
  const chrisOpen = a.dates.chrisPensionAccessYear, abbyOpen = a.dates.abbyPensionAccessYear, lastRung = L.lastYear, end = a.dates.simulationEndYear;
  const spChris = a.dates.chrisStatePensionYear, spAbby = a.dates.abbyStatePensionYear;
  const floor = {
    isaPerYear: o.ladder?.isa?.amountPerYear ?? null, isaFrom: L.firstYear, isaTo: chrisOpen,
    sippPerYear: o.ladder?.sipp?.amountPerYear ?? null, sippFrom: chrisOpen + 1, sippTo: lastRung,
    cost: L.budgetReal, hbAfter: a.income.hbPostRetirement,
  };
  const span = end - retireYear + 1;
  const phases = [
    { id: 'isa', from: retireYear, to: chrisOpen },
    { id: 'sipp', from: chrisOpen + 1, to: lastRung },
    { id: 'growth', from: lastRung + 1, to: spChris },
    { id: 'sp', from: spChris + 1, to: end },
  ].map((p) => ({ ...p, years: p.to - p.from + 1, share: (p.to - p.from + 1) / span, turnsFrom: turns(p.from) }));

  // 3b. Who pays each year's spending (planning case): first Hadley Bricks, then state pensions, then the gilts,
  // then pension drawdown, then savings. Shares of that year's spending plus tax.
  const years = (o.ledger?.rows ?? []).filter((/** @type {any} */ x) => x.year >= retireYear).map((/** @type {any} */ x) => {
    let need = x.spend + x.tax;
    const take = (/** @type {number} */ avail) => { const t = Math.max(0, Math.min(need, avail)); need -= t; return t; };
    const hb = take(x.hb), sp = take(x.sp), gilts = take(x.year <= lastRung ? x.ladder : 0), pensions = take(x.drawC + x.drawA), savings = Math.max(0, need);
    const whole = hb + sp + gilts + pensions + savings;
    return { year: x.year, parts: { gilts: gilts / whole, hb: hb / whole, pensions: pensions / whole, sp: sp / whole, savings: savings / whole } };
  });
  const strip = { spend: a.spend.retirementTarget, G: o.ledger?.G ?? null, years };

  // 3c. How it could go, at the retirement target and the plan line: the planning and better flat cases from the
  // scenario grid, and history from expensive starts (median, with the worst tenth) from o.expensive.
  const spends = [a.spend.retirementTarget, a.spend.planLine];
  const grid = o.scenarios?.grid ?? [];
  const flat = (/** @type {string} */ id, /** @type {number} */ G) => ({ id, G, cells: spends.map((spend) => {
    const c = grid.find((/** @type {any} */ x) => x.spend === spend)?.byReturn.find((/** @type {any} */ x) => Math.abs(x.G - G) < 1e-9);
    return { spend, atLastRung: c ? c.atLastRung * 1000 : null, atEnd: c ? Math.max(0, c.atEnd) * 1000 : null, runsOut: c?.firstCashNegative ?? null, runsOutTurns: c?.firstCashNegative ? turns(c.firstCashNegative) : null, barShare: 0 };
  }) });
  const X = o.expensive;
  const history = X ? { id: 'history', capeMin: X.capeMin, cut: X.cut, starts: X.starts, firstYear: X.firstYear, lastYear: X.lastYear, years: X.yearsPerPath, cells: spends.map((spend) => {
    const c = X.bySpend.find((/** @type {any} */ x) => x.spend === spend);
    return { spend, atLastRung: c.atLastRung * 1000, atEnd: Math.max(0, c.atEnd) * 1000, atLastRungP10: c.atLastRungP10 * 1000, atEndP10: Math.max(0, c.atEndP10) * 1000, failRate: c.failRate, runsOut: null, runsOutTurns: null, barShare: 0 };
  }) } : null;
  /** @type {any[]} */
  const outRows = [flat('planning', a.returns.realEquity.planning), ...(history ? [history] : []), flat('better', a.returns.realEquity.better)];
  const maxEnd = Math.max(1, ...outRows.flatMap((r) => r.cells.map((/** @type {any} */ c) => c.atEnd ?? 0)));
  for (const r of outRows) for (const c of r.cells) c.barShare = (c.atEnd ?? 0) / maxEnd;
  const replay = o.scenarios?.replay;
  const outcomes = { spends, rows: outRows, endYear: end, endTurns: turns(end), allHistory: replay ? { starts: replay.all.starts, failRate: replay.all.failRate, from: replay.firstStartYear, years: replay.yearsPerPath } : null };

  const iht = { pensionsInEstateFrom: a.iht.pensionsInEstateFromTaxYear };
  return { retire: { year: retireYear, turns: turns(retireYear) }, iht, where, commitments, floor, phases, strip, outcomes, pensionsOpen: { chris: chrisOpen, abby: abbyOpen, turns: { chris: turns(chrisOpen).chris, abby: turns(abbyOpen).abby } }, statePension: { chris: spChris, abby: spAbby, each: a.statePension.annualEach, joint: 2 * a.statePension.annualEach } };
}
