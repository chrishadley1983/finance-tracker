'use client';

import { useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export interface TabDef<T extends string> {
  id: T;
  label: string;
}

/** Read/write the active tab in the URL (?tab=…), so refresh and Back keep it. */
export function useUrlTab<T extends string>(tabs: readonly TabDef<T>[], fallback: T, param = 'tab') {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const raw = params?.get(param);
  const active = (tabs.some((t) => t.id === raw) ? raw : fallback) as T;
  const setActive = useCallback(
    (id: T) => {
      const next = new URLSearchParams(params?.toString() ?? '');
      if (id === fallback) next.delete(param);
      else next.set(param, id);
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router, fallback, param]
  );
  return [active, setActive] as const;
}

/** Underlined text tabs. Arrow keys move between tabs. */
export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
  label,
}: {
  tabs: readonly TabDef<T>[];
  active: T;
  onChange: (id: T) => void;
  label: string;
}) {
  const move = (dir: 1 | -1) => {
    const i = tabs.findIndex((t) => t.id === active);
    onChange(tabs[(i + dir + tabs.length) % tabs.length].id);
  };
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-x-5 gap-y-1 border-b border-line">
      {tabs.map((t) => {
        const on = t.id === active;
        return (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') move(1);
              if (e.key === 'ArrowLeft') move(-1);
            }}
            className={`-mb-px border-b-[1.5px] pb-2 text-[13.5px] focus-visible:outline-2 focus-visible:outline-accent ${
              on ? 'border-ink font-semibold text-ink' : 'border-transparent text-ink-3 hover:text-ink-2'
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
