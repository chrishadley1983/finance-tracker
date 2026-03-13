'use client';

import type { FireTakeaway } from '@/lib/fire/ern/types';

interface ErnTakeawaysProps {
  takeaways: FireTakeaway[] | null;
  isLoading: boolean;
}

const TAG_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  strong: {
    bg: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800',
    text: 'text-emerald-700 dark:text-emerald-400',
    label: 'Strong',
  },
  watch: {
    bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
    text: 'text-amber-700 dark:text-amber-400',
    label: 'Watch',
  },
  idea: {
    bg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
    text: 'text-blue-700 dark:text-blue-400',
    label: 'Idea',
  },
};

function SkeletonCard() {
  return (
    <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-4 animate-pulse">
      <div className="flex items-center gap-2 mb-2">
        <div className="h-5 w-14 bg-gray-200 dark:bg-gray-600 rounded-full" />
        <div className="h-4 w-40 bg-gray-200 dark:bg-gray-600 rounded" />
      </div>
      <div className="h-3 w-full bg-gray-200 dark:bg-gray-600 rounded mt-2" />
      <div className="h-3 w-3/4 bg-gray-200 dark:bg-gray-600 rounded mt-1" />
    </div>
  );
}

export function ErnTakeaways({ takeaways, isLoading }: ErnTakeawaysProps) {
  if (!isLoading && !takeaways) return null;

  return (
    <div className="mb-6">
      <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
        AI Takeaways
      </h3>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : takeaways && takeaways.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {takeaways.map((t, i) => {
            const style = TAG_STYLES[t.tag] ?? TAG_STYLES.idea;
            return (
              <div
                key={i}
                className={`border rounded-lg p-4 ${style.bg}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${style.text} bg-white/60 dark:bg-black/20`}>
                    {style.label}
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white text-sm">
                    {t.title}
                  </span>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                  {t.body}
                </p>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
