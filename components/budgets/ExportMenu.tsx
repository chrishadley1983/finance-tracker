'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import type { BudgetGroupComparison, SavingsRate } from '@/lib/types/budget';
import { MONTH_NAMES } from '@/lib/format';
import { exportBudgetToCSV, exportBudgetToPDFHtml, downloadCSV, printPDF } from '@/lib/utils/budget-export';

interface ExportMenuProps {
  year: number;
  month: number | null;
  groups: BudgetGroupComparison[];
  savingsRate: SavingsRate | null;
  disabled?: boolean;
}

/** Download the period as CSV, or open a print-ready page (Save as PDF from there). */
export function ExportMenu({ year, month, groups, savingsRate, disabled = false }: ExportMenuProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen]);

  const period = month ? `${MONTH_NAMES[month - 1]} ${year}` : `${year}`;

  const exportCSV = () => {
    setIsOpen(false);
    try {
      const csv = exportBudgetToCSV({ year, month, groups, savingsRate });
      downloadCSV(csv, `budget-${month ? `${year}-${String(month).padStart(2, '0')}` : year}.csv`);
      toast({ tone: 'success', message: `${period} budget downloaded as CSV.` });
    } catch (err) {
      toast({ tone: 'error', message: `Could not create the CSV: ${err instanceof Error ? err.message : 'unknown error'}.` });
    }
  };

  const exportPrint = () => {
    setIsOpen(false);
    try {
      const html = exportBudgetToPDFHtml({ year, month, groups, savingsRate });
      if (!printPDF(html)) {
        toast({ tone: 'error', message: 'The print page was blocked. Allow pop-ups for this site and try again.' });
      }
    } catch (err) {
      toast({ tone: 'error', message: `Could not prepare the print page: ${err instanceof Error ? err.message : 'unknown error'}.` });
    }
  };

  const item =
    'flex w-full items-center rounded px-3 py-2 text-left text-sm text-ink hover:bg-sunk focus-visible:bg-sunk focus-visible:outline-none';

  return (
    <div className="relative" ref={menuRef}>
      <Button onClick={() => setIsOpen((v) => !v)} disabled={disabled} aria-haspopup="menu" aria-expanded={isOpen}>
        <Download className="h-4 w-4" aria-hidden />
        Export
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden />
      </Button>
      {isOpen && (
        <div role="menu" className="absolute right-0 z-20 mt-1 w-56 rounded-md border border-line bg-surface p-1 shadow-lg">
          <button type="button" role="menuitem" onClick={exportCSV} className={item}>
            Download CSV
          </button>
          <button type="button" role="menuitem" onClick={exportPrint} className={item}>
            Print or save as PDF
          </button>
        </div>
      )}
    </div>
  );
}
