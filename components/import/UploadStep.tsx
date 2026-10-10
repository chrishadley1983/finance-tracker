'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Notice } from '@/components/ui/Notice';

interface UploadResult {
  sessionId: string;
  filename: string;
  headers: string[];
  sampleRows: string[][];
  totalRows: number;
  detectedFormat: {
    id: string;
    name: string;
    confidence: number;
  } | null;
  suggestedMapping: Record<string, string> | null;
  sourceType?: 'csv' | 'pdf';
  pdfMetadata?: {
    totalPages: number;
    processedPages: number;
    visionConfidence: number;
    statementPeriod?: { start: string; end: string };
    accountInfo?: { accountNumber?: string; sortCode?: string; accountName?: string };
  };
}

interface UploadStepProps {
  onComplete: (result: UploadResult) => void;
}

function isPdfFile(file: File): boolean {
  return (
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  );
}

export function UploadStep({ onComplete }: UploadStepProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fileType, setFileType] = useState<'csv' | 'pdf' | null>(null);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      const isPdf = isPdfFile(file);
      setFileType(isPdf ? 'pdf' : 'csv');
      setIsUploading(true);
      setError(null);
      setUploadProgress(0);

      try {
        const formData = new FormData();
        formData.append('file', file);

        // Determine endpoint based on file type
        const endpoint = isPdf ? '/api/import/upload-pdf' : '/api/import/upload';

        // PDF processing takes longer - use slower progress for PDFs
        const progressIncrement = isPdf ? 3 : 10;
        const progressInterval = setInterval(() => {
          setUploadProgress((prev) => Math.min(prev + progressIncrement, 90));
        }, isPdf ? 500 : 100);

        const response = await fetch(endpoint, {
          method: 'POST',
          body: formData,
        });

        clearInterval(progressInterval);
        setUploadProgress(100);

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to upload file');
        }

        const result = await response.json();
        onComplete(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to upload file');
      } finally {
        setIsUploading(false);
        setFileType(null);
      }
    },
    [onComplete]
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject, open } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.csv'],
      'text/plain': ['.csv'],
      'application/pdf': ['.pdf'],
    },
    maxFiles: 1,
    disabled: isUploading,
    // The "Choose a file" button opens the picker; the area itself only takes drops.
    noClick: true,
    noKeyboard: true,
  });

  return (
    <div className="grid gap-5">
      <h2 className="text-[15px] font-semibold text-ink">Upload a bank statement</h2>

      <div
        {...getRootProps()}
        className={`grid min-h-[96px] place-items-center rounded-[3px] border border-dashed px-4 py-6 text-center transition-colors ${
          isDragReject ? 'border-bad bg-bad-soft' : isDragActive ? 'border-accent bg-accent-soft' : 'border-line'
        } ${isUploading ? 'cursor-wait opacity-70' : ''}`}
      >
        <input {...getInputProps()} aria-label="Statement file" />

        {isUploading ? (
          <div className="grid w-full max-w-xs gap-2" role="status">
            <div className="h-1.5 overflow-hidden rounded-full bg-line-2">
              <div className="h-full bg-accent transition-all duration-200" style={{ width: `${uploadProgress}%` }} />
            </div>
            <p className="text-sm text-ink-2">
              {fileType === 'pdf' ? 'Reading the PDF statement. This can take a minute.' : 'Reading the file...'}
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm">
            {isDragReject ? (
              <p className="text-bad">Only CSV and PDF files can be imported</p>
            ) : isDragActive ? (
              <p className="text-accent">Drop the file to upload it</p>
            ) : (
              <>
                <p className="text-ink-2">Drop a CSV or PDF here, or</p>
                <Button size="sm" onClick={open}>
                  Choose a file
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {error && (
        <Notice tone="error">
          <p className="font-medium">Upload failed</p>
          <p className="mt-0.5">{error}</p>
        </Notice>
      )}

      <div className="grid gap-2 text-sm">
        <h3 className="text-[13px] font-medium text-ink-2">Supported formats</h3>
        <dl className="grid gap-1.5 sm:grid-cols-[8rem_1fr]">
          <dt className="text-ink-3">CSV</dt>
          <dd className="flex flex-wrap gap-1.5">
            {['HSBC Current', 'HSBC Credit Card', 'Monzo', 'American Express UK'].map((b) => (
              <Chip key={b}>{b}</Chip>
            ))}
          </dd>
          <dt className="text-ink-3">PDF statements</dt>
          <dd className="flex flex-wrap gap-1.5">
            <Chip>HSBC Current</Chip>
          </dd>
        </dl>
        <p className="text-xs text-ink-3">Another bank? Any CSV works: you match its columns in the next step.</p>
      </div>
    </div>
  );
}
