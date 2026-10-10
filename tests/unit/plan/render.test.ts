/**
 * Phase 4: documents equal the model. Every number a renderer emits is recorded
 * with the outputs path it came from; here we re-format that path's value and
 * check it is what the document shows, parse the HTML spans back, and lint the
 * templates for hand-typed numbers.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import assumptionsFile from '../../../plan/assumptions.json';
import fallback from '../../../plan/observations/gilt-prices/2026-09-21.json';
import yields from '../../../plan/observations/gilt-yields/2026-09-20.json';
import payslipAug from '../../../plan/observations/payslips/2026-08.json';
import { buildAssumptions } from '../../../plan/inputs/assumptions.mjs';
import { runPlan } from '../../../plan/engine/index.mjs';
import { renderAll, getPath } from '../../../plan/render/render.mjs';
import * as fmt from '../../../plan/render/fmt.mjs';

const root = path.resolve(__dirname, '../../..');
const built = buildAssumptions(assumptionsFile as never);
const inputs = { assumptions: { ...built.values, __preparedOn: built.preparedOn, __knownLimitations: built.knownLimitations }, giltPrices: fallback, giltYields: yields, payslip: payslipAug, today: '2026-09-21', observations: { payslip: { month: '2026-08', taxMonth: 5 }, giltPrices: { live: false } } };
const outputs = runPlan(inputs);
const docs = renderAll(outputs, inputs, { generatedAt: '2026-09-21', assumptionsFile, drift: { verdict: 'AMBER', items: [{ level: 'AMBER', item: 'spend.planLine', detail: 'test' }] } });
const emissions = JSON.parse(docs['emissions.json']) as Array<{ doc: string; key: string; text: string; attr?: boolean }>;
const scope = { ...outputs, inputs };

// every formatter the renderers use, so a recorded text can be matched to SOME formatting of the source value
const formatters: Array<(v: number) => string> = [fmt.gbp, fmt.gbpShort, fmt.gbpFromK, (v) => fmt.kCell(v), fmt.k1, (v) => fmt.pct(v, 0), (v) => fmt.pct(v, 1), (v) => fmt.pct(v, 2), fmt.int, (v) => fmt.dec(v, 1), (v) => fmt.dec(v, 2), (v) => fmt.dec(v, 4), (v) => String(v), (v) => fmt.int(v) + '%'];

describe('renderers (phase 4): documents equal the model', () => {
  it('produces every document with content', () => {
    for (const name of ['summary.html', 'ledger.html', 'execution.html', 'plan-e-one-pager.html', 'assumptions.md', 'avc-recipe.md', 'ledger.csv', 'order-sheet-isa.csv', 'order-sheet-sipp.csv']) expect(docs[name as keyof typeof docs].length, name).toBeGreaterThan(200);
    expect(emissions.length).toBeGreaterThan(500);
  });

  it('every emitted number is a formatting of the value at its outputs path', () => {
    const bad: string[] = [];
    for (const e of emissions) {
      const v = getPath(scope, e.key);
      if (v === undefined || v === null) { bad.push(`${e.doc} ${e.key}: path missing`); continue; }
      if (typeof v === 'number') { if (!formatters.some((f) => f(v) === e.text) && !(e.text === '–' && Math.abs(v) < 0.5)) bad.push(`${e.doc} ${e.key}: '${e.text}' is no formatting of ${v}`); }
      else if (String(v) !== e.text && fmt.int(Number(v)) !== e.text) bad.push(`${e.doc} ${e.key}: '${e.text}' vs ${JSON.stringify(v)}`);
    }
    expect(bad, bad.slice(0, 20).join('\n')).toEqual([]);
  });

  it('HTML spans read back to the same key/text pairs the renderer recorded', () => {
    for (const name of ['summary.html', 'ledger.html', 'execution.html', 'plan-e-one-pager.html'] as const) {
      const html = docs[name];
      const spans = Array.from(html.matchAll(/<span data-key="([^"]+)">([^<]*)<\/span>/g)).map((m) => ({ key: m[1], text: m[2].replace(/&amp;/g, '&').replace(/&lt;/g, '<') }));
      const recorded = emissions.filter((e) => e.doc === name && !e.attr); // attribute values (CSS widths) carry no span
      expect(spans.length).toBe(recorded.length);
      // template pieces are assembled out of document order, so compare as multisets
      const key = (x: { key: string; text: string }) => `${x.key}|${x.text}`;
      expect(spans.map(key).sort()).toEqual(recorded.map(key).sort());
    }
  });

  it('documents are self-contained (no external stylesheet, script, font or image)', () => {
    for (const name of ['summary.html', 'ledger.html', 'execution.html', 'plan-e-one-pager.html'] as const) {
      const html = docs[name];
      expect(html).not.toMatch(/<link\b/i);
      expect(html).not.toMatch(/<script\b/i);
      expect(html).not.toMatch(/https?:\/\//);
      expect(html).toMatch(/<style>/);
    }
  });

  it('every known limitation appears in the summary, the ledger and the register', () => {
    for (const lim of built.knownLimitations) {
      expect(docs['summary.html']).toContain(lim.id);
      expect(docs['ledger.html']).toContain(lim.id);
      expect(docs['assumptions.md']).toContain(lim.id);
    }
  });

  it('the register lists every assumption key with its status', () => {
    for (const [key, e] of Object.entries(assumptionsFile.entries)) {
      expect(docs['assumptions.md']).toContain('`' + key + '`');
      expect(docs['assumptions.md']).toContain(`| ${(e as { status: string }).status} |`);
    }
  });

  it('templates contain no hand-typed numbers (render.mjs) and formatters contain no plan numbers (fmt.mjs)', () => {
    const src = fs.readFileSync(path.join(root, 'plan/render/render.mjs'), 'utf8');
    // strip the CSS block, comments and em.v(...) emission calls, then look for digit runs that could be a planning number
    const stripped = src.replace(/const CSS = `[\s\S]*?`;/, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').replace(/em\.v\([^;]*?\)\)?/g, 'EMIT');
    const offenders = Array.from(stripped.matchAll(/£\s*\d|\b\d{1,3}(,\d{3})+\b|\b\d{4,}\b|\b\d+\.\d+\b/g)).map((m) => m[0]);
    expect(offenders, offenders.join(', ')).toEqual([]);
    const f = fs.readFileSync(path.join(root, 'plan/render/fmt.mjs'), 'utf8');
    expect(f).not.toMatch(/\b\d{5,}\b/);
  });

  it('renders deterministically', () => {
    const again = renderAll(outputs, inputs, { generatedAt: '2026-09-21', assumptionsFile, drift: { verdict: 'AMBER', items: [{ level: 'AMBER', item: 'spend.planLine', detail: 'test' }] } });
    expect(again['summary.html']).toBe(docs['summary.html']);
    expect(again['ledger.csv']).toBe(docs['ledger.csv']);
  });
});
