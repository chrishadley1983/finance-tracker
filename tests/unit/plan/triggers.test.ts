/**
 * Phase 6: every trigger named in the assumptions is described in plan/triggers.md;
 * the durability note exists; the accepted-run summary the cockpit imports is well-formed.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import assumptionsFile from '../../../plan/assumptions.json';
import latestAccepted from '../../../plan/runs/latest-accepted.json';

const root = path.resolve(__dirname, '../../..');

describe('triggers, durability note and accepted-run summary (phase 6)', () => {
  it('every trigger token used in assumptions.json has a row in plan/triggers.md', () => {
    const doc = fs.readFileSync(path.join(root, 'plan/triggers.md'), 'utf8');
    const tokens = new Set<string>();
    for (const e of Object.values(assumptionsFile.entries) as Array<{ triggers?: string[] }>) for (const t of e.triggers ?? []) tokens.add(t);
    expect(tokens.size).toBeGreaterThan(8);
    const missing = Array.from(tokens).filter((t) => !doc.includes(`| \`${t}\` |`));
    expect(missing, missing.join(', ')).toEqual([]);
  });

  it('HOW-TO-RERUN-2040.md names the standalone runner and the inputs file', () => {
    const doc = fs.readFileSync(path.join(root, 'plan/HOW-TO-RERUN-2040.md'), 'utf8');
    expect(doc).toContain('run-standalone.mjs');
    expect(doc).toContain('inputs.json');
    expect(doc).toContain('SPEC.md');
    expect(fs.existsSync(path.join(root, 'plan/engine/run-standalone.mjs'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'plan/engine/SPEC.md'))).toBe(true);
  });

  it('plan/runs/latest-accepted.json agrees with plan/runs/LATEST_ACCEPTED', () => {
    const latestFile = path.join(root, 'plan/runs/LATEST_ACCEPTED');
    if (!fs.existsSync(latestFile)) { expect(latestAccepted.runId).toBeNull(); return; }
    const id = fs.readFileSync(latestFile, 'utf8').trim();
    expect(latestAccepted.runId).toBe(id);
    expect(fs.existsSync(path.join(root, 'plan/runs', id, 'ACCEPTED.json'))).toBe(true);
  });

  it('no file outside plan/ imports the retired constants module', () => {
    const walk = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? (['node_modules', '.next', 'plan', '.git', '.claude', 'tmp', 'coverage', 'test-results', 'playwright-report'].includes(d.name) ? [] : walk(path.join(dir, d.name))) : /\.(ts|tsx|mjs)$/.test(d.name) ? [path.join(dir, d.name)] : []));
    const offenders = walk(root).filter((f) => /lib\/plan\/constants|from '\.\/constants'/.test(fs.readFileSync(f, 'utf8')));
    expect(offenders.map((f) => path.relative(root, f))).toEqual([]);
  }, 30_000); // walks the repo (worktrees and tmp excluded)
});
