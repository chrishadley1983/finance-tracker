import type { BudgetGroupComparison, SavingsRate } from '@/lib/types/budget';
import { MONTH_NAMES } from '@/lib/types/budget';
import { formatGBP } from '@/lib/format';

interface ExportData {
  year: number;
  month: number | null;
  groups: BudgetGroupComparison[];
  savingsRate: SavingsRate | null;
}

/**
 * Export budget data to CSV format
 */
export function exportBudgetToCSV(data: ExportData): string {
  const { year, month, groups, savingsRate } = data;
  const lines: string[] = [];

  // Header
  const period = month ? `${MONTH_NAMES[month - 1]} ${year}` : `${year}`;
  lines.push(`Budget Report - ${period}`);
  lines.push('');

  // Savings Rate Summary
  if (savingsRate) {
    lines.push('Summary');
    lines.push('Metric,Budget,Actual,Variance');
    lines.push(
      `Total Income,${savingsRate.totalIncomeBudget},${savingsRate.totalIncomeActual},${savingsRate.totalIncomeActual - savingsRate.totalIncomeBudget}`
    );
    lines.push(
      `Total Expenses,${savingsRate.totalExpenseBudget},${savingsRate.totalExpenseActual},${savingsRate.totalExpenseBudget - savingsRate.totalExpenseActual}`
    );
    lines.push(
      `Savings,${savingsRate.savingsBudget},${savingsRate.savingsActual},${savingsRate.savingsActual - savingsRate.savingsBudget}`
    );
    lines.push(
      `Savings Rate,${savingsRate.savingsRateBudget}%,${savingsRate.savingsRateActual}%,${(savingsRate.savingsRateActual - savingsRate.savingsRateBudget).toFixed(1)}%`
    );
    lines.push('');
  }

  // Budget Details
  lines.push('Budget Details');
  lines.push('Group,Category,Budget,Actual,Variance');

  for (const group of groups) {
    // Group total row
    lines.push(
      `${escapeCSV(group.groupName)},TOTAL,${group.totals.budget},${group.totals.actual},${group.totals.variance}`
    );

    // Category rows
    for (const cat of group.categories) {
      lines.push(
        `${escapeCSV(group.groupName)},${escapeCSV(cat.categoryName)},${cat.budgetAmount},${cat.actualAmount},${cat.variance}`
      );
    }
  }

  return lines.join('\n');
}

/**
 * Export budget data to print-ready HTML (the app's print style: ink on
 * paper, mono figures, hairlines; red only for overspend).
 * Rows with no budget and no spending are left out.
 */
export function exportBudgetToPDFHtml(data: ExportData): string {
  const { year, month, groups, savingsRate } = data;
  const period = month ? `${MONTH_NAMES[month - 1]} ${year}` : `${year}`;
  const gbp = (n: number) => formatGBP(n);

  const left = (budget: number, actual: number, isIncome: boolean): { text: string; cls: string } => {
    const diff = budget - actual;
    if (isIncome) {
      if (diff > 0) return { text: `${gbp(diff)} to come`, cls: 'muted' };
      if (diff < 0) return { text: `${gbp(-diff)} more`, cls: 'in' };
      return { text: 'as planned', cls: 'muted' };
    }
    if (budget === 0) return actual > 0 ? { text: 'no budget set', cls: 'bad' } : { text: '', cls: 'muted' };
    if (diff > 0) return { text: `${gbp(diff)} left`, cls: 'muted' };
    if (diff < 0) return { text: `${gbp(-diff)} over`, cls: 'bad' };
    return { text: 'on budget', cls: 'muted' };
  };

  const ordered = [...groups.filter((g) => !g.isIncome), ...groups.filter((g) => g.isIncome)];
  let rows = '';
  for (const group of ordered) {
    const cats = group.categories.filter((c) => c.budgetAmount !== 0 || c.actualAmount !== 0);
    if (cats.length === 0) continue;
    const gl = left(group.totals.budget, group.totals.actual, group.isIncome);
    rows += `
      <tr class="group"><td>${escapeHtml(group.groupName)}${group.isIncome ? ' (income)' : ''}</td><td class="fig">${gbp(group.totals.actual)}</td><td class="fig">${gbp(group.totals.budget)}</td><td class="${gl.cls}">${gl.text}</td></tr>`;
    for (const c of cats) {
      const l = left(c.budgetAmount, c.actualAmount, c.isIncome);
      rows += `
      <tr><td class="cat">${escapeHtml(c.categoryName)}</td><td class="fig">${gbp(c.actualAmount)}</td><td class="fig">${gbp(c.budgetAmount)}</td><td class="${l.cls}">${l.text}</td></tr>`;
    }
  }

  const summary = savingsRate
    ? `<p class="summary">Income <b class="fig">${gbp(savingsRate.totalIncomeActual)}</b> of ${gbp(savingsRate.totalIncomeBudget)}
      &nbsp;&middot;&nbsp; Spending <b class="fig">${gbp(savingsRate.totalExpenseActual)}</b> of ${gbp(savingsRate.totalExpenseBudget)}
      &nbsp;&middot;&nbsp; Saved <b class="fig">${gbp(savingsRate.savingsActual)}</b>
      &nbsp;&middot;&nbsp; Savings rate <b class="fig">${Math.round(savingsRate.savingsRateActual)}%</b> (plan ${Math.round(savingsRate.savingsRateBudget)}%)</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Budget, ${period}</title>
  <style>
    body { font-family: 'Public Sans', system-ui, -apple-system, 'Segoe UI', sans-serif; color: #1c1d1a; padding: 40px; max-width: 820px; margin: 0 auto; font-size: 13.5px; }
    h1 { font-size: 22px; margin: 0 0 4px; font-weight: 600; }
    .fig { font-family: 'IBM Plex Mono', ui-monospace, Menlo, monospace; font-variant-numeric: tabular-nums; }
    .summary { color: #55574f; margin: 0 0 24px; line-height: 1.6; }
    .summary b { color: #1c1d1a; font-weight: 500; }
    table { width: 100%; border-collapse: collapse; border-top: 1.5px solid #1c1d1a; }
    th { text-align: left; font-weight: 500; color: #7a7c73; font-size: 12px; padding: 8px 8px 6px; border-bottom: 1px solid #e3e2dc; }
    th:not(:first-child), td:not(:first-child) { text-align: right; white-space: nowrap; }
    td { padding: 6px 8px; border-bottom: 1px solid #efeee9; }
    tr.group td { font-weight: 600; padding-top: 14px; border-bottom-color: #e3e2dc; }
    td.cat { padding-left: 20px; }
    .muted { color: #7a7c73; }
    .bad { color: #b42318; }
    .in { color: #1f6f43; }
    footer { margin-top: 28px; font-size: 11.5px; color: #7a7c73; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <h1>Budget, ${period}</h1>
  ${summary}
  <table>
    <thead><tr><th>Category</th><th>Spent</th><th>Budget</th><th></th></tr></thead>
    <tbody>${rows}
    </tbody>
  </table>
  <footer>Printed ${new Date().toLocaleDateString('en-GB', { dateStyle: 'long' })} from Hadley Finance Tracker.</footer>
</body>
</html>
`;
}

/**
 * Download CSV file
 */
export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

/**
 * Open the print-ready page in a new window and print it.
 * Returns false when the window could not be opened (e.g. a pop-up blocker).
 */
export function printPDF(htmlContent: string): boolean {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return false;
  printWindow.document.write(htmlContent);
  printWindow.document.close();
  // Wait for content to load then print
  printWindow.onload = () => {
    printWindow.print();
  };
  return true;
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
