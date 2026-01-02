import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  extractPagesAsImages,
  PdfExtractionError,
  isPdfBuffer,
  getPdfInfo,
} from '@/lib/import/pdf-extractor';

// Mock pdf-to-img
vi.mock('pdf-to-img', () => ({
  pdf: vi.fn(),
}));

describe('PDF Extractor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isPdfBuffer', () => {
    it('should accept valid PDF buffer', () => {
      // PDF magic bytes: %PDF-
      const validPdf = Buffer.from('%PDF-1.4 content');
      expect(isPdfBuffer(validPdf)).toBe(true);
    });

    it('should reject empty buffer', () => {
      const emptyBuffer = Buffer.from([]);
      expect(isPdfBuffer(emptyBuffer)).toBe(false);
    });

    it('should reject non-PDF file', () => {
      const textBuffer = Buffer.from('Hello World');
      expect(isPdfBuffer(textBuffer)).toBe(false);
    });

    it('should reject buffer shorter than 5 bytes', () => {
      const shortBuffer = Buffer.from('%PDF');
      expect(isPdfBuffer(shortBuffer)).toBe(false);
    });
  });

  describe('PdfExtractionError', () => {
    it('should create error with code', () => {
      const error = new PdfExtractionError('Test error', 'INVALID_PDF');
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('INVALID_PDF');
      expect(error.name).toBe('PdfExtractionError');
    });

    it('should have all valid error codes', () => {
      const codes = [
        'INVALID_PDF',
        'PDF_TOO_LARGE',
        'PDF_PASSWORD_PROTECTED',
        'CONVERSION_FAILED',
        'NO_PAGES',
      ] as const;
      codes.forEach((code) => {
        const error = new PdfExtractionError('Test', code);
        expect(error.code).toBe(code);
      });
    });
  });

  describe('extractPagesAsImages', () => {
    it('should throw for invalid PDF magic bytes', async () => {
      const invalidBuffer = Buffer.from('Not a PDF');

      await expect(extractPagesAsImages(invalidBuffer, 'test.pdf')).rejects.toThrow(
        PdfExtractionError
      );
      await expect(extractPagesAsImages(invalidBuffer, 'test.pdf')).rejects.toThrow(
        'not a valid PDF'
      );
    });

    it('should throw for empty buffer', async () => {
      const emptyBuffer = Buffer.from([]);

      await expect(extractPagesAsImages(emptyBuffer, 'test.pdf')).rejects.toThrow(
        PdfExtractionError
      );
    });

    it('should respect maxPages option', async () => {
      const { pdf } = await import('pdf-to-img');
      const mockPdf = pdf as ReturnType<typeof vi.fn>;

      // Mock returning 10 pages
      const mockPages = Array.from({ length: 10 }, (_, i) =>
        Buffer.from(`page ${i + 1}`)
      );
      mockPdf.mockResolvedValue({
        length: 10,
        [Symbol.asyncIterator]: async function* () {
          for (const page of mockPages) {
            yield page;
          }
        },
      });

      const validPdfBuffer = Buffer.from('%PDF-1.4');
      const result = await extractPagesAsImages(validPdfBuffer, 'test.pdf', { maxPages: 3 });

      // Should only process 3 pages
      expect(result.pages).toHaveLength(3);
      // totalPages reflects how many were iterated before stopping (stops early due to maxPages)
      // We iterated through 4 pages (3 stored + 1 more check that triggers break)
      expect(result.totalPages).toBe(4);
    });

    it('should return correct page structure', async () => {
      const { pdf } = await import('pdf-to-img');
      const mockPdf = pdf as ReturnType<typeof vi.fn>;

      const mockPageBuffer = Buffer.from('mock image data');
      mockPdf.mockResolvedValue({
        length: 1,
        [Symbol.asyncIterator]: async function* () {
          yield mockPageBuffer;
        },
      });

      const validPdfBuffer = Buffer.from('%PDF-1.4');
      const result = await extractPagesAsImages(validPdfBuffer, 'test.pdf');

      expect(result.pages[0].pageNumber).toBe(1);
      expect(result.pages[0].imageBuffer).toEqual(mockPageBuffer);
      expect(result.metadata.filename).toBe('test.pdf');
    });

    it('should handle pdf library errors gracefully', async () => {
      const { pdf } = await import('pdf-to-img');
      const mockPdf = pdf as ReturnType<typeof vi.fn>;

      mockPdf.mockRejectedValue(new Error('PDF library error'));

      const validPdfBuffer = Buffer.from('%PDF-1.4');

      await expect(extractPagesAsImages(validPdfBuffer, 'test.pdf')).rejects.toThrow(
        PdfExtractionError
      );
    });

    it('should throw for oversized PDF', async () => {
      // Create a buffer larger than 10MB
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024);
      // Add PDF header
      largeBuffer.write('%PDF-1.4', 0);

      await expect(extractPagesAsImages(largeBuffer, 'large.pdf')).rejects.toThrow(
        PdfExtractionError
      );
      await expect(extractPagesAsImages(largeBuffer, 'large.pdf')).rejects.toThrow('size');
    });
  });

  describe('getPdfInfo', () => {
    it('should return invalid for non-PDF buffer', async () => {
      const textBuffer = Buffer.from('Hello World');
      const result = await getPdfInfo(textBuffer);

      expect(result.isValid).toBe(false);
      expect(result.pageCount).toBe(0);
    });

    it('should count pages for valid PDF', async () => {
      const { pdf } = await import('pdf-to-img');
      const mockPdf = pdf as ReturnType<typeof vi.fn>;

      mockPdf.mockResolvedValue({
        [Symbol.asyncIterator]: async function* () {
          yield Buffer.from('page1');
          yield Buffer.from('page2');
          yield Buffer.from('page3');
        },
      });

      const validPdfBuffer = Buffer.from('%PDF-1.4');
      const result = await getPdfInfo(validPdfBuffer);

      expect(result.isValid).toBe(true);
      expect(result.pageCount).toBe(3);
    });

    it('should handle errors gracefully', async () => {
      const { pdf } = await import('pdf-to-img');
      const mockPdf = pdf as ReturnType<typeof vi.fn>;

      mockPdf.mockRejectedValue(new Error('Failed'));

      const validPdfBuffer = Buffer.from('%PDF-1.4');
      const result = await getPdfInfo(validPdfBuffer);

      expect(result.isValid).toBe(false);
      expect(result.pageCount).toBe(0);
    });
  });
});
