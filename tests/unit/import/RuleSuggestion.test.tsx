import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import {
  RuleSuggestion,
  RuleSuggestionToast,
  isPatternDismissed,
  clearDismissedPatterns,
  type RuleSuggestionData,
} from '@/components/import/RuleSuggestion';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  localStorageMock.clear();
});

describe('RuleSuggestion', () => {
  const mockSuggestion: RuleSuggestionData = {
    pattern: 'AMAZON PRIME',
    matchType: 'exact',
    categoryId: 'cat-entertainment',
    categoryName: 'Entertainment',
    correctionCount: 5,
    confidence: 0.9,
    correctionIds: ['c1', 'c2', 'c3', 'c4', 'c5'],
    sampleDescriptions: [
      'AMAZON PRIME MEMBERSHIP',
      'AMAZON PRIME VIDEO',
      'AMAZON PRIME MONTHLY',
    ],
  };

  const createProps = (overrides = {}) => ({
    suggestion: mockSuggestion,
    onAccept: vi.fn().mockResolvedValue(undefined),
    onDismiss: vi.fn(),
    onNeverAskForPattern: vi.fn(),
    ...overrides,
  });

  describe('Rendering', () => {
    it('renders the suggestion correctly', () => {
      render(<RuleSuggestion {...createProps()} />);

      expect(screen.getByText(/Create a categorisation rule/i)).toBeInTheDocument();
      expect(screen.getByText(/5/)).toBeInTheDocument();
      expect(screen.getByText('AMAZON PRIME')).toBeInTheDocument();
      expect(screen.getByText('Entertainment')).toBeInTheDocument();
    });

    it('shows Create Rule button', () => {
      render(<RuleSuggestion {...createProps()} />);

      expect(screen.getByRole('button', { name: /Create Rule/i })).toBeInTheDocument();
    });

    it('shows Not now button', () => {
      render(<RuleSuggestion {...createProps()} />);

      expect(screen.getByRole('button', { name: /Not now/i })).toBeInTheDocument();
    });

    it('shows Don\'t ask again button', () => {
      render(<RuleSuggestion {...createProps()} />);

      expect(screen.getByRole('button', { name: /Don't ask again/i })).toBeInTheDocument();
    });
  });

  describe('Details Toggle', () => {
    it('shows examples when details expanded', async () => {
      render(<RuleSuggestion {...createProps()} />);

      fireEvent.click(screen.getByText('Show examples'));

      await waitFor(() => {
        expect(screen.getByText(/Sample transactions/i)).toBeInTheDocument();
        expect(screen.getByText(/AMAZON PRIME MEMBERSHIP/)).toBeInTheDocument();
      });
    });

    it('hides examples when collapsed', async () => {
      render(<RuleSuggestion {...createProps()} />);

      // Open details
      fireEvent.click(screen.getByText('Show examples'));
      expect(await screen.findByText(/Sample transactions/i)).toBeInTheDocument();

      // Close details
      fireEvent.click(screen.getByText('Hide details'));
      await waitFor(() => {
        expect(screen.queryByText(/Sample transactions/i)).not.toBeInTheDocument();
      });
    });

    it('shows match type in details', async () => {
      render(<RuleSuggestion {...createProps()} />);

      fireEvent.click(screen.getByText('Show examples'));

      expect(await screen.findByText(/Exact match/i)).toBeInTheDocument();
    });

    it('shows confidence in details', async () => {
      render(<RuleSuggestion {...createProps()} />);

      fireEvent.click(screen.getByText('Show examples'));

      expect(await screen.findByText(/90%/)).toBeInTheDocument();
    });
  });

  describe('Actions', () => {
    it('calls onAccept when Create Rule clicked', async () => {
      const onAccept = vi.fn().mockResolvedValue(undefined);
      render(<RuleSuggestion {...createProps({ onAccept })} />);

      fireEvent.click(screen.getByRole('button', { name: /Create Rule/i }));

      await waitFor(() => {
        expect(onAccept).toHaveBeenCalledWith(mockSuggestion);
      });
    });

    it('shows loading state while creating', async () => {
      let resolvePromise: () => void;
      const promise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });
      const onAccept = vi.fn().mockReturnValue(promise);

      render(<RuleSuggestion {...createProps({ onAccept })} />);

      fireEvent.click(screen.getByRole('button', { name: /Create Rule/i }));

      expect(await screen.findByText(/Creating/i)).toBeInTheDocument();

      resolvePromise!();
    });

    it('calls onDismiss when Not now clicked', () => {
      const onDismiss = vi.fn();
      render(<RuleSuggestion {...createProps({ onDismiss })} />);

      fireEvent.click(screen.getByRole('button', { name: /Not now/i }));

      expect(onDismiss).toHaveBeenCalled();
    });

    it('calls onNeverAskForPattern and onDismiss when Don\'t ask again clicked', () => {
      const onDismiss = vi.fn();
      const onNeverAskForPattern = vi.fn();
      render(<RuleSuggestion {...createProps({ onDismiss, onNeverAskForPattern })} />);

      fireEvent.click(screen.getByRole('button', { name: /Don't ask again/i }));

      expect(onNeverAskForPattern).toHaveBeenCalledWith('AMAZON PRIME');
      expect(onDismiss).toHaveBeenCalled();
    });

    it('calls onDismiss when X button clicked', () => {
      const onDismiss = vi.fn();
      render(<RuleSuggestion {...createProps({ onDismiss })} />);

      // Find close button (the last button with no text content)
      const buttons = screen.getAllByRole('button');
      const closeButton = buttons.find(
        (btn) => btn.querySelector('svg path[d*="M6 18L18 6"]')
      );

      if (closeButton) {
        fireEvent.click(closeButton);
        expect(onDismiss).toHaveBeenCalled();
      }
    });
  });

  describe('Contains Match Type', () => {
    it('shows "containing" for contains match type', () => {
      const containsSuggestion: RuleSuggestionData = {
        ...mockSuggestion,
        matchType: 'contains',
      };

      render(<RuleSuggestion {...createProps({ suggestion: containsSuggestion })} />);

      expect(screen.getByText(/containing/i)).toBeInTheDocument();
    });
  });
});

describe('RuleSuggestionToast', () => {
  const mockSuggestions: RuleSuggestionData[] = [
    {
      pattern: 'AMAZON',
      matchType: 'contains',
      categoryId: 'cat-shopping',
      categoryName: 'Shopping',
      correctionCount: 3,
      confidence: 0.85,
      correctionIds: ['c1', 'c2', 'c3'],
      sampleDescriptions: ['AMAZON ORDER', 'AMAZON MARKETPLACE'],
    },
    {
      pattern: 'NETFLIX',
      matchType: 'exact',
      categoryId: 'cat-entertainment',
      categoryName: 'Entertainment',
      correctionCount: 4,
      confidence: 0.9,
      correctionIds: ['c4', 'c5', 'c6', 'c7'],
      sampleDescriptions: ['NETFLIX', 'NETFLIX MONTHLY'],
    },
  ];

  const createProps = (overrides = {}) => ({
    suggestions: mockSuggestions,
    onAccept: vi.fn().mockResolvedValue(undefined),
    onDismiss: vi.fn(),
    onNeverAskForPattern: vi.fn(),
    ...overrides,
  });

  it('renders nothing when no suggestions', () => {
    const { container } = render(<RuleSuggestionToast {...createProps({ suggestions: [] })} />);

    expect(container.firstChild).toBeNull();
  });

  it('renders multiple suggestions', () => {
    render(<RuleSuggestionToast {...createProps()} />);

    expect(screen.getByText('AMAZON')).toBeInTheDocument();
    expect(screen.getByText('NETFLIX')).toBeInTheDocument();
  });

  it('calls onDismiss with correct index', () => {
    const onDismiss = vi.fn();
    render(<RuleSuggestionToast {...createProps({ onDismiss })} />);

    // Dismiss the first suggestion
    const notNowButtons = screen.getAllByRole('button', { name: /Not now/i });
    fireEvent.click(notNowButtons[0]);

    expect(onDismiss).toHaveBeenCalledWith(0);
  });
});

describe('Pattern Dismissal', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('stores dismissed patterns in localStorage', () => {
    render(
      <RuleSuggestion
        suggestion={{
          pattern: 'TEST PATTERN',
          matchType: 'exact',
          categoryId: 'cat-1',
          categoryName: 'Test',
          correctionCount: 3,
          confidence: 0.9,
          correctionIds: [],
          sampleDescriptions: [],
        }}
        onAccept={vi.fn()}
        onDismiss={vi.fn()}
        onNeverAskForPattern={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Don't ask again/i }));

    expect(isPatternDismissed('TEST PATTERN')).toBe(true);
  });

  it('isPatternDismissed is case-insensitive', () => {
    render(
      <RuleSuggestion
        suggestion={{
          pattern: 'MixedCase',
          matchType: 'exact',
          categoryId: 'cat-1',
          categoryName: 'Test',
          correctionCount: 3,
          confidence: 0.9,
          correctionIds: [],
          sampleDescriptions: [],
        }}
        onAccept={vi.fn()}
        onDismiss={vi.fn()}
        onNeverAskForPattern={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Don't ask again/i }));

    expect(isPatternDismissed('mixedcase')).toBe(true);
    expect(isPatternDismissed('MIXEDCASE')).toBe(true);
  });

  it('clearDismissedPatterns removes all dismissed patterns', () => {
    // Dismiss a pattern first
    render(
      <RuleSuggestion
        suggestion={{
          pattern: 'TO CLEAR',
          matchType: 'exact',
          categoryId: 'cat-1',
          categoryName: 'Test',
          correctionCount: 3,
          confidence: 0.9,
          correctionIds: [],
          sampleDescriptions: [],
        }}
        onAccept={vi.fn()}
        onDismiss={vi.fn()}
        onNeverAskForPattern={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Don't ask again/i }));
    expect(isPatternDismissed('TO CLEAR')).toBe(true);

    clearDismissedPatterns();
    expect(isPatternDismissed('TO CLEAR')).toBe(false);
  });
});
