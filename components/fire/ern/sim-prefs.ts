/**
 * Remember the simulation settings between visits (localStorage, best effort).
 *
 * Only the knobs that belong to the simulation are kept. Age, spending,
 * retirement age and savings come from the FIRE settings tab, and the
 * portfolio comes from your accounts (or a lock), so they're never stored here.
 */
import type { ErnConfig } from './ErnConfigPanel';

export const SIM_PREFS_KEY = 'ern-sim-prefs';

export const SIM_PREF_FIELDS = [
  'equityAllocation',
  'horizonYears',
  'preserveFraction',
  'glidepathEnabled',
  'gogoEnabled',
  'guardrailEnabled',
  'mcPaths',
  'statePensionAnnual',
  'statePensionStartAge',
  'partialEarningsAnnual',
  'partialEarningsYears',
] as const satisfies readonly (keyof ErnConfig)[];

export type SimPrefs = Partial<Pick<ErnConfig, (typeof SIM_PREF_FIELDS)[number]>>;

export function pickSimPrefs(config: ErnConfig): SimPrefs {
  const out: Record<string, unknown> = {};
  for (const f of SIM_PREF_FIELDS) {
    if (config[f] !== undefined) out[f] = config[f];
  }
  return out as SimPrefs;
}

export function loadSimPrefs(): SimPrefs {
  try {
    const raw = window.localStorage.getItem(SIM_PREFS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const f of SIM_PREF_FIELDS) {
      const v = parsed[f];
      if (typeof v === 'number' ? Number.isFinite(v) : typeof v === 'boolean') out[f] = v;
    }
    return out as SimPrefs;
  } catch {
    return {};
  }
}

export function saveSimPrefs(config: ErnConfig): void {
  try {
    window.localStorage.setItem(SIM_PREFS_KEY, JSON.stringify(pickSimPrefs(config)));
  } catch {
    // Storage blocked or full: the settings just won't survive a reload.
  }
}
