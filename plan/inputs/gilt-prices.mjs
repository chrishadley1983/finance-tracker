// @ts-check
/* global fetch */
/**
 * Gilt price observation: live from dividenddata.co.uk, falling back to the
 * newest file in plan/observations/gilt-prices/. The only network call in
 * the plan tooling. Used by the order sheet and by collectInputs.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseGiltTable } from '../engine/ladder.mjs';

export const GILT_SOURCE = 'https://www.dividenddata.co.uk/index-linked-gilts-prices-yields.py';
const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'observations', 'gilt-prices');

export function newestGiltPriceFile() {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  if (!files.length) throw new Error('no gilt-price observation file in plan/observations/gilt-prices');
  const file = files[files.length - 1];
  return { file, obs: JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')) };
}

/**
 * @param {{ offline?: boolean, save?: boolean, log?: (msg: string) => void }} [opts]
 * @returns {Promise<{ asOf: string, source: string, gilts: any[], live: boolean, file?: string }>}
 */
export async function getGiltPrices(opts = {}) {
  const log = opts.log ?? (() => {});
  if (!opts.offline) {
    try {
      const res = await fetch(GILT_SOURCE, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (res.ok) {
        const gilts = parseGiltTable(await res.text());
        if (gilts.length) {
          const obs = { asOf: new Date().toISOString(), source: GILT_SOURCE + ' (LSE ~15-min delay)', gilts, live: true };
          if (opts.save) { const p = path.join(dir, obs.asOf.slice(0, 10) + '.json'); fs.writeFileSync(p, JSON.stringify({ asOf: obs.asOf, source: obs.source, gilts }, null, 2) + '\n'); log(`saved ${p}`); return { ...obs, file: path.basename(p) }; }
          return obs;
        }
        log('live table parsed to zero rows; using the newest observation file');
      } else log(`live fetch failed (HTTP ${res.status}); using the newest observation file`);
    } catch (e) { log(`live fetch failed (${/** @type {Error} */ (e).message}); using the newest observation file`); }
  }
  const { file, obs } = newestGiltPriceFile();
  return { ...obs, live: false, file };
}
