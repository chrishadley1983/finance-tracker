export type ThemePreference = 'light' | 'dark' | 'system';

export const THEME_STORAGE_KEY = 'hft-theme';

/**
 * Light is the default until every page has been restyled for the new dark
 * palette; "system" and "dark" are opt-in from Settings.
 */
export const DEFAULT_THEME: ThemePreference = 'light';

export function resolveTheme(pref: ThemePreference, prefersDark: boolean): 'light' | 'dark' {
  if (pref === 'system') return prefersDark ? 'dark' : 'light';
  return pref;
}

export function readThemePreference(): ThemePreference {
  try {
    const v = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    // storage blocked: fall through to default
  }
  return DEFAULT_THEME;
}

export function applyThemePreference(pref: ThemePreference): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    // ignore
  }
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = resolveTheme(pref, prefersDark);
}

/**
 * Inline script for <head>: sets data-theme before first paint so there's no
 * flash of the wrong theme. Kept dependency-free and tiny.
 */
export const themeInitScript = `(function(){try{var k=${JSON.stringify(
  THEME_STORAGE_KEY
)},p=localStorage.getItem(k)||${JSON.stringify(DEFAULT_THEME)};var d=p==='dark'||(p==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';if(p==='system'){matchMedia('(prefers-color-scheme: dark)').addEventListener('change',function(e){if((localStorage.getItem(k)||'')==='system')document.documentElement.dataset.theme=e.matches?'dark':'light'})}}catch(e){document.documentElement.dataset.theme='light'}})();`;
