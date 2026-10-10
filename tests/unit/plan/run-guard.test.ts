/**
 * plan:run must never rewrite an accepted (hash-locked) run, and dates runs by the UK calendar.
 */
import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ukToday } from '../../../plan/inputs/uk-date.mjs';
import { guardAcceptedRun } from '../../../plan/inputs/run-guard.mjs';

const execAsync = promisify(execFile);
const root = path.resolve(__dirname, '../../..');
const dirs: string[] = [];
const tempRuns = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'plan-guard-'));
  dirs.push(d);
  return d;
};
afterEach(() => {
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});
function acceptedRun(runsDir: string, id: string) {
  const run = path.join(runsDir, id);
  fs.mkdirSync(run, { recursive: true });
  fs.writeFileSync(path.join(run, 'ACCEPTED.json'), '{"acceptedOn":"2026-09-21"}');
  fs.writeFileSync(path.join(run, 'outputs.json'), '{"original":true}');
  return run;
}

describe('ukToday', () => {
  it('is the London date, not the UTC date, just after midnight BST', () => {
    expect(ukToday(new Date('2026-07-15T23:30:00Z'))).toBe('2026-07-16'); // 00:30 BST
    expect(ukToday(new Date('2026-04-05T23:30:00Z'))).toBe('2026-04-06'); // first day of the UK tax year
  });
  it('equals the UTC date in winter (GMT)', () => {
    expect(ukToday(new Date('2026-01-15T23:30:00Z'))).toBe('2026-01-15');
  });
});

describe('guardAcceptedRun', () => {
  it('passes when the run folder has no ACCEPTED.json (or does not exist)', () => {
    const d = tempRuns();
    fs.mkdirSync(path.join(d, '2026-10-10'));
    expect(guardAcceptedRun(d, '2026-10-10').warning).toBeNull();
    expect(guardAcceptedRun(d, '2026-10-11').warning).toBeNull();
  });

  it('refuses an accepted run without --force and touches nothing', () => {
    const d = tempRuns();
    const run = acceptedRun(d, '2026-09-21');
    expect(() => guardAcceptedRun(d, '2026-09-21')).toThrow(/accepted run — refusing to overwrite/);
    expect(fs.existsSync(path.join(run, 'ACCEPTED.json'))).toBe(true);
  });

  it('--force moves the acceptance aside and warns when it was LATEST_ACCEPTED', () => {
    const d = tempRuns();
    const run = acceptedRun(d, '2026-09-21');
    fs.writeFileSync(path.join(d, 'LATEST_ACCEPTED'), '2026-09-21\n');
    const { warning } = guardAcceptedRun(d, '2026-09-21', { force: true, now: new Date('2026-10-10T12:00:00Z') });
    expect(fs.existsSync(path.join(run, 'ACCEPTED.json'))).toBe(false);
    expect(fs.existsSync(path.join(run, 'ACCEPTED.superseded-2026-10-10T12-00-00-000Z.json'))).toBe(true);
    expect(warning).toMatch(/LATEST_ACCEPTED/);
  });
});

describe('plan:run refuses an accepted run before doing any work', () => {
  it('exits with the refusal and leaves the folder byte-for-byte intact', async () => {
    const d = tempRuns();
    const run = acceptedRun(d, '2026-09-21-guard');
    const res = await execAsync(
      'npx',
      ['tsx', 'scripts/plan-run.ts', '--offline', '--no-notify', '--no-pdf', '--dir', d, '--today', '2026-09-21', '--tag', 'guard'],
      { cwd: root, encoding: 'utf8', shell: true, maxBuffer: 50e6 },
    ).catch((e) => e as { stderr: string; stdout: string });
    expect(String((res as { stderr?: string }).stderr)).toMatch(/accepted run — refusing to overwrite/);
    expect(String((res as { stdout?: string }).stdout)).not.toMatch(/collect|engine|verdict/i); // nothing ran first
    expect(fs.readFileSync(path.join(run, 'outputs.json'), 'utf8')).toBe('{"original":true}');
    expect(fs.readdirSync(run).sort()).toEqual(['ACCEPTED.json', 'outputs.json']);
  }, 120_000);
});
