'use client';

import type { CategorisationResult } from '@/lib/categorisation';

interface CategoryConfidenceProps {
  result: CategorisationResult;
  showTooltip?: boolean;
}

/**
 * Visual confidence indicator for categorisation results.
 * - Green (>0.8): High confidence
 * - Yellow (0.5-0.8): Medium confidence
 * - Red (<0.5): Low confidence
 * - Gray: No categorisation
 */
export function CategoryConfidence({
  result,
  showTooltip = true,
}: CategoryConfidenceProps) {
  const { confidence, source, matchDetails } = result;

  // Determine color based on confidence
  const getColorClasses = () => {
    if (source === 'none' || !result.categoryId) {
      return 'bg-slate-300';
    }
    if (confidence >= 0.8) {
      return 'bg-green-500';
    }
    if (confidence >= 0.5) {
      return 'bg-yellow-500';
    }
    return 'bg-red-500';
  };

  // Generate tooltip text based on source
  const getTooltipText = () => {
    switch (source) {
      case 'rule_exact':
        return `Exact match: ${matchDetails}`;
      case 'rule_pattern':
        return `Pattern match: ${matchDetails}`;
      case 'similar':
        return matchDetails;
      case 'ai':
        return `AI suggestion (${Math.round(confidence * 100)}% confident): ${matchDetails}`;
      case 'none':
        return 'No category assigned';
      default:
        return matchDetails;
    }
  };

  return (
    <div className="relative group inline-flex items-center">
      <span
        className={`inline-block w-2.5 h-2.5 rounded-full ${getColorClasses()}`}
        aria-label={getTooltipText()}
      />
      {showTooltip && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 text-xs text-white bg-slate-800 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 max-w-xs truncate">
          {getTooltipText()}
          <div className="absolute left-1/2 -translate-x-1/2 top-full border-4 border-transparent border-t-slate-800" />
        </div>
      )}
    </div>
  );
}

/**
 * Source badge showing how the category was determined.
 */
interface SourceBadgeProps {
  source: CategorisationResult['source'];
}

export function SourceBadge({ source }: SourceBadgeProps) {
  const getLabel = () => {
    switch (source) {
      case 'rule_exact':
      case 'rule_pattern':
        return 'rule';
      case 'similar':
        return 'similar';
      case 'ai':
        return 'AI';
      case 'none':
        return '';
      default:
        return '';
    }
  };

  const getColorClasses = () => {
    switch (source) {
      case 'rule_exact':
      case 'rule_pattern':
        return 'bg-blue-100 text-blue-700';
      case 'similar':
        return 'bg-purple-100 text-purple-700';
      case 'ai':
        return 'bg-amber-100 text-amber-700';
      default:
        return '';
    }
  };

  const label = getLabel();
  if (!label) return null;

  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded ${getColorClasses()}`}
    >
      {label}
    </span>
  );
}
