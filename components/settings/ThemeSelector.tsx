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
    <fieldset className="grid gap-2">
      <legend className="sr-only">Theme</legend>
      {OPTIONS.map((o) => (
        <label
          key={o.value}
          className="flex items-start gap-3 rounded-md border border-line px-3 py-2 cursor-pointer hover:bg-sunk has-[:checked]:border-accent has-[:checked]:bg-accent-soft"
        >
          <input
            type="radio"
            name="theme"
            value={o.value}
            checked={pref === o.value}
            onChange={() => choose(o.value)}
            className="mt-1 accent-[var(--accent)]"
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
