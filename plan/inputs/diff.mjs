// @ts-check
/**
 * Compare a new run with the last accepted run. Pure: takes the two inputs and
 * outputs objects plus the rules; returns graded items and a Markdown report.
 */
import { getPath } from '../render/render.mjs';
import { gbpShort, gbpFromK, pct, int } from '../render/fmt.mjs';

/**
 * @typedef {{ level: 'OK'|'AMBER'|'RED', area: string, item: string, before: string, after: string, detail: string }} DiffItem
 */

const rel = (/** @type {number} */ x, /** @type {number} */ y) => (y === 0 ? (x === 0 ? 0 : 1) : Math.abs(x - y) / Math.abs(y));

/**
 * @param {{ inputs: any, outputs: any } | null} prev  the last accepted run (null on the first run)
 * @param {{ inputs: any, outputs: any }} next
 * @param {any} rules  plan/inputs/diff-rules.json
 */
export function diffRuns(prev, next, rules) {
  /** @type {DiffItem[]} */
  const items = [];
  const add = (/** @type {DiffItem['level']} */ level, /** @type {string} */ area, /** @type {string} */ item, /** @type {string} */ before, /** @type {string} */ after, /** @type {string} */ detail = '') => items.push({ level, area, item, before, after, detail });
  const grade = (/** @type {number} */ r, /** @type {{ amberRel?: number, redRel?: number }} */ t, /** @type {number} */ abs = 0, /** @type {number} */ amberAbs = Infinity) => (r > (t.redRel ?? Infinity) ? 'RED' : r > (t.amberRel ?? Infinity) || abs > amberAbs ? 'AMBER' : 'OK');
  const a = next.inputs.assumptions, o = next.outputs;

  if (!prev) {
    add('AMBER', 'baseline', 'no accepted run yet', '–', next.inputs.today ?? '', 'this run becomes the baseline once accepted (npm run plan:accept)');
  } else {
    const pa = prev.inputs.assumptions, po = prev.outputs;
    // 1. assumptions that changed
    const flatten = (/** @type {any} */ obj, prefix = '', /** @type {Record<string, unknown>} */ out = {}) => { for (const [k, v] of Object.entries(obj ?? {})) { if (k.startsWith('__')) continue; if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, prefix + k + '.', out); else out[prefix + k] = v; } return out; };
    const fa = flatten(a), fp = flatten(pa);
    for (const k of Array.from(new Set([...Object.keys(fa), ...Object.keys(fp)]))) {
      if (JSON.stringify(fa[k]) !== JSON.stringify(fp[k])) {
        const isPot = k.startsWith('pots.');
        const level = isPot && typeof fa[k] === 'number' && typeof fp[k] === 'number' ? grade(rel(/** @type {number} */ (fa[k]), /** @type {number} */ (fp[k])), rules.pots, Math.abs(/** @type {number} */ (fa[k]) - /** @type {number} */ (fp[k])), rules.pots.amberAbs) : 'AMBER';
        add(level, 'assumptions', k, JSON.stringify(fp[k]), JSON.stringify(fa[k]));
      }
    }
    // 2. ledger totals at retirement / last rung / end
    for (const key of ['atRetirement', 'atLastRung', 'atEnd']) {
      const x = o.ledger?.headline?.[key], y = po.ledger?.headline?.[key];
      if (typeof x === 'number' && typeof y === 'number') add(grade(rel(x, y), rules.ledgerTotals), 'ledger', key, gbpFromK(y), gbpFromK(x), `${rel(x, y) >= 0 ? (x >= y ? '+' : '−') : ''}${pct(rel(x, y), 1)}`);
    }
    if (o.ledger?.headline?.firstCashNegative && !po.ledger?.headline?.firstCashNegative) add('RED', 'ledger', 'cash runs out', 'never', String(o.ledger.headline.firstCashNegative), 'a depletion year appeared in the planning case');
    // 3. ladder redemption per rung and cost vs budget
    for (const w of ['isa', 'sipp']) {
      const x = o.ledger?.wrappers?.[w]?.R, y = po.ledger?.wrappers?.[w]?.R;
      if (typeof x === 'number' && typeof y === 'number') add(grade(rel(x, y), rules.ladderRedemption), 'ladder', `${w} redemption per rung`, gbpFromK(y), gbpFromK(x), 'yield-driven unless the budget moved');
    }
    if (o.ladder && typeof o.ladder.totals?.estCost === 'number') {
      const r = rel(o.ladder.totals.estCost, a.ladder.budgetReal);
      add(r > rules.ladderCostVsBudgetRel ? 'RED' : 'OK', 'ladder', 'cost vs budget', gbpShort(a.ladder.budgetReal), gbpShort(o.ladder.totals.estCost), 'must equal the budget by construction');
    }
    // 4. sustainable spend
    const sx = o.outlook?.sustainableSpend, sy = po.outlook?.sustainableSpend;
    if (typeof sx === 'number' && typeof sy === 'number') { const d = Math.abs(sx - sy); add(d > rules.sustainableSpend.redAbs ? 'RED' : d > rules.sustainableSpend.amberAbs ? 'AMBER' : 'OK', 'outlook', 'sustainable spend', gbpShort(sy), gbpShort(sx)); }
    // 5. AVC recipe
    const ax = o.pivot?.avcRecipe?.avcPct, ay = po.pivot?.avcRecipe?.avcPct;
    if (typeof ax === 'number' && typeof ay === 'number' && ax !== ay) add(rules.avcPct.anyChangeIsRed ? 'RED' : 'AMBER', 'pivot', 'AVC % to set', int(ay) + '%', int(ax) + '%', 'act on the payslip');
    if (o.pivot?.avcRecipe && (o.pivot.avcRecipe.aboveCliff || !o.pivot.avcRecipe.nmwOk)) add('RED', 'pivot', 'AVC recipe', '', o.pivot.avcRecipe.aboveCliff ? 'ANI above the cliff' : 'NMW floor breached', 'AVC alone cannot get there');
  }
  // 6. carried from the run itself: drift and freshness (already graded)
  for (const d of next.inputs.drift?.items ?? []) add(d.level, 'inputs', d.item, '', '', d.detail);
  for (const s of next.inputs.freshness ?? []) add(s.daysOver > rules.reviewByDaysOver.red ? 'RED' : 'AMBER', 'freshness', s.key, s.reviewBy, `${s.daysOver} days over`, s.status);
  const verdict = items.some((i) => i.level === 'RED') ? 'RED' : items.some((i) => i.level === 'AMBER') ? 'AMBER' : 'GREEN';
  return { verdict, items, prevRun: prev ? prev.inputs.today ?? null : null };
}

