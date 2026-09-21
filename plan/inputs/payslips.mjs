// @ts-check
/**
 * Payslip observations: plan/observations/payslips/YYYY-MM.json, one per
 * payslip, entered by hand from the PDF. Newest wins.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatePayslip } from './observe.mjs';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'observations', 'payslips');

export function listPayslips() {
  return fs.readdirSync(dir).filter((f) => /^\d{4}-\d{2}\.json$/.test(f)).sort();
}

export function newestPayslip() {
  const files = listPayslips();
  if (!files.length) return null;
  const file = files[files.length - 1];
  const slip = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  const problems = validatePayslip(slip);
  if (problems.length) throw new Error(`payslip ${file} is invalid: ${problems.join('; ')}`);
  return { file, month: file.slice(0, 7), slip };
}

/**
 * Write a new payslip file (refuses to overwrite unless force).
 * @param {string} month YYYY-MM
 * @param {any} slip
 * @param {{ force?: boolean }} [opts]
 */
export function writePayslip(month, slip, opts = {}) {
  const problems = validatePayslip(slip);
  if (problems.length) throw new Error('invalid payslip: ' + problems.join('; '));
  const p = path.join(dir, month + '.json');
  if (fs.existsSync(p) && !opts.force) throw new Error(`${p} exists; pass --force to overwrite`);
  fs.writeFileSync(p, JSON.stringify(slip, null, 2) + '\n');
  return p;
}
