/**
 * Monthly Finance Report — Standalone HTML Generator.
 *
 * Produces a self-contained HTML dashboard with Chart.js charts,
 * dark/light mode, and print-optimised CSS for PDF export.
 */

import type { MonthlyReportData, Takeaway } from './types';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtCurrency(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) return `£${(amount / 1_000_000).toFixed(2)}m`;
  if (abs >= 1_000) return `£${(amount / 1_000).toFixed(1)}k`;
  return `£${amount.toFixed(0)}`;
}

function fmtCurrencyFull(amount: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function fmtPct(value: number, showSign = true): string {
  const sign = showSign && value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

function deltaArrow(value: number): string {
  if (value > 0) return '↑';
  if (value < 0) return '↓';
  return '→';
}

function tagColour(tag: string): { bg: string; text: string } {
  switch (tag) {
    case 'over budget':
    case 'watch':
      return { bg: '#fef3c7', text: '#92400e' };
    case 'strong':
      return { bg: '#d1fae5', text: '#065f46' };
    case 'idea':
    case 'blue sky':
    case 'investment':
      return { bg: '#dbeafe', text: '#1e40af' };
    case 'budget':
      return { bg: '#fce7f3', text: '#9d174d' };
    default:
      return { bg: '#f3f4f6', text: '#374151' };
  }
}

/**
 * Generate a self-contained HTML monthly finance report.
 */
export function generateMonthlyReportHtml(data: MonthlyReportData): string {
  const title = `${data.monthName} ${data.year} — Monthly Financial Report`;
  const generated = new Date(data.generatedAt).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Prepare chart data
  const netWorthDates = JSON.stringify(data.netWorthHistory.map((h) => h.date));
  const netWorthValues = JSON.stringify(data.netWorthHistory.map((h) => h.total));

  const wealthLabels = JSON.stringify(data.wealthBreakdown.map((w) => w.label));
  const wealthValues = JSON.stringify(data.wealthBreakdown.map((w) => w.total));

  const trendLabels = JSON.stringify(data.monthlyTrend.map((t) => t.monthLabel));
  const trendIncome = JSON.stringify(data.monthlyTrend.map((t) => t.income));
  const trendExpenses = JSON.stringify(data.monthlyTrend.map((t) => t.expenses));

  // Budget comparisons — top 15 by actual spend
  const topBudget = [...data.budgetComparisons]
    .filter((c) => c.actual > 0 || c.budget > 0)
    .sort((a, b) => b.actual - a.actual)
    .slice(0, 15);
  const budgetLabels = JSON.stringify(topBudget.map((c) => c.categoryName));
  const budgetActual = JSON.stringify(topBudget.map((c) => c.actual));
  const budgetBudgeted = JSON.stringify(topBudget.map((c) => c.budget));

  // Over-budget categories
  const overBudget = data.budgetComparisons
    .filter((c) => c.budget > 0 && c.actual > c.budget)
    .sort((a, b) => (b.actual - b.budget) - (a.actual - a.budget))
    .slice(0, 10);

  // Prior month deltas
  const prior = data.priorMonth;
  const nwDelta = prior ? data.netWorth - prior.netWorth : data.netWorthChange;
  const nwDeltaPct = prior && prior.netWorth > 0 ? (nwDelta / prior.netWorth) * 100 : (prior ? data.netWorthChangePct : null);
  const hasPriorMonth = prior !== null && prior !== undefined;

  // Budget totals — only include categories that actually have a budget set
  const budgetedCategories = data.budgetComparisons.filter((c) => c.budget > 0);
  const totalBudget = budgetedCategories.reduce((sum, c) => sum + c.budget, 0);
  const totalActual = budgetedCategories.reduce((sum, c) => sum + c.actual, 0);
  const budgetVariance = totalActual - totalBudget;
  const budgetVariancePct = totalBudget > 0 ? (budgetVariance / totalBudget) * 100 : 0;

  // Donut colours
  const donutColours = [
    '#6366f1', '#f59e0b', '#10b981', '#ef4444',
    '#8b5cf6', '#3b82f6', '#ec4899', '#14b8a6',
  ];

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"><\/script>
<style>
  :root {
    --bg: #ffffff; --bg2: #f9fafb; --bg3: #f3f4f6;
    --text: #111827; --text2: #4b5563; --text3: #9ca3af;
    --border: #e5e7eb; --accent: #6366f1;
    --green: #059669; --red: #dc2626; --amber: #d97706;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #111827; --bg2: #1f2937; --bg3: #374151;
      --text: #f9fafb; --text2: #d1d5db; --text3: #6b7280;
      --border: #374151; --accent: #818cf8;
      --green: #34d399; --red: #f87171; --amber: #fbbf24;
    }
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: var(--bg); color: var(--text);
    line-height: 1.5; max-width: 1200px; margin: 0 auto; padding: 24px;
  }
  h1 { font-size: 1.75rem; font-weight: 700; }
  h2 { font-size: 1.25rem; font-weight: 600; margin-bottom: 12px; color: var(--text); }
  .subtitle { color: var(--text3); font-size: 0.875rem; margin-top: 4px; }

  /* Header */
  .header { text-align: center; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 1px solid var(--border); }

  /* Metric Cards */
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 32px; }
  .card {
    background: var(--bg2); border: 1px solid var(--border); border-radius: 12px;
    padding: 20px; text-align: center;
  }
  .card-label { font-size: 0.8rem; color: var(--text3); text-transform: uppercase; letter-spacing: 0.05em; }
  .card-value { font-size: 1.75rem; font-weight: 700; margin: 4px 0; }
  .card-delta { font-size: 0.85rem; }
  .card-delta.positive { color: var(--green); }
  .card-delta.negative { color: var(--red); }

  /* Sections */
  .section { margin-bottom: 36px; }
  .chart-container { background: var(--bg2); border: 1px solid var(--border); border-radius: 12px; padding: 20px; }
  .chart-container canvas { max-height: 350px; }

  /* Two-column grid */
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
  @media (max-width: 768px) { .grid-2 { grid-template-columns: 1fr; } }

  /* Budget table */
  .budget-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
  .budget-table th { text-align: left; padding: 8px 12px; border-bottom: 2px solid var(--border); color: var(--text2); font-weight: 600; }
  .budget-table td { padding: 8px 12px; border-bottom: 1px solid var(--border); }
  .budget-table tr:hover { background: var(--bg3); }
  .over { color: var(--red); font-weight: 600; }
  .under { color: var(--green); }

  /* FIRE bars */
  .fire-bar-container { margin-bottom: 16px; }
  .fire-bar-label { display: flex; justify-content: space-between; font-size: 0.875rem; margin-bottom: 4px; }
  .fire-bar-track { height: 28px; background: var(--bg3); border-radius: 14px; overflow: hidden; position: relative; }
  .fire-bar-fill { height: 100%; border-radius: 14px; background: var(--accent); transition: width 0.5s; display: flex; align-items: center; justify-content: flex-end; padding-right: 8px; }
  .fire-bar-pct { font-size: 0.75rem; font-weight: 700; color: white; }

  /* Takeaways */
  .takeaway { background: var(--bg2); border: 1px solid var(--border); border-radius: 10px; padding: 16px; margin-bottom: 12px; }
  .takeaway-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
  .pill { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; }
  .takeaway-title { font-weight: 600; font-size: 0.95rem; }
  .takeaway-body { color: var(--text2); font-size: 0.875rem; }

  /* Print */
  @media print {
    body { max-width: 100%; padding: 12px; }
    .card, .chart-container, .takeaway { break-inside: avoid; }
    .section { page-break-inside: avoid; }
  }
</style>
</head>
<body>

<!-- 1. Header -->
<div class="header">
  <h1>${esc(title)}</h1>
  <div class="subtitle">Generated ${esc(generated)}</div>
</div>

<!-- 2. Metric Cards -->
<div class="cards">
  <div class="card">
    <div class="card-label">Net Worth</div>
    <div class="card-value">${esc(fmtCurrency(data.netWorth))}</div>
    ${hasPriorMonth && nwDeltaPct !== null ? `<div class="card-delta ${nwDelta >= 0 ? 'positive' : 'negative'}">${deltaArrow(nwDelta)} ${esc(fmtCurrency(Math.abs(nwDelta)))} (${esc(fmtPct(nwDeltaPct))})</div>` : ''}
  </div>
  <div class="card">
    <div class="card-label">Income</div>
    <div class="card-value">${esc(fmtCurrency(data.income))}</div>
    ${prior ? `<div class="card-delta ${data.income >= prior.income ? 'positive' : 'negative'}">${deltaArrow(data.income - prior.income)} vs ${esc(fmtCurrency(prior.income))} last month</div>` : ''}
  </div>
  <div class="card">
    <div class="card-label">Spending (Budgeted)</div>
    <div class="card-value">${esc(fmtCurrency(totalActual))}</div>
    ${totalBudget > 0 ? `<div class="card-delta ${budgetVariance <= 0 ? 'positive' : 'negative'}">vs ${esc(fmtCurrency(totalBudget))} budget · ${budgetVariance <= 0 ? 'Under' : 'Over'} by ${esc(fmtCurrency(Math.abs(budgetVariance)))}</div>` : ''}
  </div>
  <div class="card">
    <div class="card-label">Savings Rate</div>
    <div class="card-value">${data.savingsRate.toFixed(1)}%</div>
    ${prior ? `<div class="card-delta ${data.savingsRate >= prior.savingsRate ? 'positive' : 'negative'}">${esc(fmtPct(data.savingsRate - prior.savingsRate))} vs last month</div>` : ''}
  </div>
</div>

<!-- 3. Net Worth Trend -->
<div class="section">
  <h2>Net Worth Trend</h2>
  <div class="chart-container">
    <canvas id="netWorthChart"></canvas>
  </div>
</div>

<!-- 4 + 5. Wealth Composition & Budget Overview -->
<div class="section grid-2">
  <div>
    <h2>Wealth Composition</h2>
    <div class="chart-container">
      <canvas id="wealthDonut"></canvas>
    </div>
  </div>
  <div>
    <h2>Budget vs Actual (Top 15)</h2>
    <div class="chart-container">
      <canvas id="budgetChart"></canvas>
    </div>
  </div>
</div>

<!-- 6. Income vs Spending Trend -->
<div class="section">
  <h2>Income vs Spending Trend</h2>
  <div class="chart-container">
    <canvas id="trendChart"></canvas>
  </div>
</div>

<!-- Over Budget Table -->
${overBudget.length > 0 ? `
<div class="section">
  <h2>Over Budget Categories</h2>
  <div class="chart-container" style="padding: 0;">
    <table class="budget-table">
      <thead><tr><th>Category</th><th>Budget</th><th>Actual</th><th>Over By</th><th>%</th></tr></thead>
      <tbody>
        ${overBudget.map((c) => `<tr>
          <td>${esc(c.categoryName)}</td>
          <td>${esc(fmtCurrencyFull(c.budget))}</td>
          <td class="over">${esc(fmtCurrencyFull(c.actual))}</td>
          <td class="over">${esc(fmtCurrencyFull(c.actual - c.budget))}</td>
          <td class="over">${((c.actual / c.budget - 1) * 100).toFixed(0)}%</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>
</div>
` : ''}

<!-- 7. FIRE Progress -->
${data.fireScenarios.length > 0 ? `
<div class="section">
  <h2>FIRE Progress</h2>
  <div class="chart-container">
    <div style="margin-bottom: 8px; font-size: 0.875rem; color: var(--text2);">
      Portfolio (ex-property): ${esc(fmtCurrencyFull(data.firePortfolio))}
    </div>
    ${data.fireScenarios.map((s) => {
      const pct = Math.min(s.progressPct, 100);
      const colour = s.progressPct >= 100 ? 'var(--green)' : s.progressPct >= 75 ? 'var(--accent)' : 'var(--amber)';
      const remaining = s.targetAmount - data.firePortfolio;
      return `<div class="fire-bar-container">
        <div class="fire-bar-label">
          <span><strong>${esc(s.name)}</strong> <span style="color:var(--text3);font-size:0.8rem">${esc(fmtCurrencyFull(s.annualSpend))}/yr @ ${s.withdrawalRate}% WR</span></span>
          <span>Target: ${esc(fmtCurrencyFull(s.targetAmount))}</span>
        </div>
        <div class="fire-bar-track">
          <div class="fire-bar-fill" style="width:${pct.toFixed(1)}%;background:${colour}">
            <span class="fire-bar-pct">${s.progressPct.toFixed(0)}%</span>
          </div>
        </div>
        <div style="font-size:0.75rem;color:var(--text3);margin-top:2px;text-align:right">
          ${s.progressPct >= 100 ? 'Target reached' : `${esc(fmtCurrencyFull(remaining))} remaining`}
        </div>
      </div>`;
    }).join('')}
  </div>
</div>
` : ''}

<!-- 8. Key Takeaways -->
${data.takeaways.length > 0 ? `
<div class="section">
  <h2>Key Takeaways</h2>
  ${data.takeaways.map((t: Takeaway) => renderTakeaway(t)).join('')}
</div>
` : ''}

<!-- 9. Ideas -->
${data.ideas.length > 0 ? `
<div class="section">
  <h2>Ideas &amp; Suggestions</h2>
  ${data.ideas.map((t: Takeaway) => renderTakeaway(t)).join('')}
</div>
` : ''}

<script>
const fmt = (v) => '£' + (Math.abs(v) >= 1e6 ? (v/1e6).toFixed(2)+'m' : Math.abs(v) >= 1e3 ? (v/1e3).toFixed(1)+'k' : v.toFixed(0));

// Net Worth Trend
new Chart(document.getElementById('netWorthChart'), {
  type: 'line',
  data: {
    labels: ${netWorthDates},
    datasets: [{
      label: 'Net Worth',
      data: ${netWorthValues},
      borderColor: '#6366f1',
      backgroundColor: 'rgba(99,102,241,0.1)',
      fill: true,
      tension: 0.3,
      pointRadius: 2,
    }]
  },
  options: {
    responsive: true,
    plugins: {
      tooltip: { callbacks: { label: (c) => fmt(c.parsed.y) } },
      legend: { display: false },
    },
    scales: {
      y: { ticks: { callback: (v) => fmt(v) } },
      x: { ticks: { maxTicksLimit: 12 } },
    },
  }
});

// Wealth Donut
new Chart(document.getElementById('wealthDonut'), {
  type: 'doughnut',
  data: {
    labels: ${wealthLabels},
    datasets: [{
      data: ${wealthValues},
      backgroundColor: ${JSON.stringify(donutColours.slice(0, data.wealthBreakdown.length))},
      borderWidth: 0,
    }]
  },
  options: {
    responsive: true,
    plugins: {
      tooltip: { callbacks: { label: (c) => c.label + ': ' + fmt(c.parsed) } },
      legend: { position: 'bottom' },
    },
  }
});

// Budget vs Actual
new Chart(document.getElementById('budgetChart'), {
  type: 'bar',
  data: {
    labels: ${budgetLabels},
    datasets: [
      { label: 'Budget', data: ${budgetBudgeted}, backgroundColor: 'rgba(99,102,241,0.3)', borderColor: '#6366f1', borderWidth: 1 },
      { label: 'Actual', data: ${budgetActual}, backgroundColor: 'rgba(239,68,68,0.3)', borderColor: '#ef4444', borderWidth: 1 },
    ]
  },
  options: {
    indexAxis: 'y',
    responsive: true,
    plugins: {
      tooltip: { callbacks: { label: (c) => c.dataset.label + ': ' + fmt(c.parsed.x) } },
      legend: { position: 'top' },
    },
    scales: {
      x: { ticks: { callback: (v) => fmt(v) } },
    },
  }
});

// Income vs Spending Trend
new Chart(document.getElementById('trendChart'), {
  type: 'bar',
  data: {
    labels: ${trendLabels},
    datasets: [
      { label: 'Income', data: ${trendIncome}, backgroundColor: 'rgba(16,185,129,0.6)', borderColor: '#10b981', borderWidth: 1 },
      { label: 'Spending', data: ${trendExpenses}, backgroundColor: 'rgba(239,68,68,0.4)', borderColor: '#ef4444', borderWidth: 1 },
    ]
  },
  options: {
    responsive: true,
    plugins: {
      tooltip: { callbacks: { label: (c) => c.dataset.label + ': ' + fmt(c.parsed.y) } },
      legend: { position: 'top' },
    },
    scales: {
      y: { ticks: { callback: (v) => fmt(v) } },
    },
  }
});
<\/script>

</body>
</html>`;
}

function renderTakeaway(t: Takeaway): string {
  const { bg, text } = tagColour(t.tag);
  return `<div class="takeaway">
    <div class="takeaway-header">
      <span class="pill" style="background:${bg};color:${text}">${esc(t.tag)}</span>
      <span class="takeaway-title">${esc(t.title)}</span>
    </div>
    <div class="takeaway-body">${esc(t.body)}</div>
  </div>`;
}
