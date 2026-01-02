'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ImportFormat } from '@/lib/types/import';
import type { ColumnMapping } from '@/lib/validations/import';
import { TemplateSelector, type Template } from './TemplateSelector';
import { SaveTemplateDialog, type SaveTemplateData } from './SaveTemplateDialog';
import { TemplateManager } from './TemplateManager';

interface AISuggestionResponse {
  suggestion: {
    mapping: ColumnMapping;
    dateFormat: string;
    decimalSeparator: '.' | ',';
    amountStyle: 'single' | 'separate';
    confidence: number;
    reasoning: string;
    warnings: string[];
  };
  usedCache: boolean;
  rateLimitRemaining: number;
}

interface MappingStepProps {
  sessionId: string;
  headers: string[];
  sampleRows: string[][];
  detectedFormat: {
    id: string;
    name: string;
    confidence: number;
  } | null;
  suggestedMapping: Partial<ColumnMapping> | null;
  onComplete: (mapping: ColumnMapping, format: ImportFormat | null) => void;
  onBack: () => void;
}

interface FormatOption {
  id: string;
  name: string;
  provider: string;
}

const REQUIRED_FIELDS = ['date', 'description'] as const;
const AMOUNT_FIELDS = ['amount', 'debit', 'credit'] as const;
const OPTIONAL_FIELDS = ['reference', 'balance', 'category'] as const;

const FIELD_LABELS: Record<string, string> = {
  date: 'Date',
  description: 'Description',
  amount: 'Amount',
  debit: 'Debit',
  credit: 'Credit',
  reference: 'Reference',
  balance: 'Balance',
  category: 'Category',
};

const FIELD_DESCRIPTIONS: Record<string, string> = {
  date: 'Transaction date',
  description: 'Transaction description or payee',
  amount: 'Single column with positive/negative amounts',
  debit: 'Money out (expenses)',
  credit: 'Money in (income)',
  reference: 'Transaction reference number',
  balance: 'Account balance after transaction',
  category: 'Transaction category',
};

