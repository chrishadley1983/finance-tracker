// @ts-check
/**
 * Run folder manifest: sha256 of every file, engine version, git sha, node.
 * An accepted run is immutable; `verifyManifest` proves it still is.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

export const MANIFEST = 'manifest.json';
export const ACCEPTED = 'ACCEPTED.json';

export function sha256(/** @type {string} */ file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

export function gitSha(/** @type {string} */ cwd) {
  try { return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd, encoding: 'utf8' }).trim(); } catch { return null; }
}

/** @param {string} dir @param {{ engineVersion: string, cwd: string, extra?: Record<string, unknown> }} meta */
export function writeManifest(dir, meta) {
  const files = fs.readdirSync(dir).filter((f) => f !== MANIFEST && f !== ACCEPTED && fs.statSync(path.join(dir, f)).isFile()).sort();
  const manifest = { writtenAt: new Date().toISOString(), engineVersion: meta.engineVersion, gitSha: gitSha(meta.cwd), node: process.version, files: Object.fromEntries(files.map((f) => [f, { sha256: sha256(path.join(dir, f)), bytes: fs.statSync(path.join(dir, f)).size }])), ...(meta.extra ?? {}) };
  fs.writeFileSync(path.join(dir, MANIFEST), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}

/** @param {string} dir @returns {{ ok: boolean, problems: string[] }} */
export function verifyManifest(dir) {
  const p = path.join(dir, MANIFEST);
  if (!fs.existsSync(p)) return { ok: false, problems: ['no manifest.json'] };
  const m = JSON.parse(fs.readFileSync(p, 'utf8'));
  const problems = [];
  for (const [f, info] of Object.entries(m.files)) {
    const fp = path.join(dir, f);
    if (!fs.existsSync(fp)) { problems.push(`${f}: missing`); continue; }
    if (sha256(fp) !== /** @type {{ sha256: string }} */ (info).sha256) problems.push(`${f}: hash differs from the manifest`);
  }
  for (const f of fs.readdirSync(dir)) if (f !== MANIFEST && f !== ACCEPTED && fs.statSync(path.join(dir, f)).isFile() && !(f in m.files)) problems.push(`${f}: not in the manifest`);
  return { ok: problems.length === 0, problems };
}
