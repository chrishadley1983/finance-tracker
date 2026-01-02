'use client';

import { useState, useCallback } from 'react';
import { UploadStep } from './UploadStep';
import { MappingStep } from './MappingStep';
import { CategorisedPreview } from './CategorisedPreview';
import { ImportStep } from './ImportStep';
import type { ParsedTransaction, ImportFormat } from '@/lib/types/import';
import type { ColumnMapping } from '@/lib/validations/import';

export type WizardStep = 'upload' | 'mapping' | 'preview' | 'import' | 'done';

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
  suggestedMapping: Partial<ColumnMapping> | null;
}

interface PreviewResult {
  transactions: ParsedTransaction[];
  validation: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    errors: Array<{ row: number; errors: string[] }>;
    warnings: string[];
    dateRange: { earliest: string; latest: string } | null;
    totalCredits: number;
    totalDebits: number;
  };
}

interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
  importSessionId: string;
}

export interface ImportWizardState {
  step: WizardStep;
  uploadResult: UploadResult | null;
  selectedFormat: ImportFormat | null;
  columnMapping: ColumnMapping | null;
  previewResult: PreviewResult | null;
  importResult: ImportResult | null;
  selectedAccountId: string | null;
  categoryOverrides: Map<number, { categoryId: string; categoryName: string }>;
}

const STEP_ORDER: WizardStep[] = ['upload', 'mapping', 'preview', 'import', 'done'];

const STEP_TITLES: Record<WizardStep, string> = {
  upload: 'Upload File',
  mapping: 'Map Columns',
  preview: 'Preview Data',
  import: 'Import',
  done: 'Complete',
};

export function ImportWizard() {
  const [state, setState] = useState<ImportWizardState>({
    step: 'upload',
    uploadResult: null,
    selectedFormat: null,
    columnMapping: null,
    previewResult: null,
    importResult: null,
    selectedAccountId: null,
    categoryOverrides: new Map(),
  });

  const currentStepIndex = STEP_ORDER.indexOf(state.step);

  const goToStep = useCallback((step: WizardStep) => {
    setState((prev) => ({ ...prev, step }));
  }, []);

  const handleUploadComplete = useCallback((result: UploadResult) => {
    setState((prev) => ({
      ...prev,
      uploadResult: result,
      step: 'mapping',
    }));
  }, []);

  const handleMappingComplete = useCallback(
    (mapping: ColumnMapping, format: ImportFormat | null) => {
      setState((prev) => ({
        ...prev,
        columnMapping: mapping,
        selectedFormat: format,
        step: 'preview',
      }));
    },
    []
  );

  const handlePreviewComplete = useCallback(
    (result: PreviewResult, accountId: string, categoryOverrides: Map<number, { categoryId: string; categoryName: string }>) => {
      setState((prev) => ({
        ...prev,
        previewResult: result,
        selectedAccountId: accountId,
        categoryOverrides,
        step: 'import',
      }));
    },
    []
  );

  const handleImportComplete = useCallback((result: ImportResult) => {
    setState((prev) => ({
      ...prev,
      importResult: result,
      step: 'done',
    }));
  }, []);

  const handleReset = useCallback(() => {
    setState({
      step: 'upload',
      uploadResult: null,
      selectedFormat: null,
      columnMapping: null,
      previewResult: null,
      importResult: null,
      selectedAccountId: null,
      categoryOverrides: new Map(),
    });
  }, []);

  const handleBack = useCallback(() => {
    const currentIndex = STEP_ORDER.indexOf(state.step);
    if (currentIndex > 0) {
      goToStep(STEP_ORDER[currentIndex - 1]);
    }
  }, [state.step, goToStep]);

  return (
    <div className="space-y-6">
      {/* Progress Indicator */}
      <div className="flex items-center justify-between">
        {STEP_ORDER.map((step, index) => {
          const isActive = step === state.step;
          const isCompleted = index < currentStepIndex;
          const isClickable = isCompleted && step !== 'done';

          return (
            <div key={step} className="flex items-center flex-1">
              <button
                onClick={() => isClickable && goToStep(step)}
                disabled={!isClickable}
                className={`
                  flex items-center justify-center w-10 h-10 rounded-full text-sm font-medium
                  transition-colors
                  ${isActive ? 'bg-blue-600 text-white' : ''}
                  ${isCompleted ? 'bg-green-600 text-white cursor-pointer hover:bg-green-700' : ''}
                  ${!isActive && !isCompleted ? 'bg-slate-200 text-slate-500' : ''}
                `}
              >
                {isCompleted ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  index + 1
                )}
              </button>
              <span
                className={`ml-2 text-sm font-medium hidden sm:block ${
                  isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-slate-500'
                }`}
              >
                {STEP_TITLES[step]}
              </span>
              {index < STEP_ORDER.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-4 ${
                    index < currentStepIndex ? 'bg-green-600' : 'bg-slate-200'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        {state.step === 'upload' && <UploadStep onComplete={handleUploadComplete} />}

        {state.step === 'mapping' && state.uploadResult && (
          <MappingStep
            sessionId={state.uploadResult.sessionId}
            headers={state.uploadResult.headers}
            sampleRows={state.uploadResult.sampleRows}
            detectedFormat={state.uploadResult.detectedFormat}
            suggestedMapping={state.uploadResult.suggestedMapping}
            onComplete={handleMappingComplete}
            onBack={handleBack}
          />
        )}

        {state.step === 'preview' && state.uploadResult && state.columnMapping && (
          <CategorisedPreview
            sessionId={state.uploadResult.sessionId}
            columnMapping={state.columnMapping}
            selectedFormat={state.selectedFormat}
            onComplete={handlePreviewComplete}
            onBack={handleBack}
          />
        )}

        {state.step === 'import' &&
          state.uploadResult &&
          state.previewResult &&
          state.selectedAccountId && (
            <ImportStep
              sessionId={state.uploadResult.sessionId}
              transactions={state.previewResult.transactions}
              accountId={state.selectedAccountId}
              onComplete={handleImportComplete}
              onBack={handleBack}
            />
          )}

        {state.step === 'done' && state.importResult && (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold text-slate-900 mb-2">Import Complete!</h2>
            <p className="text-slate-600 mb-6">
              Successfully imported {state.importResult.imported} transactions.
              {state.importResult.skipped > 0 && ` Skipped ${state.importResult.skipped} duplicates.`}
              {state.importResult.failed > 0 && ` ${state.importResult.failed} failed.`}
            </p>
            <div className="flex justify-center gap-4">
              <button
                onClick={handleReset}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Import Another File
              </button>
              <a
                href="/transactions"
                className="px-6 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
              >
                View Transactions
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
