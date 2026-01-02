'use client';

import { useState, useEffect, useCallback } from 'react';

// =============================================================================
// TYPES
// =============================================================================

export interface RuleSuggestionData {
  pattern: string;
  matchType: 'exact' | 'contains';
  categoryId: string;
  categoryName: string;
  correctionCount: number;
  confidence: number;
  correctionIds: string[];
  sampleDescriptions: string[];
}

interface RuleSuggestionProps {
  suggestion: RuleSuggestionData;
  onAccept: (suggestion: RuleSuggestionData) => Promise<void>;
  onDismiss: () => void;
  onNeverAskForPattern?: (pattern: string) => void;
}

interface RuleSuggestionToastProps {
  suggestions: RuleSuggestionData[];
  onAccept: (suggestion: RuleSuggestionData) => Promise<void>;
  onDismiss: (index: number) => void;
  onNeverAskForPattern?: (pattern: string) => void;
}

// =============================================================================
// LOCAL STORAGE KEYS
// =============================================================================

const DISMISSED_PATTERNS_KEY = 'finance-tracker-dismissed-rule-patterns';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getDismissedPatterns(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const stored = localStorage.getItem(DISMISSED_PATTERNS_KEY);
    if (stored) {
      return new Set(JSON.parse(stored));
    }
  } catch {
    // Ignore storage errors
  }
  return new Set();
}

function addDismissedPattern(pattern: string): void {
  const patterns = getDismissedPatterns();
  patterns.add(pattern.toLowerCase());
  try {
    localStorage.setItem(DISMISSED_PATTERNS_KEY, JSON.stringify(Array.from(patterns)));
  } catch {
    // Ignore storage errors
  }
}

export function isPatternDismissed(pattern: string): boolean {
  return getDismissedPatterns().has(pattern.toLowerCase());
}

export function clearDismissedPatterns(): void {
  try {
    localStorage.removeItem(DISMISSED_PATTERNS_KEY);
  } catch {
    // Ignore storage errors
  }
}

// =============================================================================
// SINGLE SUGGESTION COMPONENT
// =============================================================================

