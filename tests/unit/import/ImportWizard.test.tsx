import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ImportWizard } from '@/components/import/ImportWizard';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

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
    it('renders wizard with progress indicator', () => {
      render(<ImportWizard />);

      expect(screen.getByText('Upload File')).toBeInTheDocument();
      expect(screen.getByText('Map Columns')).toBeInTheDocument();
      expect(screen.getByText('Preview Data')).toBeInTheDocument();
      expect(screen.getByText('Import')).toBeInTheDocument();
      expect(screen.getByText('Complete')).toBeInTheDocument();
    });

    it('renders step numbers', () => {
      render(<ImportWizard />);

      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('starts with upload step active', () => {
      render(<ImportWizard />);

      // Upload step content should be visible
      expect(screen.getByText('Upload CSV File')).toBeInTheDocument();
      expect(screen.getByText(/drag & drop your csv file/i)).toBeInTheDocument();
    });
  });

  describe('step navigation', () => {
    it('highlights current step', () => {
      render(<ImportWizard />);

      // First step should be highlighted (bg-blue-600)
      const buttons = screen.getAllByRole('button');
      const firstStepButton = buttons.find(
        (btn) => btn.textContent === '1'
      );

      expect(firstStepButton).toHaveClass('bg-blue-600');
    });

    it('disables future steps', () => {
      render(<ImportWizard />);

      // Future steps should be disabled (bg-slate-200)
      const buttons = screen.getAllByRole('button');
      const secondStepButton = buttons.find(
        (btn) => btn.textContent === '2'
      );

      expect(secondStepButton).toHaveClass('bg-slate-200');
      expect(secondStepButton).toBeDisabled();
    });
  });
});
