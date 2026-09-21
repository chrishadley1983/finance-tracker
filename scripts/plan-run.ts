/**
 * npm run plan:run — the scheduled/manual plan run.
 *
 * 1. collect inputs (assumptions + live observations; --offline = repo files only)
 * 2. runPlan(inputs) → outputs; prove the standalone runner gives byte-identical output
 * 3. diff against plan/runs/LATEST_ACCEPTED (tolerances in plan/inputs/diff-rules.json)
 * 4. render the documents; write plan/runs/<today>[-tag]/ with a manifest
 * 5. notify: Discord always (if DISCORD_WEBHOOK_PLAN is set), email on RED or failure
 * 6. exit 1 on RED so Task Scheduler shows it
 *
 *   npm run plan:run                     # live
 *   npm run plan:run -- --offline        # no DB, no network
 *   npm run plan:run -- --check-only     # steps 1–3 + notify; nothing written
 *   npm run plan:run -- --tag q3-review  # folder plan/runs/<today>-q3-review
 *   npm run plan:run -- --dir tmp/runs   # write somewhere else (tests)
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { loadEnvConfig } from '@next/env';
import { collectInputs } from '../plan/inputs/collect';
import { freshness } from '../plan/inputs/assumptions.mjs';
import { runPlan } from '../plan/engine/index.mjs';
import { renderAll } from '../plan/render/render.mjs';
import { diffRuns, diffToMarkdown, diffToText } from '../plan/inputs/diff.mjs';
import { writeManifest } from '../plan/inputs/manifest.mjs';
import { notifyDiscord, notifyEmail } from '../plan/inputs/notify.mjs';

loadEnvConfig(process.cwd(), true);
const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const opt = (name: string) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : undefined; };
const runsDir = path.resolve(root, opt('dir') ?? 'plan/runs');
const today = opt('today') ?? new Date().toISOString().slice(0, 10);
const runId = today + (opt('tag') ? '-' + opt('tag') : '');
const log = (m: string) => console.log(m);

export async function main() {
  const started = Date.now();
  log(`[${new Date().toISOString()}] plan run ${runId} (${args.includes('--offline') ? 'offline' : 'live'}${args.includes('--check-only') ? ', check-only' : ''})`);
  const assumptionsFile = JSON.parse(fs.readFileSync(path.join(root, 'plan/assumptions.json'), 'utf8'));
  const { inputs: collected, drift } = await collectInputs({ live: !args.includes('--offline'), savePrices: !args.includes('--offline') && !args.includes('--check-only'), today, log: (m) => log('  ' + m) });
  const inputs = { ...collected, drift, freshness: freshness(assumptionsFile, new Date(today)), runId };

  const outputs = runPlan(inputs);
  // determinism / durability proof: the standalone runner on the same inputs must match byte for byte
  const tmpIn = path.join(root, 'tmp', `plan-run-${runId}-inputs.json`);
  fs.mkdirSync(path.dirname(tmpIn), { recursive: true });
  fs.writeFileSync(tmpIn, JSON.stringify(inputs));
  const standalone = execFileSync('node', ['plan/engine/run-standalone.mjs', tmpIn], { cwd: root, encoding: 'utf8', maxBuffer: 100e6 });
  if (JSON.stringify(JSON.parse(standalone)) !== JSON.stringify(outputs)) throw new Error('standalone runner output differs from the in-process engine');
  log(`  engine ${outputs.engineVersion}: standalone output identical`);

  // last accepted run
  const latestFile = path.join(runsDir, 'LATEST_ACCEPTED');
  const prevId = fs.existsSync(latestFile) ? fs.readFileSync(latestFile, 'utf8').trim() : null;
  const prev = prevId && fs.existsSync(path.join(runsDir, prevId, 'outputs.json')) ? { inputs: JSON.parse(fs.readFileSync(path.join(runsDir, prevId, 'inputs.json'), 'utf8')), outputs: JSON.parse(fs.readFileSync(path.join(runsDir, prevId, 'outputs.json'), 'utf8')) } : null;
  const rules = JSON.parse(fs.readFileSync(path.join(root, 'plan/inputs/diff-rules.json'), 'utf8'));
  const diff = diffRuns(prev, { inputs, outputs }, rules);
  const diffMd = diffToMarkdown(diff, { runId, prevId });
  const text = diffToText(diff, { runId, prevId });
  log('\n' + text + '\n');

  let dir: string | null = null;
  if (!args.includes('--check-only')) {
    dir = path.join(runsDir, runId);
    fs.mkdirSync(dir, { recursive: true });
    const docs = renderAll(outputs, inputs, { generatedAt: today, assumptionsFile, drift, runId });
    fs.writeFileSync(path.join(dir, 'inputs.json'), JSON.stringify(inputs, null, 1));
    fs.writeFileSync(path.join(dir, 'outputs.json'), JSON.stringify(outputs, null, 1));
    fs.writeFileSync(path.join(dir, 'diff.md'), diffMd);
    fs.writeFileSync(path.join(dir, 'summary.json'), JSON.stringify({ runId, today, verdict: diff.verdict, prevId, headline: outputs.ledger?.headline, avcPct: outputs.pivot.avcRecipe?.avcPct ?? null, ladderPerYear: outputs.ladder?.amountPerYear ?? null, sustainableSpend: outputs.outlook.sustainableSpend, potsTotal: (inputs.assumptions as Record<string, any>).pots.total }, null, 2));
    for (const [name, content] of Object.entries(docs)) fs.writeFileSync(path.join(dir, name), content);
    writeManifest(dir, { engineVersion: outputs.engineVersion, cwd: root, extra: { runId, verdict: diff.verdict, prevId } });
    log(`  written: ${path.relative(root, dir)} (${Object.keys(docs).length + 5} files)`);
  }
  fs.rmSync(tmpIn, { force: true });

  await notifyDiscord(text + (dir ? `\n${path.relative(root, dir)}` : ''), log);
  if (diff.verdict === 'RED' && !args.includes('--no-email')) {
    const summaryHtml = dir ? fs.readFileSync(path.join(dir, 'summary.html'), 'utf8') : `<pre>${text}</pre>`;
    notifyEmail({ subject: `Household plan run ${runId}: RED`, html: `<pre style="font:14px system-ui">${text.replace(/</g, '&lt;')}</pre><hr>` + summaryHtml, attachments: dir ? [path.join(dir, 'diff.md')] : [] }, log);
  }
  log(`done in ${((Date.now() - started) / 1000).toFixed(1)}s — ${diff.verdict}${dir ? `; accept with: npm run plan:accept -- ${runId}` : ''}`);
  process.exit(diff.verdict === 'RED' ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  notifyDiscord(`Plan run ${runId} FAILED: ${(e as Error).message}`, log).finally(() => {
    notifyEmail({ subject: `Household plan run ${runId}: FAILED`, html: `<pre>${String((e as Error).stack ?? e).replace(/</g, '&lt;')}</pre>` }, log);
    process.exit(1);
  });
});
