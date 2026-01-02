import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { SaveTemplateDialog } from '@/components/import/SaveTemplateDialog';
import type { ColumnMapping } from '@/lib/validations/import';

afterEach(() => {
  cleanup();
});

describe('SaveTemplateDialog', () => {
  const mockMapping: ColumnMapping = {
    date: 'Date',
    description: 'Description',
    amount: 'Amount',
    reference: 'Reference',
  };

  const mockHeaders = ['Date', 'Description', 'Amount', 'Reference', 'Balance'];

  const createProps = (overrides = {}) => ({
    isOpen: true,
    mapping: mockMapping,
    headers: mockHeaders,
    dateFormat: 'DD/MM/YYYY',
    decimalSeparator: '.' as const,
    hasHeader: true,
    skipRows: 0,
    onSave: vi.fn().mockResolvedValue(undefined),
    onClose: vi.fn(),
    ...overrides,
  });

  describe('Rendering', () => {
    it('renders when isOpen is true', () => {
      render(<SaveTemplateDialog {...createProps()} />);
      expect(screen.getByRole('heading', { name: 'Save as Template' })).toBeInTheDocument();
    });

    it('does not render when isOpen is false', () => {
      render(<SaveTemplateDialog {...createProps({ isOpen: false })} />);
      expect(screen.queryByRole('heading', { name: 'Save as Template' })).not.toBeInTheDocument();
    });

    it('shows template name input', () => {
      render(<SaveTemplateDialog {...createProps()} />);
      expect(screen.getByLabelText(/template name/i)).toBeInTheDocument();
    });

    it('shows provider input', () => {
      render(<SaveTemplateDialog {...createProps()} />);
      expect(screen.getByLabelText(/bank \/ provider/i)).toBeInTheDocument();
    });

    it('shows notes textarea', () => {
      render(<SaveTemplateDialog {...createProps()} />);
      expect(screen.getByLabelText(/notes/i)).toBeInTheDocument();
    });

    it('shows column mapping summary', () => {
      render(<SaveTemplateDialog {...createProps()} />);
      expect(screen.getByText(/Date: Date/i)).toBeInTheDocument();
      expect(screen.getByText(/Description: Description/i)).toBeInTheDocument();
      expect(screen.getByText(/Amount: Amount/i)).toBeInTheDocument();
    });

    it('shows format settings', () => {
      render(<SaveTemplateDialog {...createProps()} />);
      expect(screen.getByText(/DD\/MM\/YYYY/i)).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('shows error when name is empty', async () => {
      const onSave = vi.fn();
      render(<SaveTemplateDialog {...createProps({ onSave })} />);

      // Try to submit without filling in fields
      fireEvent.click(screen.getByRole('button', { name: /save template/i }));

      expect(await screen.findByText(/template name is required/i)).toBeInTheDocument();
      expect(onSave).not.toHaveBeenCalled();
    });

    it('shows error when provider is empty', async () => {
      render(<SaveTemplateDialog {...createProps()} />);

      // Fill only name
      fireEvent.change(screen.getByLabelText(/template name/i), {
        target: { value: 'My Template' },
      });

      fireEvent.click(screen.getByRole('button', { name: /save template/i }));

      expect(await screen.findByText(/provider\/bank name is required/i)).toBeInTheDocument();
    });
  });

  describe('Form Submission', () => {
    it('calls onSave with correct data when form is valid', async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      render(<SaveTemplateDialog {...createProps({ onSave })} />);

      fireEvent.change(screen.getByLabelText(/template name/i), {
        target: { value: 'Barclays Current' },
      });

      fireEvent.change(screen.getByLabelText(/bank \/ provider/i), {
        target: { value: 'Barclays' },
      });

      fireEvent.change(screen.getByLabelText(/notes/i), {
        target: { value: 'My notes' },
      });

      fireEvent.click(screen.getByRole('button', { name: /save template/i }));

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Barclays Current',
            provider: 'Barclays',
            columnMapping: mockMapping,
            sampleHeaders: mockHeaders,
            notes: 'My notes',
          })
        );
      });
    });

    it('shows loading state during submission', async () => {
      // Create a promise we can control
      let resolvePromise: () => void;
      const savePromise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });
      const onSave = vi.fn().mockReturnValue(savePromise);

      render(<SaveTemplateDialog {...createProps({ onSave })} />);

      fireEvent.change(screen.getByLabelText(/template name/i), {
        target: { value: 'Test' },
      });
      fireEvent.change(screen.getByLabelText(/bank \/ provider/i), {
        target: { value: 'Bank' },
      });

      fireEvent.click(screen.getByRole('button', { name: /save template/i }));

      expect(await screen.findByText(/saving/i)).toBeInTheDocument();

      // Resolve the promise
      resolvePromise!();
    });

    it('shows error when save fails', async () => {
      const onSave = vi.fn().mockRejectedValue(new Error('Network error'));
      render(<SaveTemplateDialog {...createProps({ onSave })} />);

      fireEvent.change(screen.getByLabelText(/template name/i), {
        target: { value: 'Test' },
      });
      fireEvent.change(screen.getByLabelText(/bank \/ provider/i), {
        target: { value: 'Bank' },
      });

      fireEvent.click(screen.getByRole('button', { name: /save template/i }));

      expect(await screen.findByText(/network error/i)).toBeInTheDocument();
    });
  });

  describe('Cancel Behavior', () => {
    it('calls onClose when Cancel clicked', () => {
      const onClose = vi.fn();
      render(<SaveTemplateDialog {...createProps({ onClose })} />);

      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

      expect(onClose).toHaveBeenCalled();
    });

    it('resets form when canceled and reopened', () => {
      const onClose = vi.fn();
      const { rerender } = render(<SaveTemplateDialog {...createProps({ onClose })} />);

      // Fill in the form
      fireEvent.change(screen.getByLabelText(/template name/i), {
        target: { value: 'Test Template' },
      });

      expect(screen.getByLabelText(/template name/i)).toHaveValue('Test Template');

      // Cancel (which triggers the reset logic in handleClose)
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

      // Close and reopen via props
      rerender(<SaveTemplateDialog {...createProps({ isOpen: false, onClose })} />);
      rerender(<SaveTemplateDialog {...createProps({ isOpen: true, onClose })} />);

      // Form should be reset since handleClose resets it
      expect(screen.getByLabelText(/template name/i)).toHaveValue('');
    });
  });

  describe('Character Limits', () => {
    it('shows notes character count', () => {
      render(<SaveTemplateDialog {...createProps()} />);

      fireEvent.change(screen.getByLabelText(/notes/i), {
        target: { value: 'Test note' },
      });

      expect(screen.getByText('9/500')).toBeInTheDocument();
    });
  });
});
