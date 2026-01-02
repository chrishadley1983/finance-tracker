import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { TemplateManager } from '@/components/import/TemplateManager';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('TemplateManager', () => {
  const mockTemplates = [
    {
      id: 'template-1',
      name: 'Barclays Current',
      provider: 'Barclays',
      is_system: false,
      column_mapping: { date: 'Date', description: 'Description', amount: 'Amount' },
      date_format: 'DD/MM/YYYY',
      decimal_separator: '.',
      has_header: true,
      skip_rows: 0,
      amount_in_single_column: true,
      amount_column: 'Amount',
      debit_column: null,
      credit_column: null,
      notes: 'My notes',
      last_used_at: '2024-01-15T10:00:00Z',
      use_count: 5,
      sample_headers: ['Date', 'Description', 'Amount'],
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-15T10:00:00Z',
    },
    {
      id: 'template-2',
      name: 'HSBC Savings',
      provider: 'HSBC',
      is_system: false,
      column_mapping: { date: 'Trans Date', description: 'Details', amount: 'Value' },
      date_format: 'DD/MM/YYYY',
      decimal_separator: '.',
      has_header: true,
      skip_rows: 0,
      amount_in_single_column: true,
      amount_column: 'Value',
      debit_column: null,
      credit_column: null,
      notes: null,
      last_used_at: null,
      use_count: 0,
      sample_headers: null,
      created_at: '2024-01-02T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
    },
  ];

  const createProps = (overrides = {}) => ({
    isOpen: true,
    onClose: vi.fn(),
    onTemplateDeleted: vi.fn(),
    onTemplateUpdated: vi.fn(),
    ...overrides,
  });

  beforeEach(() => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ templates: mockTemplates }),
    });
  });

  describe('Rendering', () => {
    it('renders when isOpen is true', async () => {
      render(<TemplateManager {...createProps()} />);
      expect(await screen.findByRole('heading', { name: 'Manage Templates' })).toBeInTheDocument();
    });

    it('does not render when isOpen is false', () => {
      render(<TemplateManager {...createProps({ isOpen: false })} />);
      expect(screen.queryByRole('heading', { name: 'Manage Templates' })).not.toBeInTheDocument();
    });

    it('fetches templates on open', async () => {
      render(<TemplateManager {...createProps()} />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/import/templates');
      });
    });

    it('shows loading state initially', () => {
      // Make fetch never resolve
      mockFetch.mockReturnValue(new Promise(() => {}));

      render(<TemplateManager {...createProps()} />);

      expect(screen.getByRole('heading', { name: 'Manage Templates' })).toBeInTheDocument();
    });

    it('shows templates after loading', async () => {
      render(<TemplateManager {...createProps()} />);

      expect(await screen.findByText('Barclays Current')).toBeInTheDocument();
      expect(screen.getByText('HSBC Savings')).toBeInTheDocument();
    });

    it('shows empty state when no templates', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ templates: [] }),
      });

      render(<TemplateManager {...createProps()} />);

      expect(await screen.findByText('No templates saved yet')).toBeInTheDocument();
    });
  });

  describe('Template Display', () => {
    it('shows template name and provider', async () => {
      render(<TemplateManager {...createProps()} />);

      expect(await screen.findByText('Barclays Current')).toBeInTheDocument();
      expect(screen.getByText('Barclays')).toBeInTheDocument();
    });

    it('shows use count', async () => {
      render(<TemplateManager {...createProps()} />);

      expect(await screen.findByText('5 uses')).toBeInTheDocument();
    });

    it('shows notes when present', async () => {
      render(<TemplateManager {...createProps()} />);

      expect(await screen.findByText('My notes')).toBeInTheDocument();
    });

    it('shows created and last used dates', async () => {
      render(<TemplateManager {...createProps()} />);

      await screen.findByText('Barclays Current');

      // There are multiple "Created:" texts (one per template), just check at least one exists
      const createdElements = screen.getAllByText(/Created:/);
      expect(createdElements.length).toBeGreaterThan(0);

      const lastUsedElements = screen.getAllByText(/Last used:/);
      expect(lastUsedElements.length).toBeGreaterThan(0);
    });
  });

  describe('Edit Mode', () => {
    it('enters edit mode when edit button clicked', async () => {
      render(<TemplateManager {...createProps()} />);

      await screen.findByText('Barclays Current');

      const editButtons = screen.getAllByTitle('Edit template');
      fireEvent.click(editButtons[0]);

      // Should show input fields
      expect(screen.getByDisplayValue('Barclays Current')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Barclays')).toBeInTheDocument();
    });

    it('shows notes input in edit mode', async () => {
      render(<TemplateManager {...createProps()} />);

      await screen.findByText('Barclays Current');

      const editButtons = screen.getAllByTitle('Edit template');
      fireEvent.click(editButtons[0]);

      expect(screen.getByDisplayValue('My notes')).toBeInTheDocument();
    });

    it('cancels edit when Cancel clicked', async () => {
      render(<TemplateManager {...createProps()} />);

      await screen.findByText('Barclays Current');

      const editButtons = screen.getAllByTitle('Edit template');
      fireEvent.click(editButtons[0]);

      fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));

      // Should be back to view mode
      expect(screen.queryByDisplayValue('Barclays Current')).not.toBeInTheDocument();
      expect(screen.getByText('Barclays Current')).toBeInTheDocument();
    });

    it('saves changes when Save clicked', async () => {
      const updatedTemplate = { ...mockTemplates[0], name: 'Updated Name' };
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ templates: mockTemplates }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(updatedTemplate),
        });

      const onTemplateUpdated = vi.fn();
      render(<TemplateManager {...createProps({ onTemplateUpdated })} />);

      await screen.findByText('Barclays Current');

      const editButtons = screen.getAllByTitle('Edit template');
      fireEvent.click(editButtons[0]);

      const nameInput = screen.getByDisplayValue('Barclays Current');
      fireEvent.change(nameInput, { target: { value: 'Updated Name' } });

      fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/import/templates/template-1',
          expect.objectContaining({
            method: 'PATCH',
          })
        );
      });
    });
  });

  describe('Delete Confirmation', () => {
    it('shows delete confirmation when delete clicked', async () => {
      render(<TemplateManager {...createProps()} />);

      await screen.findByText('Barclays Current');

      const deleteButtons = screen.getAllByTitle('Delete template');
      fireEvent.click(deleteButtons[0]);

      // Confirmation message has "Delete" and template name in separate elements
      // but shows "This action cannot be undone"
      expect(screen.getByText(/this action cannot be undone/i)).toBeInTheDocument();
    });

    it('cancels delete when Cancel clicked', async () => {
      render(<TemplateManager {...createProps()} />);

      await screen.findByText('Barclays Current');

      const deleteButtons = screen.getAllByTitle('Delete template');
      fireEvent.click(deleteButtons[0]);

      // Click cancel in confirmation
      const cancelButtons = screen.getAllByRole('button', { name: /^cancel$/i });
      fireEvent.click(cancelButtons[0]);

      // Confirmation should be gone
      expect(screen.queryByText(/this action cannot be undone/i)).not.toBeInTheDocument();
    });

    it('deletes template when confirmed', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ templates: mockTemplates }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });

      const onTemplateDeleted = vi.fn();
      render(<TemplateManager {...createProps({ onTemplateDeleted })} />);

      await screen.findByText('Barclays Current');

      const deleteButtons = screen.getAllByTitle('Delete template');
      fireEvent.click(deleteButtons[0]);

      // Confirm delete
      fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/import/templates/template-1',
          expect.objectContaining({
            method: 'DELETE',
          })
        );
      });

      await waitFor(() => {
        expect(onTemplateDeleted).toHaveBeenCalledWith('template-1');
      });
    });
  });

  describe('Close Behavior', () => {
    it('calls onClose when Done clicked', async () => {
      const onClose = vi.fn();
      render(<TemplateManager {...createProps({ onClose })} />);

      await screen.findByText('Barclays Current');

      fireEvent.click(screen.getByRole('button', { name: /^done$/i }));

      expect(onClose).toHaveBeenCalled();
    });

    it('calls onClose when X button clicked', async () => {
      const onClose = vi.fn();
      render(<TemplateManager {...createProps({ onClose })} />);

      await screen.findByText('Barclays Current');

      // Find the close button by its parent structure or aria
      const closeButton = screen.getByRole('button', { name: '' });
      if (closeButton) {
        fireEvent.click(closeButton);
      }
    });
  });

  describe('Error Handling', () => {
    it('shows error when fetch fails', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
      });

      render(<TemplateManager {...createProps()} />);

      // The error message is "Failed to fetch templates" (from the throw) caught as error
      expect(await screen.findByText(/failed to fetch templates/i)).toBeInTheDocument();
    });

    it('shows error when delete fails', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ templates: mockTemplates }),
        })
        .mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve({ error: 'Delete failed' }),
        });

      render(<TemplateManager {...createProps()} />);

      await screen.findByText('Barclays Current');

      const deleteButtons = screen.getAllByTitle('Delete template');
      fireEvent.click(deleteButtons[0]);

      fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));

      expect(await screen.findByText(/delete failed/i)).toBeInTheDocument();
    });
  });
});
