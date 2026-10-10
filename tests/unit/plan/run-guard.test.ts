/**
 * plan:run must never rewrite an accepted (hash-locked) run, and dates runs by the UK calendar.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ukToday } from '../../../plan/inputs/uk-date.mjs';

const execAsync = promisify(execFile);
const root = path.resolve(__dirname, '../../..');

describe('ukToday', () => {
  it('is the London date, not the UTC date, just after midnight BST', () => {
    expect(ukToday(new Date('2026-07-15T23:30:00Z'))).toBe('2026-07-16'); // 00:30 BST
    expect(ukToday(new Date('2026-04-05T23:30:00Z'))).toBe('2026-04-06'); // first day of the tax year in the UK
  });
  it('equals the UTC date in winter (GMT)', () => {
    expect(ukToday(new Date('2026-01-15T23:30:00Z'))).toBe('2026-01-15');
  });
});

describe('plan:run accepted-run guard', () => {
  it('refuses to overwrite a folder that holds ACCEPTED.json, leaving it byte-for-byte intact', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'plan-guard-'));
    const run = path.join(dir, '2026-09-21-test');
    fs.mkdirSync(run);
    fs.writeFileSync(path.join(run, 'ACCEPTED.json'), '{"acceptedOn":"2026-09-21"}');
    fs.writeFileSync(path.join(run, 'outputs.json'), '{"original":true}');
    const res = await execAsync(
      'npx',
      ['tsx', 'scripts/plan-run.ts', '--offline', '--no-notify', '--no-pdf', '--dir', dir, '--today', '2026-09-21', '--tag', 'test'],
      { cwd: root, encoding: 'utf8', shell: true, maxBuffer: 50e6 },
    ).catch((e) => e as { code: number; stderr: string });
    expect(String((res as { stderr?: string }).stderr)).toMatch(/accepted run — refusing to overwrite/);
    expect(fs.readFileSync(path.join(run, 'outputs.json'), 'utf8')).toBe('{"original":true}');
    expect(fs.existsSync(path.join(run, 'manifest.json'))).toBe(false);
  }, 180_000);
});
