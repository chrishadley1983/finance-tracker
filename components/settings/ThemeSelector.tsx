'use client';

import { useEffect, useState } from 'react';
import { applyThemePreference, readThemePreference, type ThemePreference } from '@/lib/theme';

const OPTIONS: { value: ThemePreference; label: string; hint: string }[] = [
  { value: 'light', label: 'Light', hint: 'Default' },
  { value: 'dark', label: 'Dark', hint: 'Easier on the eyes at night' },
  { value: 'system', label: 'Match system', hint: 'Follows your device setting' },
];

export function ThemeSelector() {
  const [pref, setPref] = useState<ThemePreference | null>(null);

  useEffect(() => {
    setPref(readThemePreference());
  }, []);

  const choose = (value: ThemePreference) => {
    setPref(value);
    applyThemePreference(value);
  };

  return (
    <fieldset className="grid gap-3">
      <legend className="sr-only">Theme</legend>
      {OPTIONS.map((o) => (
        <label key={o.value} className="flex cursor-pointer items-start gap-3">
          <input
            type="radio"
            name="theme"
            value={o.value}
            checked={pref === o.value}
            onChange={() => choose(o.value)}
            className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
          <span className="grid">
            <span className="text-sm font-medium text-ink">{o.label}</span>
            <span className="text-xs text-ink-3">{o.hint}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
