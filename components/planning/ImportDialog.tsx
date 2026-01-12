'use client';

import { useState, useMemo } from 'react';
import type { PlanningSectionWithNotes } from '@/lib/validations/planning';

interface ParsedSection {
  name: string;
  notes: string[];
  isNew: boolean;
  existingSectionId?: string;
}

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sections: PlanningSectionWithNotes[];
  onImport: (data: { sections: ParsedSection[] }) => Promise<void>;
  isLoading?: boolean;
}

export function ImportDialog({
  open,
  onOpenChange,
  sections,
  onImport,
  isLoading,
}: ImportDialogProps) {
  const [rawText, setRawText] = useState('');
  const [step, setStep] = useState<'input' | 'preview'>('input');
  const [error, setError] = useState<string | null>(null);

  // Parse the raw text into sections and notes
  const parsedSections = useMemo(() => {
    if (!rawText.trim()) return [];

    const result: ParsedSection[] = [];
    let currentSection: ParsedSection | null = null;

    const lines = rawText.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Check if this is a bullet point (note)
      const isBullet = /^[-*•]\s*/.test(trimmed);

      if (!isBullet) {
        // This is a section header
        // Clean up the header (remove underlines, dashes at the end)
        const cleanedHeader = trimmed.replace(/^[_\-=]+|[_\-=]+$/g, '').trim();

        if (!cleanedHeader) continue;

        // Check if section already exists
        const existingSection = sections.find(
          (s) => s.name.toLowerCase() === cleanedHeader.toLowerCase()
        );

        // Save previous section if it has notes
        if (currentSection && currentSection.notes.length > 0) {
          result.push(currentSection);
        }

        currentSection = {
          name: cleanedHeader,
          notes: [],
          isNew: !existingSection,
          existingSectionId: existingSection?.id,
        };
      } else if (currentSection) {
        // This is a note under the current section
        const noteContent = trimmed.replace(/^[-*•]\s*/, '');
        if (noteContent) {
          currentSection.notes.push(noteContent);
        }
      }
    }

    // Don't forget the last section
    if (currentSection && currentSection.notes.length > 0) {
      result.push(currentSection);
    }

    return result;
  }, [rawText, sections]);

  const totalNotes = parsedSections.reduce((sum, s) => sum + s.notes.length, 0);
  const newSections = parsedSections.filter((s) => s.isNew).length;

  const handleImport = async () => {
    setError(null);
    try {
      await onImport({ sections: parsedSections });
      onOpenChange(false);
      setRawText('');
      setStep('input');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import');
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setRawText('');
    setStep('input');
    setError(null);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      {/* Dialog */}
      <div className="relative bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Import Planning Notes
          </h2>
          <button
            onClick={handleClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}

          {step === 'input' ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Paste your planning notes below. Use section headers on their own line,
                and bullet points (-, *, or •) for individual notes.
              </p>

              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder={`Example format:

Role
- Give Lego business 18 months to see if it is working
- Aim for 500-700 a week profit

2024 Financials
- Maximise ISA input if we have enough money
- Pension input for Abby based on keeping below 50k tax band`}
                rows={15}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                autoFocus
              />

              {rawText.trim() && (
                <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    Detected: <span className="font-medium">{parsedSections.length} sections</span>
                    {' with '}
                    <span className="font-medium">{totalNotes} notes</span>
                    {newSections > 0 && (
                      <>
                        {' ('}
                        <span className="text-green-600 dark:text-green-400">
                          {newSections} new
                        </span>
                        {')'}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Review the sections and notes that will be imported:
              </p>

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {parsedSections.map((section, i) => (
                  <div
                    key={i}
                    className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden"
                  >
                    <div className="px-3 py-2 bg-slate-50 dark:bg-slate-700/50 flex items-center justify-between">
                      <span className="font-medium text-slate-900 dark:text-slate-100">
                        {section.name}
                      </span>
                      <span
                        className={`px-2 py-0.5 text-xs rounded ${
                          section.isNew
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                            : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                        }`}
                      >
                        {section.isNew ? 'New section' : 'Add to existing'}
                      </span>
                    </div>
                    <div className="px-3 py-2 space-y-1">
                      {section.notes.map((note, j) => (
                        <div key={j} className="flex items-start gap-2 text-sm">
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-400 flex-shrink-0" />
                          <span className="text-slate-700 dark:text-slate-300">{note}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-4 border-t border-slate-200 dark:border-slate-700">
          {step === 'preview' && (
            <button
              onClick={() => setStep('input')}
              className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100"
            >
              ← Back to edit
            </button>
          )}
          {step === 'input' && <div />}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
              Cancel
            </button>

            {step === 'input' ? (
              <button
                onClick={() => setStep('preview')}
                disabled={parsedSections.length === 0}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Preview Import
              </button>
            ) : (
              <button
                onClick={handleImport}
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? 'Importing...' : `Import ${totalNotes} Notes`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