export function RuleSuggestion({
  suggestion,
  onAccept,
  onDismiss,
  onNeverAskForPattern,
}: RuleSuggestionProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const handleAccept = async () => {
    setIsCreating(true);
    try {
      await onAccept(suggestion);
    } finally {
      setIsCreating(false);
    }
  };

  const handleNeverAsk = () => {
    addDismissedPattern(suggestion.pattern);
    onNeverAskForPattern?.(suggestion.pattern);
    onDismiss();
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 shadow-lg max-w-md">
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex-shrink-0">
          <svg
            className="w-5 h-5 text-blue-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-blue-900">Create a categorisation rule?</h4>
          <p className="mt-1 text-sm text-blue-700">
            You've corrected <span className="font-medium">{suggestion.correctionCount}</span>{' '}
            transactions
            {suggestion.matchType === 'exact' ? ' with' : ' containing'}{' '}
            <span className="font-mono text-xs bg-blue-100 px-1 py-0.5 rounded">
              {suggestion.pattern}
            </span>{' '}
            to <span className="font-medium">{suggestion.categoryName}</span>.
          </p>

          {/* Details Toggle */}
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="mt-2 text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            {showDetails ? (
              <>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 15l7-7 7 7"
                  />
                </svg>
                Hide details
              </>
            ) : (
              <>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
                Show examples
              </>
            )}
          </button>

          {/* Details Section */}
          {showDetails && (
            <div className="mt-2 text-xs text-blue-700 bg-blue-100 rounded p-2">
              <p className="font-medium mb-1">Sample transactions:</p>
              <ul className="space-y-0.5">
                {suggestion.sampleDescriptions.slice(0, 3).map((desc, i) => (
                  <li key={i} className="truncate">
                    • {desc}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-blue-600">
                Match type: {suggestion.matchType === 'exact' ? 'Exact match' : 'Contains pattern'}
              </p>
              <p className="text-blue-600">
                Confidence: {Math.round(suggestion.confidence * 100)}%
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <button
              onClick={handleAccept}
              disabled={isCreating}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300 transition-colors flex items-center gap-1"
            >
              {isCreating ? (
                <>
                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Creating...
                </>
              ) : (
                <>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Create Rule
                </>
              )}
            </button>
            <button
              onClick={onDismiss}
              className="px-3 py-1.5 text-sm text-blue-700 hover:bg-blue-100 rounded-md transition-colors"
            >
              Not now
            </button>
            <button
              onClick={handleNeverAsk}
              className="px-3 py-1.5 text-xs text-blue-500 hover:text-blue-700 transition-colors"
            >
              Don't ask again
            </button>
          </div>
        </div>

        {/* Close button */}
        <button
          onClick={onDismiss}
          className="flex-shrink-0 text-blue-400 hover:text-blue-600 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// TOAST CONTAINER
// =============================================================================

export function RuleSuggestionToast({
  suggestions,
  onAccept,
  onDismiss,
  onNeverAskForPattern,
}: RuleSuggestionToastProps) {
  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {suggestions.map((suggestion, index) => (
        <RuleSuggestion
          key={`${suggestion.pattern}-${suggestion.categoryId}`}
          suggestion={suggestion}
          onAccept={onAccept}
          onDismiss={() => onDismiss(index)}
          onNeverAskForPattern={onNeverAskForPattern}
        />
      ))}
    </div>
  );
}

// =============================================================================
// HOOK FOR MANAGING SUGGESTIONS
// =============================================================================

export function useRuleSuggestions() {
  const [suggestions, setSuggestions] = useState<RuleSuggestionData[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchSuggestions = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/categories/corrections?action=suggestions');
      if (!response.ok) throw new Error('Failed to fetch suggestions');

      const data = await response.json();

      // Filter out dismissed patterns
      const validSuggestions = (data.suggestions || []).filter(
        (s: RuleSuggestionData) => !isPatternDismissed(s.pattern)
      );

      setSuggestions(validSuggestions);
    } catch (error) {
      console.error('Failed to fetch rule suggestions:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const acceptSuggestion = useCallback(async (suggestion: RuleSuggestionData) => {
    const response = await fetch('/api/categories/corrections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'createRule',
        pattern: suggestion.pattern,
        matchType: suggestion.matchType,
        categoryId: suggestion.categoryId,
        categoryName: suggestion.categoryName,
        correctionCount: suggestion.correctionCount,
        confidence: suggestion.confidence,
        correctionIds: suggestion.correctionIds,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create rule');
    }

    // Remove from list
    setSuggestions((prev) => prev.filter((s) => s.pattern !== suggestion.pattern));
  }, []);

  const dismissSuggestion = useCallback((index: number) => {
    setSuggestions((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const dismissPatternPermanently = useCallback((pattern: string) => {
    addDismissedPattern(pattern);
    setSuggestions((prev) => prev.filter((s) => s.pattern !== pattern));
  }, []);

  // Check for suggestions on mount
  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  return {
    suggestions,
    isLoading,
    fetchSuggestions,
    acceptSuggestion,
    dismissSuggestion,
    dismissPatternPermanently,
  };
}

// =============================================================================
// INLINE SUGGESTION COMPONENT (for import wizard)
// =============================================================================

interface InlineRuleSuggestionProps {
  pattern: string;
  categoryName: string;
  correctionCount: number;
  onCreateRule: () => void;
  onDismiss: () => void;
}

export function InlineRuleSuggestion({
  pattern,
  categoryName,
  correctionCount,
  onCreateRule,
  onDismiss,
}: InlineRuleSuggestionProps) {
  return (
    <div className="flex items-center gap-2 px-2 py-1 bg-amber-50 border border-amber-200 rounded text-xs">
      <svg
        className="w-3.5 h-3.5 text-amber-600 flex-shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
        />
      </svg>
      <span className="text-amber-800">
        <span className="font-medium">{correctionCount}</span> similar corrections to{' '}
        <span className="font-medium">{categoryName}</span>
      </span>
      <button
        onClick={onCreateRule}
        className="px-1.5 py-0.5 bg-amber-600 text-white rounded hover:bg-amber-700 transition-colors"
      >
        Create rule
      </button>
      <button onClick={onDismiss} className="text-amber-500 hover:text-amber-700">
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
}
