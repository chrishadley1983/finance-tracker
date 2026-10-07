'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ImportFormat } from '@/lib/types/import';
import type { ColumnMapping } from '@/lib/validations/import';
import { TemplateSelector, type Template } from './TemplateSelector';
import { SaveTemplateDialog, type SaveTemplateData } from './SaveTemplateDialog';
import { TemplateManager } from './TemplateManager';
import { Button } from '@/components/ui/Button';
import { Field, Select } from '@/components/ui/Field';
import { Notice } from '@/components/ui/Notice';

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
    <div className="grid gap-6">
      <h2 className="text-[15px] font-semibold text-ink">Match columns</h2>

      {detectedFormat && (
        <Notice tone="success">
          Detected format: {detectedFormat.name}.{' '}
          {detectedFormat.confidence < 0.8
            ? `Only a partial match (${Math.round(detectedFormat.confidence * 100)}% confidence), so check the columns below.`
            : 'The columns below are filled in for you.'}
        </Notice>
      )}

      {/* AI Suggestion Section */}
      {shouldOfferAI && !aiResult && (
        <Notice
          tone="info"
          action={
            <Button size="sm" onClick={handleGetAISuggestion} loading={aiLoading} disabled={rateLimitRemaining === 0}>
              {aiLoading ? 'Analysing...' : 'Suggest columns with AI'}
            </Button>
          }
        >
          <p className="font-medium text-ink">This file&apos;s format isn&apos;t one we know</p>
          <p className="mt-0.5">
            AI can read the headers and sample rows and suggest a mapping.
            {rateLimitRemaining !== null && rateLimitRemaining > 0 && ` ${rateLimitRemaining} suggestions left today.`}
          </p>
        </Notice>
      )}

      {/* AI Result Display */}
      {aiResult && (
        <Notice tone="success" action={<Button size="sm" variant="ghost" onClick={() => setAiResult(null)}>Clear AI suggestion</Button>}>
          <p className="font-medium">
            AI suggestion applied
            {aiResult.confidence < 0.8 && ` (${Math.round(aiResult.confidence * 100)}% confidence, so check it)`}
          </p>
          <p className="mt-0.5 text-ink-2">{aiResult.reasoning}</p>
          {aiResult.warnings.length > 0 && (
            <ul className="mt-1 list-disc pl-5 text-warn">
              {aiResult.warnings.map((warning, i) => (
                <li key={i}>{warning}</li>
              ))}
            </ul>
          )}
        </Notice>
      )}

      {/* Template Selection */}
      {templates.length > 0 && (
        <div className="grid gap-1.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px] font-medium text-ink-2">Saved templates</span>
            {mapping.date && mapping.description && (
              <Button size="sm" variant="ghost" onClick={() => setShowSaveDialog(true)}>
                Save as template
              </Button>
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

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Bank format" htmlFor="import-format">
          <Select id="import-format" value={selectedFormatId || ''} onChange={(e) => setSelectedFormatId(e.target.value || null)}>
            <option value="">Custom mapping</option>
            {formats.map((format) => (
              <option key={format.id} value={format.id}>
                {format.provider} - {format.name}
              </option>
            ))}
          </Select>
        </Field>

        <fieldset className="grid gap-1.5">
          <legend className="mb-1.5 text-[13px] font-medium text-ink-2">Amounts</legend>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
            <input
              type="radio"
              name="amountMode"
              checked={!useDebitCredit}
              onChange={() => handleAmountModeChange(false)}
              className="h-4 w-4 accent-accent"
            />
            Single amount column
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
            <input
              type="radio"
              name="amountMode"
              checked={useDebitCredit}
              onChange={() => handleAmountModeChange(true)}
              className="h-4 w-4 accent-accent"
            />
            Separate debit/credit columns
          </label>
        </fieldset>
      </div>

      {/* Column Mapping */}
      <div className="grid gap-1">
        <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-4 border-b border-line pb-1.5 text-xs font-medium uppercase tracking-wide text-ink-3 md:grid">
          <span>Field</span>
          <span>Column in your file</span>
          <span>First row</span>
        </div>
        <h3 className="pt-2 text-[13px] font-semibold text-ink">Required</h3>

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

        <h3 className="pt-5 text-[13px] font-semibold text-ink">Optional</h3>

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

      {templates.length === 0 && mapping.date && mapping.description && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed border-line px-4 py-3">
          <p className="text-sm text-ink-2">Importing from this bank again? Save this mapping as a template.</p>
          <Button size="sm" onClick={() => setShowSaveDialog(true)}>
            Save template
          </Button>
        </div>
      )}

      {error && <Notice tone="error">{error}</Notice>}

      {/* Navigation */}
      <div className="flex justify-between gap-3 border-t border-line pt-4">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button variant="primary" onClick={handleContinue} loading={isLoading}>
          {isLoading ? 'Checking...' : 'Continue'}
        </Button>
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
  const id = `map-${_field}`;
  return (
    <div className="grid grid-cols-1 items-center gap-x-4 gap-y-1.5 border-b border-line-2 py-2.5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
      <div className="min-w-0">
        <label htmlFor={id} className="block text-sm font-medium text-ink">
          {label}
          {required && <span className="sr-only"> (required)</span>}
        </label>
        <p className="text-xs text-ink-3">{description}</p>
      </div>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Choose a column</option>
        {headers.map((header) => (
          <option key={header} value={header}>
            {header}
          </option>
        ))}
      </Select>
      <div className={`min-w-0 truncate text-sm ${value ? '' : 'hidden md:block'}`}>
        {value ? (
          <span className="fig text-ink-2" title={getPreviewValue(value)}>
            <span className="sr-only">Preview: </span>
            {getPreviewValue(value)}
          </span>
        ) : (
          <span className="text-ink-3">Not used</span>
        )}
      </div>
    </div>
  );
}
