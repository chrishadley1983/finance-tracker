'use client';

import { useState, useCallback } from 'react';
import { UploadStep } from './UploadStep';
import { MappingStep } from './MappingStep';
import { CategorisedPreview } from './CategorisedPreview';
import { ImportStep } from './ImportStep';
import { PageIntro } from '@/components/ui/PageIntro';
import { ImportDone } from './ImportDone';
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

export interface ImportResult {
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
  upload: 'Upload',
  mapping: 'Match columns',
  preview: 'Check and categorise',
  import: 'Import',
  done: 'Done',
};

const STEP_INTRO: Record<WizardStep, string> = {
  upload: 'Bring in transactions from a bank statement. CSV exports and HSBC PDF statements both work.',
  mapping: 'Tell us which column holds the date, description and amount. Known bank formats are matched for you.',
  preview: 'Check the rows and their categories before anything is saved. Nothing is imported yet.',
  import: 'Look for duplicates of transactions you already have, then import.',
  done: 'That file is done. Check anything that needs a look, or bring in another statement.',
};

export interface ImportWizardProps {
  /** Start part-way through (tests and the UI harness). Defaults to the upload step. */
  initialState?: Partial<ImportWizardState>;
}

export function ImportWizard({ initialState }: ImportWizardProps = {}) {
  const [state, setState] = useState<ImportWizardState>(() => ({
    step: 'upload',
    uploadResult: null,
    selectedFormat: null,
    columnMapping: null,
    previewResult: null,
    importResult: null,
    selectedAccountId: null,
    categoryOverrides: new Map(),
    ...initialState,
  }));

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
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <div className="grid gap-3">
        <PageIntro>{STEP_INTRO[state.step]}</PageIntro>
        <nav aria-label="Import steps">
          <ol className="flex flex-wrap items-center gap-x-1 gap-y-1 text-[13px]">
            {STEP_ORDER.map((step, index) => {
              const isActive = step === state.step;
              const isCompleted = index < currentStepIndex;
              const isClickable = isCompleted && step !== 'done' && state.step !== 'done';
              const label = (
                <>
                  <span className="fig mr-1.5 text-[12px]">{index + 1}</span>
                  {STEP_TITLES[step]}
                </>
              );
              return (
                <li key={step} className="flex items-center gap-1">
                  {isClickable ? (
                    <button
                      type="button"
                      onClick={() => goToStep(step)}
                      className="rounded-md px-1.5 py-0.5 text-ink-2 underline-offset-2 hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-accent"
                    >
                      {label}
                    </button>
                  ) : (
                    <span
                      aria-current={isActive ? 'step' : undefined}
                      className={`px-1.5 py-0.5 ${isActive ? 'font-semibold text-ink' : isCompleted ? 'text-ink-2' : 'text-ink-3'}`}
                    >
                      {label}
                    </span>
                  )}
                  {index < STEP_ORDER.length - 1 && (
                    <span aria-hidden="true" className="text-ink-3">
                      /
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      </div>

      {/* Step Content */}
      <div className="min-w-0 border-t-[1.5px] border-ink pt-5">
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
          <ImportDone result={state.importResult} onReset={handleReset} />
        )}
      </div>
    </div>
  );
}
