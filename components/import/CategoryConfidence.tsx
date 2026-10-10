'use client';

import type { CategorisationResult } from '@/lib/categorisation';
import { isUnsure } from '@/lib/review/queue';

interface CategoryConfidenceProps {
  result: CategorisationResult;
  showTooltip?: boolean;
}

/** Plain-English explanation of where a category came from (used as a tooltip). */
export function confidenceText(result: CategorisationResult): string {
  const { confidence, source, matchDetails } = result;
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
}

/**
 * Confidence is only shown when it matters: an "unsure" marker on categorised
 * rows below the review threshold (the same rows that will land in Review).
 * Confident and uncategorised rows show nothing extra.
 */
export function CategoryConfidence({ result, showTooltip = true }: CategoryConfidenceProps) {
  if (!result.categoryId || result.source === 'none' || !isUnsure(result.confidence)) return null;
  return (
    <span
      className="fig shrink-0 rounded bg-warn-soft px-1 text-[11px] text-warn"
      title={showTooltip ? confidenceText(result) : undefined}
      aria-label={`unsure: ${confidenceText(result)}`}
    >
      unsure
    </span>
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
      case 'policy':
        return 'policy';
      case 'policy_ask':
        return 'ask';
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

  const getColorClasses = () => (source === 'policy_ask' ? 'bg-warn-soft text-warn' : 'bg-line-2 text-ink-2');

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
