/**
 * Phase 5: the run job — diff rules with fixtures, manifest immutability of every
 * accepted run, and an offline end-to-end run into a temp folder.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import rules from '../../../plan/inputs/diff-rules.json';
import { diffRuns, diffToMarkdown, diffToText } from '../../../plan/inputs/diff.mjs';
import { writeManifest, verifyManifest } from '../../../plan/inputs/manifest.mjs';

const root = path.resolve(__dirname, '../../..');

const base = {
  inputs: { today: '2026-09-21', assumptions: { pots: { chrisIiIsa: 276_716 }, ladder: { budgetReal: 909_390 }, spend: { planLine: 70_000 } } },
  outputs: { ledger: { headline: { atRetirement: 2284, atLastRung: 2203, atEnd: 2215, firstCashNegative: null }, wrappers: { isa: { R: 98.7 }, sipp: { R: 106.3 } } }, ladder: { totals: { estCost: 909_390 } }, outlook: { sustainableSpend: 97_356 }, pivot: { avcRecipe: { avcPct: 55, aboveCliff: false, nmwOk: true } } },
};
const clone = () => JSON.parse(JSON.stringify(base));

describe('run diff (phase 5)', () => {
  it('first run with no baseline is AMBER with a baseline note', () => {
    const d = diffRuns(null, clone(), rules);
    expect(d.verdict).toBe('AMBER');
    expect(d.items[0].area).toBe('baseline');
    expect(diffToMarkdown(d, { runId: '2026-09-21' })).toContain('candidate baseline');
  });
  it('identical runs are GREEN', () => {
    expect(diffRuns(clone(), clone(), rules).verdict).toBe('GREEN');
  });
  it('grades pot drift, ledger totals, ladder cost, sustainable spend and the AVC % by the rules', () => {
    const n = clone(); n.inputs.assumptions.pots.chrisIiIsa = 276_716 * 1.05;
    expect(diffRuns(clone(), n, rules).items.find((i) => i.item === 'pots.chrisIiIsa')?.level).toBe('AMBER');
    n.inputs.assumptions.pots.chrisIiIsa = 276_716 * 1.2;
    expect(diffRuns(clone(), n, rules).items.find((i) => i.item === 'pots.chrisIiIsa')?.level).toBe('RED');
    const l = clone(); l.outputs.ledger.headline.atEnd = 2215 * 0.9;
    expect(diffRuns(clone(), l, rules).items.find((i) => i.item === 'atEnd')?.level).toBe('RED');
    const c = clone(); c.outputs.ladder.totals.estCost = 909_390 * 1.01;
    expect(diffRuns(clone(), c, rules).items.find((i) => i.item === 'cost vs budget')?.level).toBe('RED');
    const s = clone(); s.outputs.outlook.sustainableSpend = 97_356 + 2_000;
    expect(diffRuns(clone(), s, rules).items.find((i) => i.item === 'sustainable spend')?.level).toBe('AMBER');
    const p = clone(); p.outputs.pivot.avcRecipe.avcPct = 31;
    expect(diffRuns(clone(), p, rules).items.find((i) => i.item === 'AVC % to set')?.level).toBe('RED');
    const dep = clone(); dep.outputs.ledger.headline.firstCashNegative = 2071;
    expect(diffRuns(clone(), dep, rules).verdict).toBe('RED');
    expect(diffToText(diffRuns(clone(), p, rules), { runId: 'x', prevId: 'y' })).toContain('55% → 31%');
  });
  it('carries drift and freshness items from the inputs', () => {
    const n = clone(); n.inputs.drift = { items: [{ level: 'RED', item: 'spend.planLine', detail: 'over' }] }; n.inputs.freshness = [{ key: 'tax.personalAllowance', reviewBy: '2026-01-01', daysOver: 120, status: 'FACT' }];
    const d = diffRuns(clone(), n, rules);
    expect(d.items.filter((i) => i.level === 'RED').map((i) => i.item).sort()).toEqual(['spend.planLine', 'tax.personalAllowance']);
  });
});

describe('manifests and accepted runs (phase 5)', () => {
  it('writeManifest / verifyManifest detect any change to a run folder', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'plan-run-'));
    fs.writeFileSync(path.join(dir, 'outputs.json'), '{"a":1}');
    fs.writeFileSync(path.join(dir, 'summary.html'), '<p>x</p>');
    writeManifest(dir, { engineVersion: 'test', cwd: root });
    expect(verifyManifest(dir).ok).toBe(true);
    fs.writeFileSync(path.join(dir, 'summary.html'), '<p>y</p>');
    expect(verifyManifest(dir).problems).toEqual(['summary.html: hash differs from the manifest']);
    fs.writeFileSync(path.join(dir, 'extra.txt'), 'z');
    expect(verifyManifest(dir).problems).toContain('extra.txt: not in the manifest');
  });
  it('every accepted run in plan/runs still matches its manifest (immutability)', () => {
    const runs = path.join(root, 'plan/runs');
    const accepted = fs.readdirSync(runs).filter((d) => fs.existsSync(path.join(runs, d, 'ACCEPTED.json')));
    for (const d of accepted) { const v = verifyManifest(path.join(runs, d)); expect(v.problems, d).toEqual([]); }
    const latest = path.join(runs, 'LATEST_ACCEPTED');
    if (fs.existsSync(latest)) expect(accepted).toContain(fs.readFileSync(latest, 'utf8').trim());
  });
  it('offline end-to-end: plan:run writes a complete, manifest-verified run folder', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'plan-runs-'));
    execFileSync('npx', ['tsx', 'scripts/plan-run.ts', '--offline', '--no-notify', '--no-pdf', '--dir', dir, '--today', '2026-09-21', '--tag', 'test'], { cwd: root, encoding: 'utf8', shell: true, maxBuffer: 50e6 });
    const run = path.join(dir, '2026-09-21-test');
    for (const f of ['inputs.json', 'outputs.json', 'diff.md', 'summary.json', 'manifest.json', 'summary.html', 'ledger.html', 'assumptions.md', 'avc-recipe.md', 'ledger.csv', 'order-sheet-isa.csv', 'order-sheet-sipp.csv', 'emissions.json']) expect(fs.existsSync(path.join(run, f)), f).toBe(true);
    expect(verifyManifest(run).ok).toBe(true);
    const summary = JSON.parse(fs.readFileSync(path.join(run, 'summary.json'), 'utf8'));
    expect(summary.verdict).toBe('AMBER'); // no baseline yet in a fresh dir
    expect(summary.avcPct).toBe(55);
    // accept it, then a second run diffs against it and is GREEN
    execFileSync('npx', ['tsx', 'scripts/plan-accept.ts', '2026-09-21-test', '--dir', dir, '--note', 'test'], { cwd: root, encoding: 'utf8', shell: true });
    expect(fs.readFileSync(path.join(dir, 'LATEST_ACCEPTED'), 'utf8').trim()).toBe('2026-09-21-test');
    execFileSync('npx', ['tsx', 'scripts/plan-run.ts', '--offline', '--no-notify', '--no-pdf', '--dir', dir, '--today', '2026-09-21', '--tag', 'again'], { cwd: root, encoding: 'utf8', shell: true, maxBuffer: 50e6 });
    expect(JSON.parse(fs.readFileSync(path.join(dir, '2026-09-21-again', 'summary.json'), 'utf8')).verdict).toBe('GREEN');
  }, 180_000);
});
