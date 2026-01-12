'use client';

import { useState, useRef, useEffect } from 'react';
import type { BudgetGroupComparison, SavingsRate } from '@/lib/types/budget';
import { MONTH_NAMES } from '@/lib/types/budget';
import {
  exportBudgetToCSV,
  exportBudgetToPDFHtml,
  downloadCSV,
  printPDF,
} from '@/lib/utils/budget-export';

interface ExportMenuProps {
  year: number;
  month: number | null;
  groups: BudgetGroupComparison[];
  savingsRate: SavingsRate | null;
  disabled?: boolean;
}

export function ExportMenu({
  year,
  month,
  groups,
  savingsRate,
  disabled = false,
}: ExportMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleExportCSV = () => {
    const csv = exportBudgetToCSV({ year, month, groups, savingsRate });
    const period = month ? `${MONTH_NAMES[month - 1]}-${year}` : `${year}`;
    downloadCSV(csv, `budget-report-${period}.csv`);
    setIsOpen(false);
  };

  const handleExportPDF = () => {
    const html = exportBudgetToPDFHtml({ year, month, groups, savingsRate });
    printPDF(html);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700
                 border border-slate-300 rounded-md bg-white
                 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed
                 transition-colors"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
          />
        </svg>
        Export
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
          <div className="py-1">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-3 w-full px-4 py-2 text-sm text-slate-700
                       hover:bg-slate-100 transition-colors"
            >
              <svg
                className="w-4 h-4 text-emerald-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Export as CSV
            </button>
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-3 w-full px-4 py-2 text-sm text-slate-700
                       hover:bg-slate-100 transition-colors"
            >
              <svg
                className="w-4 h-4 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
              Export as PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
