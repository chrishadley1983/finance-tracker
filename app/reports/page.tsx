'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout';

interface ReportSummary {
  year: number;
  month: number;
  report_data: {
    net_worth?: number;
    income?: number;
    expenses?: number;
    savings_rate?: number;
    net_worth_change?: number;
    budget_total?: number;
  };
  generated_at: string;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function fmtCurrency(amount: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function ReportsPage() {
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewingReport, setViewingReport] = useState<{ year: number; month: number } | null>(null);
  const [reportHtml, setReportHtml] = useState<string | null>(null);
  const [isLoadingReport, setIsLoadingReport] = useState(false);

  useEffect(() => {
    async function fetchReports() {
      try {
        const response = await fetch('/api/monthly-reports/list');
        if (!response.ok) throw new Error('Failed to fetch reports');
        const data = await response.json();
        setReports(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load reports');
      } finally {
        setIsLoading(false);
      }
    }
    fetchReports();
  }, []);

  const viewReport = useCallback(async (year: number, month: number) => {
    setViewingReport({ year, month });
    setIsLoadingReport(true);
    setReportHtml(null);
    try {
      // Fetch stored point-in-time HTML
      const response = await fetch(`/api/monthly-reports/list?year=${year}&month=${month}`);
      if (!response.ok) throw new Error('No stored report found');
      const html = await response.text();
      setReportHtml(html);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
      setViewingReport(null);
    } finally {
      setIsLoadingReport(false);
    }
  }, []);

  const goBack = () => {
    setViewingReport(null);
    setReportHtml(null);
  };

  // Report viewer mode
  if (viewingReport) {
    return (
      <AppLayout title={`${MONTH_NAMES[viewingReport.month - 1]} ${viewingReport.year} Report`}>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <button
              onClick={goBack}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Reports
            </button>
            <button
              onClick={() => {
                if (reportHtml) {
                  const win = window.open('', '_blank');
                  if (win) {
                    win.document.write(reportHtml);
                    win.document.close();
                    setTimeout(() => win.print(), 500);
                  }
                }
              }}
              disabled={!reportHtml}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print / Save PDF
            </button>
          </div>

          {isLoadingReport ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex items-center gap-3 text-slate-500">
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Generating report...
              </div>
            </div>
          ) : reportHtml ? (
            <iframe
              srcDoc={reportHtml}
              className="w-full border border-slate-200 rounded-lg bg-white"
              style={{ height: 'calc(100vh - 180px)' }}
              title={`${MONTH_NAMES[viewingReport.month - 1]} ${viewingReport.year} Report`}
            />
          ) : null}
        </div>
      </AppLayout>
    );
  }

  // Report list mode
  return (
    <AppLayout title="Monthly Reports">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <p className="text-sm text-slate-500">
            View past monthly finance reports with budget analysis, net worth trends, and FIRE progress.
          </p>
        </div>

        {/* Error state */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Loading state */}
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse rounded-lg border border-slate-200 bg-white p-6">
                <div className="h-5 w-32 bg-slate-200 rounded mb-4" />
                <div className="space-y-3">
                  <div className="h-4 w-24 bg-slate-100 rounded" />
                  <div className="h-4 w-20 bg-slate-100 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : reports.length === 0 ? (
          /* Empty state */
          <div className="text-center py-16 bg-white rounded-lg border border-slate-200">
            <svg className="w-12 h-12 mx-auto text-slate-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-lg font-medium text-slate-700 mb-1">No reports yet</h3>
            <p className="text-sm text-slate-500">
              Monthly reports will appear here once generated.
            </p>
          </div>
        ) : (
          /* Report cards */
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {reports.map((report) => {
              const rd = report.report_data;
              const nwChange = rd.net_worth_change ?? 0;
              const generated = report.generated_at
                ? new Date(report.generated_at).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })
                : '';

              return (
                <button
                  key={`${report.year}-${report.month}`}
                  onClick={() => viewReport(report.year, report.month)}
                  className="text-left rounded-lg border border-slate-200 bg-white p-6 hover:border-emerald-300 hover:shadow-md transition-all group"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-slate-800 group-hover:text-emerald-700 transition-colors">
                      {MONTH_NAMES[report.month - 1]} {report.year}
                    </h3>
                    <svg className="w-5 h-5 text-slate-400 group-hover:text-emerald-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>

                  <div className="space-y-2 text-sm">
                    {rd.net_worth != null && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Net Worth</span>
                        <span className="font-medium text-slate-800">{fmtCurrency(rd.net_worth)}</span>
                      </div>
                    )}
                    {nwChange !== 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Change</span>
                        <span className={`font-medium ${nwChange >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {nwChange >= 0 ? '+' : ''}{fmtCurrency(nwChange)}
                        </span>
                      </div>
                    )}
                    {rd.income != null && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Income</span>
                        <span className="font-medium text-slate-800">{fmtCurrency(rd.income)}</span>
                      </div>
                    )}
                    {rd.expenses != null && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Spending</span>
                        <span className="font-medium text-slate-800">{fmtCurrency(rd.expenses)}</span>
                      </div>
                    )}
                    {rd.savings_rate != null && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Savings Rate</span>
                        <span className={`font-medium ${rd.savings_rate >= 20 ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {rd.savings_rate.toFixed(1)}%
                        </span>
                      </div>
                    )}
                    {rd.budget_total != null && rd.budget_total > 0 && rd.expenses != null && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">vs Budget</span>
                        <span className={`font-medium ${rd.expenses <= rd.budget_total ? 'text-emerald-600' : 'text-red-600'}`}>
                          {rd.expenses <= rd.budget_total ? 'Under' : 'Over'} by {fmtCurrency(Math.abs(rd.expenses - rd.budget_total))}
                        </span>
                      </div>
                    )}
                  </div>

                  {generated && (
                    <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-400">
                      Generated {generated}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
