// @ts-check
/**
 * PDF export of a rendered HTML document via headless Microsoft Edge (present
 * on this Windows machine; no npm dependency). Best effort: returns null when
 * Edge is not found or printing fails, and never throws.
 *
 * Edge's launcher process returns almost immediately (exit 0) while the real
 * browser process keeps running and writes the PDF a few seconds later, so the
 * result is decided by polling for the file, not by the exit status.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const EDGE_CANDIDATES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];
const WAIT_MS = 60_000;
const POLL_MS = 250;

export function findEdge() {
  return EDGE_CANDIDATES.find((p) => fs.existsSync(p)) ?? null;
}

/** @param {number} ms */
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/** Wait until the file exists with a non-trivial size that has stopped growing. @param {string} file @param {number} ms */
function waitForFile(file, ms) {
  const until = Date.now() + ms;
  let last = -1;
  while (Date.now() < until) {
    const size = fs.existsSync(file) ? fs.statSync(file).size : 0;
    if (size > 1000 && size === last) return true;
    last = size;
    sleep(POLL_MS);
  }
  return false;
}

/** @param {string} htmlFile absolute path @param {string} pdfFile absolute path @param {(m: string) => void} [log] */
export function htmlToPdf(htmlFile, pdfFile, log = () => {}) {
  const edge = findEdge();
  if (!edge) { log('  pdf: Microsoft Edge not found — skipped'); return null; }
  const url = 'file:///' + path.resolve(htmlFile).replace(/\\/g, '/');
  // A separate user-data-dir stops Edge handing the request to an already-running browser
  // (which returns exit 0 without printing anything).
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'plan-pdf-'));
  try {
    fs.rmSync(pdfFile, { force: true });
    const r = spawnSync(edge, ['--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${profile}`, '--no-pdf-header-footer', '--run-all-compositor-stages-before-draw', '--virtual-time-budget=5000', `--print-to-pdf=${path.resolve(pdfFile)}`, url], { encoding: 'utf8', timeout: 90_000 });
    if (waitForFile(pdfFile, WAIT_MS)) { log(`  pdf: ${path.basename(pdfFile)} (${Math.round(fs.statSync(pdfFile).size / 1024)} KB)`); return pdfFile; }
    log(`  pdf: failed (${(r.stderr || '').trim().split('\n').pop() || 'exit ' + r.status}; no file after ${WAIT_MS / 1000}s)`);
    return null;
  } finally {
    // Edge helper processes can hold the profile for a moment; it lives in the OS temp folder, so a failed cleanup is harmless.
    sleep(1000);
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* left for the OS temp cleaner */ }
  }
}