export function MappingStep({
  sessionId,
  headers,
  sampleRows,
  detectedFormat,
  suggestedMapping,
  onComplete,
  onBack,
}: MappingStepProps) {
  const [formats, setFormats] = useState<FormatOption[]>([]);
  const [selectedFormatId, setSelectedFormatId] = useState<string | null>(
    detectedFormat?.id || null
  );
  const [mapping, setMapping] = useState<Partial<ColumnMapping>>(suggestedMapping || {});
  const [useDebitCredit, setUseDebitCredit] = useState(
    !!(suggestedMapping?.debit && suggestedMapping?.credit)
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<AISuggestionResponse['suggestion'] | null>(null);
  const [rateLimitRemaining, setRateLimitRemaining] = useState<number | null>(null);

  // Template state
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [templatesLoading, setTemplatesLoading] = useState(true);

  // Check if AI suggestion should be offered (low confidence detection)
  const shouldOfferAI = !detectedFormat || detectedFormat.confidence < 0.6;

  // Fetch AI suggestion
  const handleGetAISuggestion = useCallback(async () => {
    setAiLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/import/ai-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          headers,
          sampleRows,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          setError('Daily AI suggestion limit reached. Please map columns manually.');
          setRateLimitRemaining(0);
        } else {
          setError(data.error || 'Failed to get AI suggestion');
        }
        return;
      }

      const result = data as AISuggestionResponse;
      setAiResult(result.suggestion);
      setRateLimitRemaining(result.rateLimitRemaining);

      // Apply the AI suggestion to the mapping
      const aiMapping = result.suggestion.mapping;
      setMapping({
        date: aiMapping.date || undefined,
        description: aiMapping.description || undefined,
        amount: aiMapping.amount || undefined,
        debit: aiMapping.debit || undefined,
        credit: aiMapping.credit || undefined,
        reference: aiMapping.reference || undefined,
        balance: aiMapping.balance || undefined,
      });

      // Set the amount mode based on AI detection
      setUseDebitCredit(result.suggestion.amountStyle === 'separate');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get AI suggestion');
    } finally {
      setAiLoading(false);
    }
  }, [sessionId, headers, sampleRows]);

  // Fetch available formats
  useEffect(() => {
    async function fetchFormats() {
      try {
        const response = await fetch('/api/import/formats?includeSystem=true');
        if (response.ok) {
          const data = await response.json();
          setFormats(data.formats);
        }
      } catch {
        console.error('Failed to fetch formats');
      }
    }
    fetchFormats();
  }, []);

  // Fetch user templates
  useEffect(() => {
    async function fetchTemplates() {
      setTemplatesLoading(true);
      try {
        const response = await fetch('/api/import/templates');
        if (response.ok) {
          const data = await response.json();
          setTemplates(data.templates);
        }
      } catch {
        console.error('Failed to fetch templates');
      } finally {
        setTemplatesLoading(false);
      }
    }
    fetchTemplates();
  }, []);

  // Load format mapping when selection changes
  useEffect(() => {
    if (selectedFormatId && formats.length > 0) {
      const format = formats.find((f) => f.id === selectedFormatId);
      if (format) {
        // Fetch full format details to get column mapping
        fetch(`/api/import/formats?provider=${format.provider}&includeSystem=true`)
          .then((res) => res.json())
          .then((data) => {
            const fullFormat = data.formats.find(
              (f: ImportFormat) => f.id === selectedFormatId
            );
            if (fullFormat?.column_mapping) {
              setMapping(fullFormat.column_mapping);
              setUseDebitCredit(
                !!(fullFormat.column_mapping.debit && fullFormat.column_mapping.credit)
              );
            }
          })
          .catch(console.error);
      }
    }
  }, [selectedFormatId, formats]);

  const handleFieldChange = useCallback((field: string, value: string) => {
    setMapping((prev) => ({
      ...prev,
      [field]: value || undefined,
    }));
  }, []);

  const handleAmountModeChange = useCallback((useDebitCreditMode: boolean) => {
    setUseDebitCredit(useDebitCreditMode);
    if (useDebitCreditMode) {
      setMapping((prev) => ({
        ...prev,
        amount: undefined,
      }));
    } else {
      setMapping((prev) => ({
        ...prev,
        debit: undefined,
        credit: undefined,
      }));
    }
  }, []);

  // Handle template selection
  const handleTemplateSelect = useCallback(async (template: Template) => {
    setSelectedTemplate(template);
    setSelectedFormatId(template.id);

    // Apply the template's column mapping
    if (template.column_mapping) {
      const templateMapping = template.column_mapping as Partial<ColumnMapping>;
      setMapping({
        date: templateMapping.date || '',
        description: templateMapping.description || '',
        amount: templateMapping.amount,
        debit: templateMapping.debit,
        credit: templateMapping.credit,
        reference: templateMapping.reference,
        balance: templateMapping.balance,
      });

      // Set amount mode
      setUseDebitCredit(!!(templateMapping.debit && templateMapping.credit));
    }

    // Record template usage
    try {
      await fetch(`/api/import/templates/${template.id}/use`, {
        method: 'POST',
      });
    } catch {
      // Silently fail - not critical
    }
  }, []);

  // Handle saving new template
  const handleSaveTemplate = useCallback(async (templateData: SaveTemplateData) => {
    const response = await fetch('/api/import/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(templateData),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to save template');
    }

    const newTemplate = await response.json();
    setTemplates((prev) => [newTemplate, ...prev]);
    setSelectedTemplate(newTemplate);
  }, []);

  // Handle template deletion from manager
  const handleTemplateDeleted = useCallback((templateId: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== templateId));
    if (selectedTemplate?.id === templateId) {
      setSelectedTemplate(null);
      setSelectedFormatId(null);
    }
  }, [selectedTemplate?.id]);

  // Handle template update from manager
  const handleTemplateUpdated = useCallback((updatedTemplate: Template) => {
    setTemplates((prev) =>
      prev.map((t) => (t.id === updatedTemplate.id ? updatedTemplate : t))
    );
    if (selectedTemplate?.id === updatedTemplate.id) {
      setSelectedTemplate(updatedTemplate);
    }
  }, [selectedTemplate?.id]);

  const validateMapping = useCallback((): string | null => {
    if (!mapping.date) return 'Date column is required';
    if (!mapping.description) return 'Description column is required';

    if (useDebitCredit) {
      if (!mapping.debit) return 'Debit column is required';
      if (!mapping.credit) return 'Credit column is required';
    } else {
      if (!mapping.amount) return 'Amount column is required';
    }

    return null;
  }, [mapping, useDebitCredit]);

  const handleContinue = useCallback(async () => {
    const validationError = validateMapping();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Find selected format for passing to next step
      const selectedFormat = formats.find((f) => f.id === selectedFormatId) as ImportFormat | undefined;

      onComplete(mapping as ColumnMapping, selectedFormat || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to validate mapping');
    } finally {
      setIsLoading(false);
    }
  }, [mapping, formats, selectedFormatId, validateMapping, onComplete]);

  const getPreviewValue = (columnName: string): string => {
    const columnIndex = headers.indexOf(columnName);
    if (columnIndex === -1 || sampleRows.length === 0) return '-';
    return sampleRows[0][columnIndex] || '-';
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Map Columns</h2>
        <p className="text-slate-600">
          Match your CSV columns to the required fields. We&apos;ll try to auto-detect them for you.
        </p>
      </div>

      {detectedFormat && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-sm font-medium text-blue-800">
              Detected format: {detectedFormat.name} ({Math.round(detectedFormat.confidence * 100)}%
              confidence)
            </span>
          </div>
        </div>
      )}

      {/* AI Suggestion Section */}
      {shouldOfferAI && !aiResult && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <div>
                <span className="text-sm font-medium text-purple-800">
                  Unknown format detected
                </span>
                <p className="text-xs text-purple-600">
                  Let AI analyse your CSV and suggest column mappings
                </p>
              </div>
            </div>
            <button
              onClick={handleGetAISuggestion}
              disabled={aiLoading || rateLimitRemaining === 0}
              className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:bg-purple-300 transition-colors flex items-center gap-2"
            >
              {aiLoading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Analysing...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Get AI Suggestion
                </>
              )}
            </button>
          </div>
          {rateLimitRemaining !== null && rateLimitRemaining > 0 && (
            <p className="text-xs text-purple-500 mt-2">
              {rateLimitRemaining} AI suggestions remaining today
            </p>
          )}
        </div>
      )}

      {/* AI Result Display */}
      {aiResult && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="text-sm font-medium text-green-800">
              AI suggestion applied ({Math.round(aiResult.confidence * 100)}% confidence)
            </span>
          </div>
          <p className="text-sm text-green-700">{aiResult.reasoning}</p>
          {aiResult.warnings.length > 0 && (
            <div className="text-sm text-amber-700 bg-amber-50 rounded p-2">
              <strong>Warnings:</strong>
              <ul className="list-disc list-inside mt-1">
                {aiResult.warnings.map((warning, i) => (
                  <li key={i}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
          <button
            onClick={() => setAiResult(null)}
            className="text-xs text-green-600 hover:text-green-800 underline"
          >
            Clear AI suggestion
          </button>
        </div>
      )}

      {/* Template Selection */}
      {templates.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-slate-700">
              Saved Templates
            </label>
            {mapping.date && mapping.description && (
              <button
                onClick={() => setShowSaveDialog(true)}
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                Save as Template
              </button>
            )}
          </div>
          <TemplateSelector
            templates={templates}
            currentHeaders={headers}
            selectedTemplateId={selectedTemplate?.id || null}
            onSelect={handleTemplateSelect}
            onManage={() => setShowTemplateManager(true)}
            isLoading={templatesLoading}
          />
        </div>
      )}

      {/* Save Template Button (when no templates exist) */}
      {templates.length === 0 && mapping.date && mapping.description && (
        <div className="bg-slate-50 border border-slate-200 border-dashed rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">Save as Template</p>
              <p className="text-xs text-slate-500">
                Save this mapping for future imports from the same source.
              </p>
            </div>
            <button
              onClick={() => setShowSaveDialog(true)}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              Save Template
            </button>
          </div>
        </div>
      )}

      {/* Format Selection */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Import Format
        </label>
        <select
          value={selectedFormatId || ''}
          onChange={(e) => setSelectedFormatId(e.target.value || null)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Custom Mapping</option>
          {formats.map((format) => (
            <option key={format.id} value={format.id}>
              {format.provider} - {format.name}
            </option>
          ))}
        </select>
      </div>

      {/* Amount Mode Toggle */}
      <div className="bg-slate-50 rounded-lg p-4">
        <label className="block text-sm font-medium text-slate-700 mb-3">
          Amount Format
        </label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="amountMode"
              checked={!useDebitCredit}
              onChange={() => handleAmountModeChange(false)}
              className="w-4 h-4 text-blue-600"
            />
            <span className="text-sm text-slate-700">Single amount column</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="amountMode"
              checked={useDebitCredit}
              onChange={() => handleAmountModeChange(true)}
              className="w-4 h-4 text-blue-600"
            />
            <span className="text-sm text-slate-700">Separate debit/credit columns</span>
          </label>
        </div>
      </div>

      {/* Column Mapping */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-slate-700">Required Fields</h3>

        {REQUIRED_FIELDS.map((field) => (
          <ColumnMapper
            key={field}
            field={field}
            label={FIELD_LABELS[field]}
            description={FIELD_DESCRIPTIONS[field]}
            headers={headers}
            value={mapping[field] || ''}
            onChange={(value) => handleFieldChange(field, value)}
            getPreviewValue={getPreviewValue}
            required
          />
        ))}

        {useDebitCredit ? (
          <>
            {AMOUNT_FIELDS.filter((f) => f !== 'amount').map((field) => (
              <ColumnMapper
                key={field}
                field={field}
                label={FIELD_LABELS[field]}
                description={FIELD_DESCRIPTIONS[field]}
                headers={headers}
                value={mapping[field] || ''}
                onChange={(value) => handleFieldChange(field, value)}
                getPreviewValue={getPreviewValue}
                required
              />
            ))}
          </>
        ) : (
          <ColumnMapper
            field="amount"
            label={FIELD_LABELS.amount}
            description={FIELD_DESCRIPTIONS.amount}
            headers={headers}
            value={mapping.amount || ''}
            onChange={(value) => handleFieldChange('amount', value)}
            getPreviewValue={getPreviewValue}
            required
          />
        )}

        <h3 className="text-sm font-medium text-slate-700 mt-6">Optional Fields</h3>

        {OPTIONAL_FIELDS.map((field) => (
          <ColumnMapper
            key={field}
            field={field}
            label={FIELD_LABELS[field]}
            description={FIELD_DESCRIPTIONS[field]}
            headers={headers}
            value={mapping[field] || ''}
            onChange={(value) => handleFieldChange(field, value)}
            getPreviewValue={getPreviewValue}
          />
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t border-slate-200">
        <button
          onClick={onBack}
          className="px-4 py-2 text-slate-600 hover:text-slate-800 transition-colors"
        >
          Back
        </button>
        <button
          onClick={handleContinue}
          disabled={isLoading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
        >
          {isLoading ? 'Validating...' : 'Continue'}
        </button>
      </div>

      {/* Save Template Dialog */}
      <SaveTemplateDialog
        isOpen={showSaveDialog}
        mapping={mapping as ColumnMapping}
        headers={headers}
        dateFormat="DD/MM/YYYY"
        decimalSeparator="."
        hasHeader={true}
        skipRows={0}
        onSave={handleSaveTemplate}
        onClose={() => setShowSaveDialog(false)}
      />

      {/* Template Manager Dialog */}
      <TemplateManager
        isOpen={showTemplateManager}
        onClose={() => setShowTemplateManager(false)}
        onTemplateDeleted={handleTemplateDeleted}
        onTemplateUpdated={handleTemplateUpdated}
      />
    </div>
  );
}

interface ColumnMapperProps {
  field: string;
  label: string;
  description: string;
  headers: string[];
  value: string;
  onChange: (value: string) => void;
  getPreviewValue: (columnName: string) => string;
  required?: boolean;
}

function ColumnMapper({
  field: _field,
  label,
  description,
  headers,
  value,
  onChange,
  getPreviewValue,
  required = false,
}: ColumnMapperProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start py-3 border-b border-slate-100">
      <div>
        <label className="block text-sm font-medium text-slate-900">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
        <p className="text-xs text-slate-500 mt-0.5">{description}</p>
      </div>
      <div>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">-- Select column --</option>
          {headers.map((header) => (
            <option key={header} value={header}>
              {header}
            </option>
          ))}
        </select>
      </div>
      <div className="text-sm text-slate-600 bg-slate-50 px-3 py-2 rounded truncate">
        {value ? (
          <>
            <span className="text-slate-400">Preview: </span>
            {getPreviewValue(value)}
          </>
        ) : (
          <span className="text-slate-400">No column selected</span>
        )}
      </div>
    </div>
  );
}
