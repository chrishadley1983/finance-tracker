'use client';

import { CATEGORY_COLOURS, CategoryColour } from '@/lib/types/category';

interface ColourPickerProps {
  value: string | null;
  onChange: (colour: string | null) => void;
  label?: string;
}

export function ColourPicker({ value, onChange, label = 'Colour' }: ColourPickerProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
        {label}
      </label>
      <div className="flex flex-wrap gap-2">
        {/* No colour option */}
        <button
          type="button"
          onClick={() => onChange(null)}
          className={`w-8 h-8 rounded-full border-2 transition-all ${
            value === null
              ? 'border-slate-900 dark:border-white ring-2 ring-slate-400'
              : 'border-slate-300 dark:border-slate-600 hover:border-slate-400'
          } bg-slate-100 dark:bg-slate-700 flex items-center justify-center`}
          title="No colour"
        >
          <span className="text-slate-400 text-xs">—</span>
        </button>

        {/* Colour options */}
        {CATEGORY_COLOURS.map((colour) => (
          <button
            key={colour}
            type="button"
            onClick={() => onChange(colour)}
            className={`w-8 h-8 rounded-full border-2 transition-all ${
              value === colour
                ? 'border-slate-900 dark:border-white ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-800'
                : 'border-transparent hover:border-slate-300 dark:hover:border-slate-500'
            }`}
            style={{ backgroundColor: colour }}
            title={colour}
          />
        ))}
      </div>
    </div>
  );
}
