'use client';

import { useId } from 'react';
import { Check } from 'lucide-react';
import { CATEGORY_COLOURS } from '@/lib/types/category';

interface ColourPickerProps {
  value: string | null;
  onChange: (colour: string | null) => void;
  label?: string;
}

const NAMES: Record<string, string> = {
  '#3B82F6': 'Blue',
  '#10B981': 'Emerald',
  '#F59E0B': 'Amber',
  '#EF4444': 'Red',
  '#8B5CF6': 'Violet',
  '#EC4899': 'Pink',
  '#06B6D4': 'Cyan',
  '#F97316': 'Orange',
  '#84CC16': 'Lime',
  '#6366F1': 'Indigo',
  '#14B8A6': 'Teal',
  '#A855F7': 'Purple',
};

/** Swatch radio group; arrow keys work like any radio group. */
export function ColourPicker({ value, onChange, label = 'Colour' }: ColourPickerProps) {
  const name = useId();
  const swatch =
    'relative grid h-7 w-7 cursor-pointer place-items-center rounded-full border border-line has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent';
  return (
    <fieldset className="grid gap-1.5">
      <legend className="mb-1.5 text-[13px] font-medium text-ink-2">{label}</legend>
      <div className="flex flex-wrap gap-2">
        <label className={`${swatch} bg-sunk`} title="No colour">
          <input type="radio" name={name} className="sr-only" checked={value === null} onChange={() => onChange(null)} aria-label="No colour" />
          {value === null ? <Check className="h-3.5 w-3.5 text-ink" aria-hidden /> : <span className="text-xs text-ink-3">–</span>}
        </label>
        {CATEGORY_COLOURS.map((colour) => (
          <label key={colour} className={swatch} style={{ backgroundColor: colour }} title={NAMES[colour] ?? colour}>
            <input
              type="radio"
              name={name}
              className="sr-only"
              checked={value === colour}
              onChange={() => onChange(colour)}
              aria-label={NAMES[colour] ?? colour}
            />
            {value === colour && <Check className="h-3.5 w-3.5 text-white" aria-hidden />}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
