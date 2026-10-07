import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, within, fireEvent, waitFor } from '@testing-library/react';
import { ImportWizard } from '@/components/import/ImportWizard';

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

const steps = () => within(screen.getByRole('navigation', { name: 'Import steps' }));

describe('ImportWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ formats: [] }),
    });
  });

  afterEach(() => {
    cleanup();
  });

  describe('rendering', () => {
    it('renders a text step indicator', () => {
      render(<ImportWizard />);

      expect(steps().getByText('Upload')).toBeInTheDocument();
      expect(steps().getByText('Match columns')).toBeInTheDocument();
      expect(steps().getByText('Check and categorise')).toBeInTheDocument();
      expect(steps().getByText('Import')).toBeInTheDocument();
      expect(steps().getByText('Done')).toBeInTheDocument();
      expect(steps().getAllByRole('listitem')).toHaveLength(5);
    });

    it('starts with upload step active', () => {
      render(<ImportWizard />);

      expect(screen.getByText('Upload a bank statement')).toBeInTheDocument();
      expect(screen.getByText(/drag & drop your csv or pdf file/i)).toBeInTheDocument();
    });
  });

  describe('step navigation', () => {
    it('marks the current step', () => {
      render(<ImportWizard />);
      const current = steps().getByText('Upload').closest('[aria-current="step"]');
      expect(current).not.toBeNull();
    });

    it('future steps are not clickable', () => {
      render(<ImportWizard />);
      expect(steps().queryAllByRole('button')).toHaveLength(0);
    });

    it('completed steps can be revisited', () => {
      render(
        <ImportWizard
          initialState={{
            step: 'mapping',
            uploadResult: {
              sessionId: 's1',
              filename: 'a.csv',
              headers: ['Date', 'Description', 'Amount'],
              sampleRows: [['01/09/2026', 'TESCO', '-1.00']],
              totalRows: 1,
              detectedFormat: null,
              suggestedMapping: null,
            },
          }}
        />
      );
      expect(screen.getByText('Match columns', { selector: 'h2' })).toBeInTheDocument();
      fireEvent.click(steps().getByRole('button', { name: /upload/i }));
      expect(screen.getByText('Upload a bank statement')).toBeInTheDocument();
    });
  });

  describe('done', () => {
    const result = { success: true, imported: 10, skipped: 2, failed: 0, errors: [], importSessionId: 's1' };

    it('links to Review when rows need a look', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ review: { total: 4 } }) });
      render(<ImportWizard initialState={{ step: 'done', importResult: result }} />);

      expect(screen.getByTestId('import-summary')).toHaveTextContent('Imported 10 transactions, skipped 2 duplicates.');
      const link = await screen.findByRole('link', { name: 'Review 4 transactions' });
      expect(link).toHaveAttribute('href', '/review');
      expect(mockFetch).toHaveBeenCalledWith('/api/nav-summary');
    });

    it('goes to Transactions when nothing needs review', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ review: { total: 0 } }) });
      render(<ImportWizard initialState={{ step: 'done', importResult: result }} />);

      await waitFor(() => expect(mockFetch).toHaveBeenCalled());
      expect(screen.getByRole('link', { name: 'View transactions' })).toHaveAttribute('href', '/transactions');
      expect(screen.queryByRole('link', { name: /review/i })).not.toBeInTheDocument();
    });

    it('lists rows that failed', () => {
      render(
        <ImportWizard
          initialState={{
            step: 'done',
            importResult: { ...result, imported: 9, failed: 1, errors: [{ row: 7, error: 'Invalid date' }] },
          }}
        />
      );
      expect(screen.getByText(/1 row could not be saved/)).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid date');
    });
  });
});
