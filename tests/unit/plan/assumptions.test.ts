import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import assumptionsFile from '../../../plan/assumptions.json';
import { buildAssumptions, validateAssumptions, resolveAssumptions, evalFormula, freshness } from '../../../plan/inputs/assumptions.mjs';
import { pivotProgramme, pivotYear, takeHomeNominal } from '@/lib/plan/pivot';
import { LADDER, POTS_BASELINE, SPEND, PAYSLIP } from '@/lib/plan/assumptions';

const root = path.resolve(__dirname, '../../..');
const file = assumptionsFile as never;

describe('plan/assumptions.json — the single home for planning numbers (phase 1)', () => {
  it('is structurally valid and every non-DERIVED entry carries provenance', () => {
    expect(validateAssumptions(file)).toEqual([]);
    for (const [key, e] of Object.entries(assumptionsFile.entries) as [string, Record<string, unknown>][]) {
      if (e.status === 'DERIVED') { expect(e).not.toHaveProperty('value'); expect(typeof e.formula).toBe('string'); continue; }
      expect(e, key).toHaveProperty('value');
      expect(typeof e.source, key).toBe('string');
      expect(String(e.asOf), key).toMatch(/^\d{4}-\d{2}/);
      expect(String(e.reviewBy), key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      if (e.status === 'DECISION') expect(String(e.source), key).toMatch(/decisions\.md/);
    }
  });

  it('DERIVED entries are recomputed by the loader and a hand-typed value is rejected', () => {
    const built = buildAssumptions(file);
    // independent derivations from the FACT/DECISION inputs
    const e = assumptionsFile.entries;
    expect(built.flat['ladder.isaBudgetReal']).toBe(e['pots.chrisIiIsa'].value + e['ladder.abbyIiIsaTransfer'].value);
    expect(built.flat['ladder.sippBudgetReal']).toBe(e['pots.chrisIiSipp'].value - e['ladder.sippEquityRetained'].value);
    expect(built.flat['ladder.budgetReal']).toBe(Number(built.flat['ladder.isaBudgetReal']) + Number(built.flat['ladder.sippBudgetReal']));
    expect(built.flat['pots.crypto']).toBe(e['pots.otherSavings'].value - e['pots.cashBuffer'].value);
    expect(built.flat['pots.total']).toBeCloseTo(276_716 + 312_573 + 439_574 + 193_081 + 282_921 + 119_924 + 1_960, 0); // 1 Sep 2026 snapshot sum

    const tampered = JSON.parse(JSON.stringify(assumptionsFile));
    tampered.entries['ladder.budgetReal'].value = 909_400;
    expect(validateAssumptions(tampered).some((p) => p.key === 'ladder.budgetReal')).toBe(true);
    expect(() => buildAssumptions(tampered)).toThrow(/hand-typed/);
  });

  it('formula evaluator handles sum, single operators, literals and rejects the rest', () => {
    const get = (k: string) => ({ a: 2, b: 3, 'x.y': 10 })[k]!;
    expect(evalFormula('sum(a, b, 5)', get)).toBe(10);
    expect(evalFormula('x.y - a', get)).toBe(8);
    expect(evalFormula('a * b', get)).toBe(6);
    expect(evalFormula('x.y / b', get)).toBeCloseTo(3.333, 3);
    expect(() => evalFormula('a ^ b', get)).toThrow();
    const circular = { schemaVersion: 1, preparedOn: '2026-01-01', knownLimitations: [], entries: { 'p.a': { status: 'DERIVED', formula: 'p.b' }, 'p.b': { status: 'DERIVED', formula: 'p.a' } } };
    expect(() => resolveAssumptions(circular as never)).toThrow(/circular/);
  });

  it('the constants shim exposes exactly the JSON values (no second home)', () => {
    const built = buildAssumptions(file);
    expect(LADDER.budgetReal).toBe(built.flat['ladder.budgetReal']);
    expect(SPEND.planLine).toBe(assumptionsFile.entries['spend.planLine'].value);
    expect(SPEND.planLine).toBe(70_000); // the 20 Sep 2026 decision
    expect(PAYSLIP.basicAnnual).toBe(73_837.8);
    expect(POTS_BASELINE.chrisPension).toBe(439_574 + 193_081);
  });

  it('engine-derived entry: income.abbyTakeHomeYear1 ≈ £43,498 at a £60k ANI landing, whatever the basic', () => {
    const built = buildAssumptions(file);
    expect(built.engineDerived).toContain('income.abbyTakeHomeYear1');
    const th = takeHomeNominal(0, pivotYear(0, built.values.hicbc.lowerThreshold).extraSacrifice);
    expect(Math.abs(th - 43_498)).toBeLessThan(60);
  });

  it('the ledger tool computes the same AVC schedule as the pivot (one engine, two entry points)', () => {
    const out = JSON.parse(execFileSync('node', ['plan/tools/ledger.mjs', '0.02', '--json'], { cwd: root, encoding: 'utf8', maxBuffer: 50e6 }));
    const want = pivotProgramme(60_000).years.map((y) => y.extraSacrifice / 1000);
    expect(out.avcSchedule).toHaveLength(want.length);
    out.avcSchedule.forEach((v: number, i: number) => expect(Math.abs(v - want[i])).toBeLessThan(0.001));
    expect(Math.abs(out.payrollReal - (PAYSLIP.basicAnnual * (PAYSLIP.employerRate + PAYSLIP.existingEeRate)) / 1000)).toBeLessThan(0.001);
    expect(Math.abs(out.wrappers.isa.budget * 1000 - LADDER.isaBudgetReal)).toBeLessThan(1);
  }, 30_000);

  it('freshness: nothing is more than 90 days past its review date (soft guard; the hard nag is npm run plan:check)', () => {
    const stale = freshness(file, new Date());
    const red = stale.filter((s) => s.level === 'RED');
    expect(red, red.map((s) => `${s.key} due ${s.reviewBy}`).join(', ')).toEqual([]);
  });

  it('no planning literals outside plan/assumptions.json (lib/plan and components/plan)', () => {
    const files = [
      ...fs.readdirSync(path.join(root, 'lib/plan')).filter((f) => f.endsWith('.ts')).map((f) => `lib/plan/${f}`),
      ...fs.readdirSync(path.join(root, 'components/plan')).filter((f) => f.endsWith('.tsx')).map((f) => `components/plan/${f}`),
    ];
    const offenders: string[] = [];
    for (const rel of files) {
      const lines = fs.readFileSync(path.join(root, rel), 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (/^\s*(\/\/|\*|\/\*)/.test(line)) return; // comment lines
        let code = line.replace(/\/\/.*$/, ''); // trailing comments
        if (/\b(min|max|step)=\{/.test(code)) return; // UI slider ranges are presentation, not plan numbers
        // Phase-6 TODO: JSX prose such as "£59,500" should be rendered from assumptions via fmt; until then prose £-figures are allowed.
        if (rel.startsWith('components/')) code = code.replace(/£\d[\d,]*k?/g, '£');
        code = code.replace(/'[^']*'|"[^"]*"|`[^`]*`/g, '');
        if (/\d_\d{3}\b/.test(code) || /\b(?!19|20)\d{2}[,_]?\d{3}\b(?![\d.]*%)/.test(code)) offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });
});
