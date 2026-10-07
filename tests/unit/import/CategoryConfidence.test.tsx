import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { CategoryConfidence, SourceBadge } from '@/components/import/CategoryConfidence';
import type { CategorisationResult } from '@/lib/categorisation';

// Clean up after each test to avoid "multiple elements" errors
afterEach(() => {
  cleanup();
});

describe('CategoryConfidence', () => {
  const createResult = (
    overrides: Partial<CategorisationResult> = {}
  ): CategorisationResult => ({
    categoryId: 'cat-1',
    categoryName: 'Groceries',
    source: 'rule_exact',
    confidence: 0.9,
    matchDetails: 'Exact match: TESCO',
    ...overrides,
  });

  describe('unsure marker', () => {
    it('shows nothing for confident results', () => {
      const { container } = render(<CategoryConfidence result={createResult({ confidence: 0.9 })} />);
      expect(container.firstChild).toBeNull();
    });

    it('marks results below the review threshold as unsure', () => {
      render(<CategoryConfidence result={createResult({ confidence: 0.6 })} />);
      expect(screen.getByText('unsure')).toBeInTheDocument();
    });

    it('marks low confidence results as unsure', () => {
      render(<CategoryConfidence result={createResult({ confidence: 0.3 })} />);
      expect(screen.getByText('unsure')).toBeInTheDocument();
    });

    it('shows nothing for uncategorised rows', () => {
      const result = createResult({ categoryId: null, categoryName: null, source: 'none', confidence: 0 });
      const { container } = render(<CategoryConfidence result={result} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('tooltip content', () => {
    it('shows exact match tooltip for rule_exact source', () => {
      const result = createResult({
        source: 'rule_exact',
        confidence: 0.5,
        matchDetails: 'Exact match: TESCO',
      });
      const { container } = render(<CategoryConfidence result={result} />);

      const dot = container.querySelector('[aria-label]');
      expect(dot?.getAttribute('aria-label')).toContain('Exact match');
    });

    it('shows pattern match tooltip for rule_pattern source', () => {
      const result = createResult({
        source: 'rule_pattern',
        confidence: 0.5,
        matchDetails: 'Pattern match: Contains TESCO',
      });
      const { container } = render(<CategoryConfidence result={result} />);

      const dot = container.querySelector('[aria-label]');
      expect(dot?.getAttribute('aria-label')).toContain('Pattern match');
    });

    it('shows AI tooltip with confidence for ai source', () => {
      const result = createResult({
        source: 'ai',
        confidence: 0.65,
        matchDetails: 'Looks like a grocery store',
      });
      const { container } = render(<CategoryConfidence result={result} />);

      const dot = container.querySelector('[aria-label]');
      expect(dot?.getAttribute('aria-label')).toContain('AI suggestion');
      expect(dot?.getAttribute('aria-label')).toContain('65%');
    });

    it('shows similar tooltip for similar source', () => {
      const result = createResult({
        source: 'similar',
        confidence: 0.5,
        matchDetails: 'Similar to TESCO STORES',
      });
      const { container } = render(<CategoryConfidence result={result} />);

      const dot = container.querySelector('[aria-label]');
      expect(dot?.getAttribute('aria-label')).toContain('Similar to');
    });
  });
});

describe('SourceBadge', () => {
  it('shows "rule" badge for rule_exact source', () => {
    render(<SourceBadge source="rule_exact" />);
    expect(screen.getByText('rule')).toBeInTheDocument();
  });

  it('shows "rule" badge for rule_pattern source', () => {
    render(<SourceBadge source="rule_pattern" />);
    expect(screen.getByText('rule')).toBeInTheDocument();
  });

  it('shows "similar" badge for similar source', () => {
    render(<SourceBadge source="similar" />);
    expect(screen.getByText('similar')).toBeInTheDocument();
  });

  it('shows "AI" badge for ai source', () => {
    render(<SourceBadge source="ai" />);
    expect(screen.getByText('AI')).toBeInTheDocument();
  });

  it('shows nothing for none source', () => {
    const { container } = render(<SourceBadge source="none" />);
    expect(container.firstChild).toBeNull();
  });

  it('uses a neutral chip, except policy "ask" which is flagged', () => {
    const { container, rerender } = render(<SourceBadge source="rule_exact" />);
    expect(container.querySelector('.bg-line-2')).toBeInTheDocument();
    rerender(<SourceBadge source="policy_ask" />);
    expect(container.querySelector('.bg-warn-soft')).toBeInTheDocument();
  });
});
