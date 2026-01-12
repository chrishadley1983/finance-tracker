import type { BudgetGroupComparison, SavingsRate } from '@/lib/types/budget';
import { MONTH_NAMES } from '@/lib/types/budget';

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
 * Export budget data to PDF-ready HTML format
 * Returns HTML that can be used with window.print() or a PDF library
 */
export function exportBudgetToPDFHtml(data: ExportData): string {
  const { year, month, groups, savingsRate } = data;
  const period = month ? `${MONTH_NAMES[month - 1]} ${year}` : `${year}`;

  const formatCurrency = (amount: number): string => {
    const absAmount = Math.abs(amount);
    const formatted = new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(absAmount);
    return amount < 0 ? `-${formatted}` : formatted;
  };

  const getVarianceColor = (variance: number, isIncome: boolean): string => {
    if (variance === 0) return '#64748b';
    if (isIncome) {
      return variance > 0 ? '#059669' : '#dc2626';
    } else {
      return variance > 0 ? '#059669' : '#dc2626';
    }
  };

  let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Budget Report - ${period}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #1e293b;
      padding: 40px;
      max-width: 800px;
      margin: 0 auto;
    }
    h1 { font-size: 24px; margin-bottom: 8px; }
    h2 { font-size: 18px; margin-top: 24px; margin-bottom: 12px; color: #475569; }
    .period { color: #64748b; font-size: 14px; margin-bottom: 24px; }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 32px;
    }
    .summary-card {
      background: #f8fafc;
      border-radius: 8px;
      padding: 16px;
    }
    .summary-card-label {
      font-size: 12px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .summary-card-value {
      font-size: 20px;
      font-weight: 600;
      margin-top: 4px;
    }
    .summary-card-subtitle {
      font-size: 12px;
      margin-top: 4px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    th {
      text-align: left;
      padding: 8px 12px;
      background: #f1f5f9;
      font-weight: 500;
      color: #475569;
    }
    th:not(:first-child) { text-align: right; }
    td {
      padding: 8px 12px;
      border-bottom: 1px solid #e2e8f0;
    }
    td:not(:first-child) { text-align: right; }
    .group-row {
      background: #f8fafc;
      font-weight: 600;
    }
    .category-row td:first-child {
      padding-left: 32px;
    }
    .positive { color: #059669; }
    .negative { color: #dc2626; }
    @media print {
      body { padding: 20px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <h1>Budget Report</h1>
  <div class="period">${period}</div>
`;

  // Summary cards
  if (savingsRate) {
    html += `
  <div class="summary-grid">
    <div class="summary-card">
      <div class="summary-card-label">Income</div>
      <div class="summary-card-value">${formatCurrency(savingsRate.totalIncomeActual)}</div>
      <div class="summary-card-subtitle" style="color: ${savingsRate.totalIncomeActual >= savingsRate.totalIncomeBudget ? '#059669' : '#dc2626'}">
        vs ${formatCurrency(savingsRate.totalIncomeBudget)} budget
      </div>
    </div>
    <div class="summary-card">
      <div class="summary-card-label">Expenses</div>
      <div class="summary-card-value">${formatCurrency(savingsRate.totalExpenseActual)}</div>
      <div class="summary-card-subtitle" style="color: ${savingsRate.totalExpenseActual <= savingsRate.totalExpenseBudget ? '#059669' : '#dc2626'}">
        vs ${formatCurrency(savingsRate.totalExpenseBudget)} budget
      </div>
    </div>
    <div class="summary-card">
      <div class="summary-card-label">Savings</div>
      <div class="summary-card-value">${formatCurrency(savingsRate.savingsActual)}</div>
      <div class="summary-card-subtitle" style="color: ${savingsRate.savingsActual >= savingsRate.savingsBudget ? '#059669' : '#dc2626'}">
        vs ${formatCurrency(savingsRate.savingsBudget)} budget
      </div>
    </div>
    <div class="summary-card">
      <div class="summary-card-label">Savings Rate</div>
      <div class="summary-card-value">${savingsRate.savingsRateActual}%</div>
      <div class="summary-card-subtitle" style="color: ${savingsRate.savingsRateActual >= savingsRate.savingsRateBudget ? '#059669' : '#dc2626'}">
        vs ${savingsRate.savingsRateBudget}% budget
      </div>
    </div>
  </div>
`;
  }

  // Budget table
  html += `
  <h2>Budget vs Actual</h2>
  <table>
    <thead>
      <tr>
        <th>Category</th>
        <th>Budget</th>
        <th>Actual</th>
        <th>Variance</th>
      </tr>
    </thead>
    <tbody>
`;

  for (const group of groups) {
    const groupVarianceColor = getVarianceColor(group.totals.variance, group.isIncome);
    html += `
      <tr class="group-row">
        <td>${escapeHtml(group.groupName)}</td>
        <td>${formatCurrency(group.totals.budget)}</td>
        <td>${formatCurrency(group.totals.actual)}</td>
        <td style="color: ${groupVarianceColor}">${group.totals.variance >= 0 ? '+' : ''}${formatCurrency(group.totals.variance)}</td>
      </tr>
`;

    for (const cat of group.categories) {
      const catVarianceColor = getVarianceColor(cat.variance, cat.isIncome);
      html += `
      <tr class="category-row">
        <td>${escapeHtml(cat.categoryName)}</td>
        <td>${formatCurrency(cat.budgetAmount)}</td>
        <td>${formatCurrency(cat.actualAmount)}</td>
        <td style="color: ${catVarianceColor}">${cat.variance >= 0 ? '+' : ''}${formatCurrency(cat.variance)}</td>
      </tr>
`;
    }
  }

  html += `
    </tbody>
  </table>

  <div style="margin-top: 32px; font-size: 12px; color: #94a3b8;">
    Generated on ${new Date().toLocaleDateString('en-GB', { dateStyle: 'long' })}
  </div>
</body>
</html>
`;

  return html;
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
 * Open PDF in new window for printing
 */
export function printPDF(htmlContent: string): void {
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    // Wait for content to load then print
    printWindow.onload = () => {
      printWindow.print();
    };
  }
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