/** @param {ReturnType<typeof diffRuns>} d @param {{ runId: string, prevId?: string | null }} meta */
export function diffToMarkdown(d, meta) {
  const lines = [`# Run ${meta.runId} — ${d.verdict}`, '', meta.prevId ? `Compared with the last accepted run ${meta.prevId}.` : 'No accepted run to compare with; this run is the candidate baseline.', '', '| Level | Area | Item | Before | After | Detail |', '|---|---|---|---|---|---|'];
  for (const i of d.items) lines.push(`| ${i.level} | ${i.area} | ${i.item} | ${i.before} | ${i.after} | ${i.detail} |`);
  if (!d.items.length) lines.push('| OK | – | nothing changed | | | |');
  return lines.join('\n') + '\n';
}

/** Short text for a chat notification. @param {ReturnType<typeof diffRuns>} d @param {{ runId: string, prevId?: string | null }} meta */
export function diffToText(d, meta) {
  const worst = d.items.filter((/** @type {DiffItem} */ i) => i.level !== 'OK').slice(0, 8).map((/** @type {DiffItem} */ i) => `• ${i.level} ${i.area}/${i.item}${i.after ? `: ${i.before ? i.before + ' → ' : ''}${i.after}` : ''}${i.detail ? ` (${i.detail})` : ''}`);
  return `Plan run ${meta.runId}: ${d.verdict}${meta.prevId ? ` vs accepted ${meta.prevId}` : ' (no baseline yet)'}\n${worst.join('\n') || '• nothing outside tolerance'}`;
}

export { getPath };
