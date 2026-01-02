'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

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

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.csv'],
      'text/plain': ['.csv'],
      'application/pdf': ['.pdf'],
    },
    maxFiles: 1,
    disabled: isUploading,
  });

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Upload Bank Statement</h2>
        <p className="text-slate-600">
          Upload a CSV export or PDF statement from your bank. We support most major UK banks.
        </p>
      </div>

      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-12 text-center cursor-pointer
          transition-colors
          ${isDragActive && !isDragReject ? 'border-blue-500 bg-blue-50' : ''}
          ${isDragReject ? 'border-red-500 bg-red-50' : ''}
          ${!isDragActive && !isDragReject ? 'border-slate-300 hover:border-slate-400 hover:bg-slate-50' : ''}
          ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input {...getInputProps()} />

        {isUploading ? (
          <div className="space-y-4">
            <div className="w-12 h-12 mx-auto">
              <svg
                className="animate-spin text-blue-600"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>
            <div className="w-64 mx-auto">
              <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-200"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-sm text-slate-600 mt-2">
                {fileType === 'pdf'
                  ? 'Extracting transactions from PDF... This may take a minute.'
                  : 'Processing file...'}
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="w-16 h-16 mx-auto mb-4 text-slate-400">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </div>
            {isDragActive && !isDragReject && (
              <p className="text-lg font-medium text-blue-600">Drop the file here...</p>
            )}
            {isDragReject && (
              <p className="text-lg font-medium text-red-600">
                Only CSV and PDF files are accepted
              </p>
            )}
            {!isDragActive && (
              <>
                <p className="text-lg font-medium text-slate-700 mb-1">
                  Drag & drop your CSV or PDF file here
                </p>
                <p className="text-slate-500">or click to browse</p>
              </>
            )}
          </>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <h3 className="text-sm font-medium text-red-800">Upload failed</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-slate-50 rounded-lg p-4">
        <h3 className="text-sm font-medium text-slate-900 mb-2">Supported Formats</h3>
        <div className="space-y-2">
          <div>
            <span className="text-xs font-medium text-slate-700 uppercase tracking-wide">CSV</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm text-slate-600 mt-1">
              <span>HSBC Current</span>
              <span>HSBC Credit Card</span>
              <span>Monzo</span>
              <span>American Express UK</span>
            </div>
          </div>
          <div>
            <span className="text-xs font-medium text-slate-700 uppercase tracking-wide">PDF Statements</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm text-slate-600 mt-1">
              <span>HSBC Current</span>
            </div>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-3">
          Don&apos;t see your bank? CSV files can be manually mapped in the next step.
        </p>
      </div>
    </div>
  );
}
