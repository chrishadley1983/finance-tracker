/**
 * An accepted run (plan/runs/<id>/ACCEPTED.json) is a hash-locked record that latest-accepted.json
 * points at. plan:run must never silently rewrite it and re-sign the manifest. Call this before any
 * network call or write.
 *
 * - no ACCEPTED.json → ok (an unaccepted run of the same id may be overwritten, as before)
 * - ACCEPTED.json, no force → throws
 * - ACCEPTED.json, force → renames it to ACCEPTED.superseded-<stamp>.json so the overwritten run no
 *   longer claims to be accepted (the old acceptance stays on disk and goes into the new manifest);
 *   returns a warning to log, louder if LATEST_ACCEPTED points at this run
 */
import fs from 'node:fs';
import path from 'node:path';

export function guardAcceptedRun(
  /** @type {string} */ runsDir,
  /** @type {string} */ runId,
  /** @type {{ force?: boolean, now?: Date }} */ opts = {},
) {
  const accepted = path.join(runsDir, runId, 'ACCEPTED.json');
  if (!fs.existsSync(accepted)) return { warning: null };
  if (!opts.force) {
    throw new Error(`plan/runs/${runId} is an accepted run — refusing to overwrite it. Re-run with --tag <name> (or --force to overwrite deliberately).`);
  }
  const stamp = (opts.now ?? new Date()).toISOString().replace(/[:.]/g, '-');
  fs.renameSync(accepted, path.join(runsDir, runId, `ACCEPTED.superseded-${stamp}.json`));
  const latestFile = path.join(runsDir, 'LATEST_ACCEPTED');
  const isLatest = fs.existsSync(latestFile) && fs.readFileSync(latestFile, 'utf8').trim() === runId;
  return {
    warning: `--force: overwriting accepted run ${runId}; its acceptance was moved aside.${isLatest ? ' It is LATEST_ACCEPTED — re-accept the new run (npm run plan:accept) before relying on the cockpit headline.' : ''}`,
  };
}
