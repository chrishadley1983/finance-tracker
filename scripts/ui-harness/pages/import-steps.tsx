/**
 * UI harness entry for the later import steps (the real page always opens on
 * Upload). Pick the step with ?step=mapping|preview|import|done in --path.
 * Dev tool only; not part of the app build.
 */
import { useEffect } from 'react';
import { AppLayout } from '@/components/layout';
import { ImportWizard, type ImportWizardState } from '@/components/import/ImportWizard';
import fixtures from '../fixtures/import.json';

const query = new URLSearchParams((window as unknown as { __path: string }).__path.split('?')[1] ?? '');
const step = (query.get('step') ?? 'mapping') as ImportWizardState['step'];
/** ?edit=1 on the preview step opens Edit Mode (bulk edit table). */
const clickLabel = step === 'import' ? 'Check for Duplicates' : step === 'preview' && query.get('edit') ? 'Edit Mode' : null;

const upload = {
  sessionId: 'harness-session',
  filename: 'hsbc-september.csv',
  headers: ['Date', 'Description', 'Amount', 'Balance'],
  sampleRows: [
    ['01/09/2026', 'TESCO STORES 2841 SEVENOAKS', '-84.27', '2,341.10'],
    ['01/09/2026', 'ACME ENGINEERING LTD SALARY SEP', '3412.55', '5,753.65'],
  ],
  totalRows: 12,
  detectedFormat: { id: 'f-hsbc', name: 'HSBC Current account CSV', confidence: 0.95 },
  suggestedMapping: { date: 'Date', description: 'Description', amount: 'Amount', balance: 'Balance' },
};
const mapping = { date: 'Date', description: 'Description', amount: 'Amount' };
const preview = fixtures['/api/import/preview'];

const initial: Partial<ImportWizardState> = {
  step,
  uploadResult: upload,
  columnMapping: mapping as ImportWizardState['columnMapping'],
  previewResult: step === 'import' ? (preview as ImportWizardState['previewResult']) : null,
  selectedAccountId: 'a-joint',
  importResult:
    step === 'done'
      ? { success: true, imported: 10, skipped: 2, failed: 0, errors: [], importSessionId: 'harness-session' }
      : null,
};

export default function ImportStepsHarness() {
  // Press a button once the step has loaded (duplicate check, Edit Mode) so that state renders.
  useEffect(() => {
    if (!clickLabel) return;
    const t = setTimeout(() => {
      Array.from(document.querySelectorAll('button'))
        .find((b) => b.textContent?.trim() === clickLabel)
        ?.click();
    }, 400);
    return () => clearTimeout(t);
  }, []);
  return (
    <AppLayout title="Import">
      <div className="max-w-5xl">
        <ImportWizard initialState={initial} />
      </div>
    </AppLayout>
  );
}
