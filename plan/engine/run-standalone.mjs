#!/usr/bin/env node
// @ts-check
/**
 * The durability path: run the engine from a saved inputs file with nothing
 * but a JavaScript runtime.
 *
 *   node plan/engine/run-standalone.mjs <inputs.json> > outputs.json
 *
 * inputs.json is what plan:run writes into each run folder (assumption
 * values + observations). With no argument it assembles inputs from the
 * repo's current plan/assumptions.json and the newest observation files, so
 * it doubles as the quick way to see today's numbers. See HOW-TO-RERUN-2040.md.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPlan } from './index.mjs';
import { buildAssumptions } from '../inputs/assumptions.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const planDir = path.resolve(here, '..');
const arg = process.argv[2];

/** @param {string} dir */
const newest = (dir) => { const p = path.join(planDir, 'observations', dir); if (!fs.existsSync(p)) return null; const files = fs.readdirSync(p).filter((f) => f.endsWith('.json')).sort(); return files.length ? JSON.parse(fs.readFileSync(path.join(p, files[files.length - 1]), 'utf8')) : null; };

export function assembleInputsFromRepo() {
  const file = JSON.parse(fs.readFileSync(path.join(planDir, 'assumptions.json'), 'utf8'));
  const built = buildAssumptions(file);
  const assumptions = { ...built.values, __preparedOn: built.preparedOn, __knownLimitations: built.knownLimitations };
  return { assumptions, giltPrices: newest('gilt-prices'), giltYields: newest('gilt-yields'), payslip: newest('payslips'), today: new Date().toISOString().slice(0, 10) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const inputs = arg ? JSON.parse(fs.readFileSync(arg, 'utf8')) : assembleInputsFromRepo();
  process.stdout.write(JSON.stringify(runPlan(inputs), null, 1) + '\n');
}
