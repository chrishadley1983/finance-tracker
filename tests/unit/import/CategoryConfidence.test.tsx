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

  describe('confidence indicator colors', () => {
    it('shows green dot for high confidence (>=0.8)', () => {
      const result = createResult({ confidence: 0.9 });
      const { container } = render(<CategoryConfidence result={result} />);

      const dot = container.querySelector('.bg-green-500');
      expect(dot).toBeInTheDocument();
    });

    it('shows yellow dot for medium confidence (0.5-0.8)', () => {
      const result = createResult({ confidence: 0.6 });
      const { container } = render(<CategoryConfidence result={result} />);

      const dot = container.querySelector('.bg-yellow-500');
      expect(dot).toBeInTheDocument();
    });

    it('shows red dot for low confidence (<0.5)', () => {
      const result = createResult({ confidence: 0.3 });
      const { container } = render(<CategoryConfidence result={result} />);

      const dot = container.querySelector('.bg-red-500');
      expect(dot).toBeInTheDocument();
    });

    it('shows gray dot for uncategorised', () => {
      const result = createResult({
        categoryId: null,
        categoryName: null,
        source: 'none',
        confidence: 0,
      });
      const { container } = render(<CategoryConfidence result={result} />);

      const dot = container.querySelector('.bg-slate-300');
      expect(dot).toBeInTheDocument();
    });
  });

  describe('tooltip content', () => {
    it('shows exact match tooltip for rule_exact source', () => {
      const result = createResult({
        source: 'rule_exact',
        matchDetails: 'Exact match: TESCO',
      });
      const { container } = render(<CategoryConfidence result={result} />);

      const dot = container.querySelector('[aria-label]');
      expect(dot?.getAttribute('aria-label')).toContain('Exact match');
    });

    it('shows pattern match tooltip for rule_pattern source', () => {
      const result = createResult({
        source: 'rule_pattern',
        matchDetails: 'Pattern match: Contains TESCO',
      });
      const { container } = render(<CategoryConfidence result={result} />);

      const dot = container.querySelector('[aria-label]');
      expect(dot?.getAttribute('aria-label')).toContain('Pattern match');
    });

    it('shows AI tooltip with confidence for ai source', () => {
      const result = createResult({
        source: 'ai',
        confidence: 0.85,
        matchDetails: 'Looks like a grocery store',
      });
      const { container } = render(<CategoryConfidence result={result} />);

      const dot = container.querySelector('[aria-label]');
      expect(dot?.getAttribute('aria-label')).toContain('AI suggestion');
      expect(dot?.getAttribute('aria-label')).toContain('85%');
    });

    it('shows similar tooltip for similar source', () => {
      const result = createResult({
        source: 'similar',
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

  it('applies blue color for rule source', () => {
    const { container } = render(<SourceBadge source="rule_exact" />);
    expect(container.querySelector('.bg-blue-100')).toBeInTheDocument();
  });

  it('applies purple color for similar source', () => {
    const { container } = render(<SourceBadge source="similar" />);
    expect(container.querySelector('.bg-purple-100')).toBeInTheDocument();
  });

  it('applies amber color for ai source', () => {
    const { container } = render(<SourceBadge source="ai" />);
    expect(container.querySelector('.bg-amber-100')).toBeInTheDocument();
  });
});
