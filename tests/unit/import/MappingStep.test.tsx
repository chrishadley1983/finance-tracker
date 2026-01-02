import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MappingStep } from '@/components/import/MappingStep';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('MappingStep', () => {
  const mockOnComplete = vi.fn();
  const mockOnBack = vi.fn();

  const defaultProps = {
    sessionId: 'test-session',
    headers: ['Date', 'Amount', 'Description', 'Reference'],
    sampleRows: [
      ['2024-01-15', '100.00', 'Test purchase', 'REF123'],
      ['2024-01-16', '-50.00', 'Refund', 'REF124'],
    ],
    detectedFormat: null,
    suggestedMapping: null,
    onComplete: mockOnComplete,
    onBack: mockOnBack,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock both formats and templates APIs
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/import/templates')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ templates: [] }),
        });
      }
      // Default to formats API
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ formats: [] }),
      });
    });
  });

  afterEach(() => {
    cleanup();
  });

  describe('rendering', () => {
    it('renders column mapping form', async () => {
      render(<MappingStep {...defaultProps} />);

      expect(screen.getByText('Map Columns')).toBeInTheDocument();
      expect(screen.getByText('Required Fields')).toBeInTheDocument();
      expect(screen.getByText('Optional Fields')).toBeInTheDocument();
    });

    it('renders header options in dropdowns', async () => {
      render(<MappingStep {...defaultProps} />);

      await waitFor(() => {
        const selects = screen.getAllByRole('combobox');
        expect(selects.length).toBeGreaterThan(0);
      });

      // Check that headers are available as options
      // Skip the first select (format selector) and check column mapping selects
      const selects = screen.getAllByRole('combobox');
      // Find a select that has header options (not the format select)
      const columnSelect = selects.find(select => {
        const options = select.querySelectorAll('option');
        const optionTexts = Array.from(options).map(o => o.textContent);
        return optionTexts.includes('Date');
      });

      expect(columnSelect).toBeDefined();
      if (columnSelect) {
        const options = columnSelect.querySelectorAll('option');
        const optionTexts = Array.from(options).map(o => o.textContent);

        expect(optionTexts).toContain('Date');
        expect(optionTexts).toContain('Amount');
        expect(optionTexts).toContain('Description');
      }
    });

    it('renders detected format message when provided', async () => {
      render(
        <MappingStep
          {...defaultProps}
          detectedFormat={{ id: 'format-1', name: 'HSBC Current', confidence: 0.95 }}
        />
      );

      expect(screen.getByText(/detected format: hsbc current/i)).toBeInTheDocument();
      expect(screen.getByText(/95% confidence/i)).toBeInTheDocument();
    });

    it('pre-fills suggested mapping', async () => {
      render(
        <MappingStep
          {...defaultProps}
          suggestedMapping={{
            date: 'Date',
            amount: 'Amount',
            description: 'Description',
          }}
        />
      );

      await waitFor(() => {
        const selects = screen.getAllByRole('combobox');
        expect(selects.length).toBeGreaterThan(0);
      });
    });
  });

  describe('amount mode toggle', () => {
    it('shows single amount field by default', async () => {
      render(<MappingStep {...defaultProps} />);

      expect(screen.getByText('Single amount column')).toBeInTheDocument();
      // 'Amount' appears as both a header option and a field label
      const amountElements = screen.getAllByText('Amount');
      expect(amountElements.length).toBeGreaterThan(0);
    });

    it('shows debit/credit fields when toggled', async () => {
      render(<MappingStep {...defaultProps} />);

      const debitCreditRadio = screen.getByLabelText('Separate debit/credit columns');
      fireEvent.click(debitCreditRadio);

      // Debit and Credit appear as field labels
      expect(screen.getByText('Debit')).toBeInTheDocument();
      expect(screen.getByText('Credit')).toBeInTheDocument();
    });
  });

  describe('validation', () => {
    it('shows error when required fields are missing', async () => {
      render(<MappingStep {...defaultProps} />);

      const continueButton = screen.getByRole('button', { name: /continue/i });
      fireEvent.click(continueButton);

      await waitFor(() => {
        expect(screen.getByText(/date column is required/i)).toBeInTheDocument();
      });
    });

    it('calls onComplete with valid mapping', async () => {
      render(
        <MappingStep
          {...defaultProps}
          suggestedMapping={{
            date: 'Date',
            amount: 'Amount',
            description: 'Description',
          }}
        />
      );

      const continueButton = screen.getByRole('button', { name: /continue/i });
      fireEvent.click(continueButton);

      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalled();
      });
    });
  });

  describe('navigation', () => {
    it('calls onBack when back button is clicked', async () => {
      render(<MappingStep {...defaultProps} />);

      const backButton = screen.getByRole('button', { name: /back/i });
      fireEvent.click(backButton);

      expect(mockOnBack).toHaveBeenCalled();
    });
  });
});
