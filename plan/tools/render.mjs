#!/usr/bin/env node
// @ts-check
/**
 * Render the plan documents from the repo's current inputs (offline) or from a
 * saved inputs file (as the run job does).
 *
 *   npm run plan:render                        # repo inputs → tmp/plan-render-<today>/
 *   npm run plan:render -- --inputs tmp/plan-inputs-2026-09-21.json --out tmp/render
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPlan } from '../engine/index.mjs';
import { assembleInputsFromRepo } from '../engine/run-standalone.mjs';
import { renderAll } from '../render/render.mjs';
import { writeWorkbook } from '../render/xlsx.mjs';
import { htmlToPdf } from '../render/pdf.mjs';

const planDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (/** @type {string} */ name) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : undefined; };
const inputs = opt('inputs') ? JSON.parse(fs.readFileSync(/** @type {string} */ (opt('inputs')), 'utf8')) : assembleInputsFromRepo();
const outputs = runPlan(inputs);
const assumptionsFile = JSON.parse(fs.readFileSync(path.join(planDir, 'assumptions.json'), 'utf8'));
const docs = renderAll(outputs, inputs, { generatedAt: inputs.today, assumptionsFile, drift: inputs.drift ?? null });
const out = opt('out') ?? path.join('tmp', `plan-render-${inputs.today}`);
fs.mkdirSync(out, { recursive: true });
for (const [name, text] of Object.entries(docs)) fs.writeFileSync(path.join(out, name), text);
fs.writeFileSync(path.join(out, 'outputs.json'), JSON.stringify(outputs, null, 1));
fs.writeFileSync(path.join(out, 'inputs.json'), JSON.stringify(inputs, null, 1));
writeWorkbook(outputs, inputs, path.join(out, 'plan.xlsx'), { assumptionsFile });
if (args.includes('--pdf')) htmlToPdf(path.join(out, 'summary.html'), path.join(out, 'summary.pdf'), console.log);
console.log(`rendered ${Object.keys(docs).length} documents + plan.xlsx + inputs/outputs to ${out}${args.includes('--pdf') ? ' (+ summary.pdf if Edge printed it)' : ''}`);
