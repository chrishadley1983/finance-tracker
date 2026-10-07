import { describe, it, expect, beforeEach } from 'vitest';
import { resolveTheme, applyThemePreference, readThemePreference, THEME_STORAGE_KEY, DEFAULT_THEME } from '@/lib/theme';

describe('theme', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
    window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as never;
  });

  it('resolves system against the OS preference', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('light', true)).toBe('light');
  });

  it('defaults to light so half-restyled pages never render half-dark', () => {
    expect(DEFAULT_THEME).toBe('light');
    expect(readThemePreference()).toBe('light');
  });

  it('stores the choice and sets data-theme on <html>', () => {
    applyThemePreference('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(readThemePreference()).toBe('dark');
  });
});
