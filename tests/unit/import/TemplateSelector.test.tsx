import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { TemplateSelector, type Template } from '@/components/import/TemplateSelector';

afterEach(() => {
  cleanup();
});

describe('TemplateSelector', () => {
  const mockTemplates: Template[] = [
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
      notes: 'My Barclays template',
      last_used_at: '2024-01-15T10:00:00Z',
      use_count: 5,
      sample_headers: ['Date', 'Description', 'Amount', 'Balance'],
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-15T10:00:00Z',
    },
    {
      id: 'template-2',
      name: 'HSBC Savings',
      provider: 'HSBC',
      is_system: false,
      column_mapping: { date: 'Trans Date', description: 'Details', debit: 'Out', credit: 'In' },
      date_format: 'DD/MM/YYYY',
      decimal_separator: '.',
      has_header: true,
      skip_rows: 0,
      amount_in_single_column: false,
      amount_column: null,
      debit_column: 'Out',
      credit_column: 'In',
      notes: null,
      last_used_at: null,
      use_count: 0,
      sample_headers: ['Trans Date', 'Details', 'Out', 'In'],
      created_at: '2024-01-02T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
    },
  ];

  const createProps = (overrides = {}) => ({
    templates: mockTemplates,
    currentHeaders: ['Date', 'Description', 'Amount', 'Balance'],
    selectedTemplateId: null,
    onSelect: vi.fn(),
    onManage: vi.fn(),
    isLoading: false,
    ...overrides,
  });

  describe('Collapsed State', () => {
    it('shows "Select a template" when nothing selected', () => {
      render(<TemplateSelector {...createProps()} />);
      expect(screen.getByText('Select a template')).toBeInTheDocument();
    });

    it('shows template count when nothing selected', () => {
      render(<TemplateSelector {...createProps()} />);
      expect(screen.getByText('2 templates available')).toBeInTheDocument();
    });

    it('shows selected template name when one is selected', () => {
      render(<TemplateSelector {...createProps({ selectedTemplateId: 'template-1' })} />);
      expect(screen.getByText('Barclays Current')).toBeInTheDocument();
      expect(screen.getByText('Barclays')).toBeInTheDocument();
    });

    it('shows "No saved templates" when templates array is empty', () => {
      render(<TemplateSelector {...createProps({ templates: [] })} />);
      expect(screen.getByText('No saved templates')).toBeInTheDocument();
    });
  });

  describe('Dropdown Behavior', () => {
    it('opens dropdown when clicked', () => {
      render(<TemplateSelector {...createProps()} />);

      fireEvent.click(screen.getByText('Select a template'));

      expect(screen.getByPlaceholderText('Search templates...')).toBeInTheDocument();
    });

    it('shows all templates in dropdown', () => {
      render(<TemplateSelector {...createProps()} />);

      fireEvent.click(screen.getByText('Select a template'));

      expect(screen.getByText('Barclays Current')).toBeInTheDocument();
      expect(screen.getByText('HSBC Savings')).toBeInTheDocument();
    });

    it('shows Manage Templates button in dropdown', () => {
      render(<TemplateSelector {...createProps()} />);

      fireEvent.click(screen.getByText('Select a template'));

      expect(screen.getByText('Manage Templates')).toBeInTheDocument();
    });
  });

  describe('Template Selection', () => {
    it('calls onSelect when template clicked', () => {
      const onSelect = vi.fn();
      render(<TemplateSelector {...createProps({ onSelect })} />);

      fireEvent.click(screen.getByText('Select a template'));
      fireEvent.click(screen.getByText('HSBC Savings'));

      expect(onSelect).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'template-2',
          name: 'HSBC Savings',
        })
      );
    });

    it('closes dropdown after selection', () => {
      render(<TemplateSelector {...createProps()} />);

      fireEvent.click(screen.getByText('Select a template'));
      fireEvent.click(screen.getByText('HSBC Savings'));

      expect(screen.queryByPlaceholderText('Search templates...')).not.toBeInTheDocument();
    });
  });

  describe('Search Functionality', () => {
    it('filters templates by name', () => {
      render(<TemplateSelector {...createProps()} />);

      fireEvent.click(screen.getByText('Select a template'));
      fireEvent.change(screen.getByPlaceholderText('Search templates...'), {
        target: { value: 'Barclays' },
      });

      expect(screen.getByText('Barclays Current')).toBeInTheDocument();
      expect(screen.queryByText('HSBC Savings')).not.toBeInTheDocument();
    });

    it('filters templates by provider', () => {
      render(<TemplateSelector {...createProps()} />);

      fireEvent.click(screen.getByText('Select a template'));
      fireEvent.change(screen.getByPlaceholderText('Search templates...'), {
        target: { value: 'HSBC' },
      });

      expect(screen.queryByText('Barclays Current')).not.toBeInTheDocument();
      expect(screen.getByText('HSBC Savings')).toBeInTheDocument();
    });

    it('shows no results message when no match', () => {
      render(<TemplateSelector {...createProps()} />);

      fireEvent.click(screen.getByText('Select a template'));
      fireEvent.change(screen.getByPlaceholderText('Search templates...'), {
        target: { value: 'NonExistent' },
      });

      expect(screen.getByText('No templates match your search')).toBeInTheDocument();
    });
  });

  describe('Compatibility Indicators', () => {
    it('shows Compatible badge for matching templates', () => {
      render(<TemplateSelector {...createProps()} />);

      fireEvent.click(screen.getByText('Select a template'));

      // Barclays template should be compatible (sample_headers match currentHeaders)
      expect(screen.getByText('Compatible')).toBeInTheDocument();
    });

    it('shows match percentage', () => {
      render(<TemplateSelector {...createProps()} />);

      fireEvent.click(screen.getByText('Select a template'));

      expect(screen.getByText('100% match')).toBeInTheDocument();
    });
  });

  describe('Usage Information', () => {
    it('shows last used information', () => {
      render(<TemplateSelector {...createProps()} />);

      fireEvent.click(screen.getByText('Select a template'));

      // Template-1 was used, check for "Used" text (there may be multiple)
      const usedElements = screen.getAllByText(/Used/);
      expect(usedElements.length).toBeGreaterThan(0);
    });

    it('shows use count for templates with usage', () => {
      render(<TemplateSelector {...createProps()} />);

      fireEvent.click(screen.getByText('Select a template'));

      // Check for the use count pattern - template 1 has 5 uses
      expect(screen.getByText(/5 imports/)).toBeInTheDocument();
    });

    it('shows "Never used" for unused templates', () => {
      render(<TemplateSelector {...createProps()} />);

      fireEvent.click(screen.getByText('Select a template'));

      expect(screen.getByText('Never used')).toBeInTheDocument();
    });
  });

  describe('Manage Templates', () => {
    it('calls onManage when Manage Templates clicked', () => {
      const onManage = vi.fn();
      render(<TemplateSelector {...createProps({ onManage })} />);

      fireEvent.click(screen.getByText('Select a template'));
      fireEvent.click(screen.getByText('Manage Templates'));

      expect(onManage).toHaveBeenCalled();
    });

    it('closes dropdown when Manage Templates clicked', () => {
      render(<TemplateSelector {...createProps()} />);

      fireEvent.click(screen.getByText('Select a template'));
      fireEvent.click(screen.getByText('Manage Templates'));

      expect(screen.queryByPlaceholderText('Search templates...')).not.toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('disables button when loading', () => {
      render(<TemplateSelector {...createProps({ isLoading: true })} />);

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });
  });
});
