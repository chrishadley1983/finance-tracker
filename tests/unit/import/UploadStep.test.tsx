import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { UploadStep } from '@/components/import/UploadStep';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('UploadStep', () => {
  const mockOnComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('rendering', () => {
    it('renders upload dropzone', () => {
      render(<UploadStep onComplete={mockOnComplete} />);

      expect(screen.getByText('Upload Bank Statement')).toBeInTheDocument();
      expect(screen.getByText(/drag & drop your csv or pdf file/i)).toBeInTheDocument();
    });

    it('renders supported formats list', () => {
      render(<UploadStep onComplete={mockOnComplete} />);

      expect(screen.getByText('Supported Formats')).toBeInTheDocument();
      expect(screen.getByText('CSV')).toBeInTheDocument();
      expect(screen.getByText('PDF Statements')).toBeInTheDocument();
      // HSBC Current appears twice (once for CSV, once for PDF)
      expect(screen.getAllByText('HSBC Current')).toHaveLength(2);
      expect(screen.getByText('HSBC Credit Card')).toBeInTheDocument();
      expect(screen.getByText('Monzo')).toBeInTheDocument();
      expect(screen.getByText('American Express UK')).toBeInTheDocument();
    });

    it('renders file input', () => {
      render(<UploadStep onComplete={mockOnComplete} />);

      const input = document.querySelector('input[type="file"]');
      expect(input).toBeInTheDocument();
    });
  });

  describe('file upload', () => {
    it('calls API on file drop', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            sessionId: 'test-session',
            filename: 'test.csv',
            headers: ['Date', 'Amount', 'Description'],
            sampleRows: [['2024-01-01', '100', 'Test']],
            totalRows: 1,
            detectedFormat: null,
            suggestedMapping: null,
          }),
      });

      render(<UploadStep onComplete={mockOnComplete} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['date,amount,description\n2024-01-01,100,Test'], 'test.csv', {
        type: 'text/csv',
      });

      Object.defineProperty(input, 'files', {
        value: [file],
      });

      fireEvent.drop(input, {
        dataTransfer: {
          files: [file],
          types: ['Files'],
        },
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/import/upload', expect.any(Object));
      });
    });

    it('shows error on upload failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Invalid file format' }),
      });

      render(<UploadStep onComplete={mockOnComplete} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['invalid'], 'test.txt', { type: 'text/plain' });

      Object.defineProperty(input, 'files', {
        value: [file],
      });

      fireEvent.drop(input, {
        dataTransfer: {
          files: [file],
          types: ['Files'],
        },
      });

      await waitFor(() => {
        expect(screen.getByText('Upload failed')).toBeInTheDocument();
        expect(screen.getByText('Invalid file format')).toBeInTheDocument();
      });
    });

    it('calls onComplete on successful upload', async () => {
      const uploadResult = {
        sessionId: 'test-session',
        filename: 'test.csv',
        headers: ['Date', 'Amount', 'Description'],
        sampleRows: [['2024-01-01', '100', 'Test']],
        totalRows: 1,
        detectedFormat: { id: 'format-1', name: 'Test Format', confidence: 0.95 },
        suggestedMapping: { date: 'Date', amount: 'Amount', description: 'Description' },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(uploadResult),
      });

      render(<UploadStep onComplete={mockOnComplete} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['date,amount,description\n2024-01-01,100,Test'], 'test.csv', {
        type: 'text/csv',
      });

      Object.defineProperty(input, 'files', {
        value: [file],
      });

      fireEvent.drop(input, {
        dataTransfer: {
          files: [file],
          types: ['Files'],
        },
      });

      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalledWith(uploadResult);
      });
    });

    it('calls PDF API on PDF file drop', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            sessionId: 'pdf-session',
            filename: 'statement.pdf',
            headers: ['Date', 'Payment Type', 'Description', 'Paid Out', 'Paid In', 'Balance'],
            sampleRows: [['01 Dec 25', 'DD', 'Netflix', '15.99', '', '1234.56']],
            totalRows: 10,
            detectedFormat: { id: 'pdf_hsbc_current', name: 'HSBC PDF Statement', confidence: 0.95 },
            suggestedMapping: { date: 'Date', description: 'Description', debit: 'Paid Out', credit: 'Paid In' },
            sourceType: 'pdf',
            pdfMetadata: { totalPages: 2, processedPages: 2, visionConfidence: 0.95 },
          }),
      });

      render(<UploadStep onComplete={mockOnComplete} />);

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['%PDF-1.4'], 'statement.pdf', {
        type: 'application/pdf',
      });

      Object.defineProperty(input, 'files', {
        value: [file],
      });

      fireEvent.drop(input, {
        dataTransfer: {
          files: [file],
          types: ['Files'],
        },
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/import/upload-pdf', expect.any(Object));
      });
    });
  });
});
