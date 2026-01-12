'use client';

import { useState } from 'react';
import type { BudgetGroupComparison } from '@/lib/types/budget';
import { formatBudgetCurrency, getVarianceColorClass } from '@/lib/types/budget';

interface BudgetGroupTableProps {
  groups: BudgetGroupComparison[];
  isLoading: boolean;
  onEditCategory?: (categoryId: string) => void;
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-4 py-3"><div className="h-4 bg-slate-200 rounded w-32"></div></td>
      <td className="px-4 py-3 text-right"><div className="h-4 bg-slate-200 rounded w-20 ml-auto"></div></td>
      <td className="px-4 py-3 text-right"><div className="h-4 bg-slate-200 rounded w-20 ml-auto"></div></td>
      <td className="px-4 py-3 text-right"><div className="h-4 bg-slate-200 rounded w-16 ml-auto"></div></td>
    </tr>
  );
}

interface GroupRowProps {
  group: BudgetGroupComparison;
  onEditCategory?: (categoryId: string) => void;
  indentLevel?: number;
}

function GroupRow({ group, onEditCategory, indentLevel = 0 }: GroupRowProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const paddingLeft = indentLevel === 0 ? 'pl-8' : 'pl-4';

  return (
    <>
      {/* Group Header */}
      <tr
        className="bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <td className={`px-4 py-3 font-medium text-slate-900 ${paddingLeft}`}>
          <div className="flex items-center gap-2">
            <svg
              className={`w-4 h-4 text-slate-500 transition-transform ${
                isExpanded ? 'rotate-90' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
            {group.groupName}
          </div>
        </td>
        <td className="px-4 py-3 text-right font-medium text-slate-900">
          {formatBudgetCurrency(group.totals.budget)}
        </td>
        <td className="px-4 py-3 text-right font-medium text-slate-900">
          {formatBudgetCurrency(group.totals.actual)}
        </td>
        <td
          className={`px-4 py-3 text-right font-medium ${getVarianceColorClass(
            group.totals.variance,
            group.isIncome
          )}`}
        >
          {group.totals.variance >= 0 ? '+' : ''}
          {formatBudgetCurrency(group.totals.variance)}
        </td>
      </tr>

      {/* Category Rows */}
      {isExpanded &&
        group.categories.map((category) => (
          <tr
            key={category.categoryId}
            className="hover:bg-slate-50 transition-colors group"
          >
            <td className={`px-4 py-2 text-slate-700 ${indentLevel === 0 ? 'pl-14' : 'pl-10'}`}>
              <div className="flex items-center justify-between">
                <span>{category.categoryName}</span>
                {onEditCategory && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditCategory(category.categoryId);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-slate-600 transition-opacity"
                    aria-label="Edit budget"
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
                        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                      />
                    </svg>
                  </button>
                )}
              </div>
            </td>
            <td className="px-4 py-2 text-right text-slate-600">
              {formatBudgetCurrency(category.budgetAmount)}
            </td>
            <td className="px-4 py-2 text-right text-slate-600">
              {formatBudgetCurrency(category.actualAmount)}
            </td>
            <td
              className={`px-4 py-2 text-right ${getVarianceColorClass(
                category.variance,
                category.isIncome
              )}`}
            >
              {category.variance >= 0 ? '+' : ''}
              {formatBudgetCurrency(category.variance)}
            </td>
          </tr>
        ))}
    </>
  );
}

interface SectionRowProps {
  title: string;
  isIncome: boolean;
  groups: BudgetGroupComparison[];
  totals: { budget: number; actual: number; variance: number };
  onEditCategory?: (categoryId: string) => void;
}

function SectionRow({ title, isIncome, groups, totals, onEditCategory }: SectionRowProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <>
      {/* Section Header */}
      <tr
        className="bg-slate-100 cursor-pointer hover:bg-slate-200 transition-colors border-b-2 border-slate-300"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <td className="px-4 py-3 font-semibold text-slate-900">
          <div className="flex items-center gap-2">
            <svg
              className={`w-5 h-5 text-slate-600 transition-transform ${
                isExpanded ? 'rotate-90' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
            {title}
          </div>
        </td>
        <td className="px-4 py-3 text-right font-semibold text-slate-900">
          {formatBudgetCurrency(totals.budget)}
        </td>
        <td className="px-4 py-3 text-right font-semibold text-slate-900">
          {formatBudgetCurrency(totals.actual)}
        </td>
        <td className={`px-4 py-3 text-right font-semibold ${getVarianceColorClass(totals.variance, isIncome)}`}>
          {totals.variance >= 0 ? '+' : ''}{formatBudgetCurrency(totals.variance)}
        </td>
      </tr>

      {/* Group Rows */}
      {isExpanded &&
        groups.map((group) => (
          <GroupRow
            key={group.groupName}
            group={group}
            onEditCategory={onEditCategory}
            indentLevel={1}
          />
        ))}
    </>
  );
}

export function BudgetGroupTable({
  groups,
  isLoading,
  onEditCategory,
}: BudgetGroupTableProps) {
  // Calculate rollup totals
  const incomeGroups = groups.filter((g) => g.isIncome);
  const expenseGroups = groups.filter((g) => !g.isIncome);

  const incomeTotals = {
    budget: incomeGroups.reduce((sum, g) => sum + g.totals.budget, 0),
    actual: incomeGroups.reduce((sum, g) => sum + g.totals.actual, 0),
    variance: incomeGroups.reduce((sum, g) => sum + g.totals.variance, 0),
  };

  const expenseTotals = {
    budget: expenseGroups.reduce((sum, g) => sum + g.totals.budget, 0),
    actual: expenseGroups.reduce((sum, g) => sum + g.totals.actual, 0),
    variance: expenseGroups.reduce((sum, g) => sum + g.totals.variance, 0),
  };

  const netTotals = {
    budget: incomeTotals.budget - expenseTotals.budget,
    actual: incomeTotals.actual - expenseTotals.actual,
    variance: (incomeTotals.actual - expenseTotals.actual) - (incomeTotals.budget - expenseTotals.budget),
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">
                Category
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-slate-600">
                Budget
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-slate-600">
                Actual
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-slate-600">
                Variance
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {[1, 2, 3, 4, 5].map((i) => (
              <SkeletonRow key={i} />
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
        <p className="text-slate-500">No budget data available for this period.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <table className="w-full">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-medium text-slate-600">
              Category
            </th>
            <th className="px-4 py-3 text-right text-sm font-medium text-slate-600">
              Budget
            </th>
            <th className="px-4 py-3 text-right text-sm font-medium text-slate-600">
              Actual
            </th>
            <th className="px-4 py-3 text-right text-sm font-medium text-slate-600">
              Variance
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {/* Income Section - collapsible with groups underneath */}
          <SectionRow
            title="All Income"
            isIncome={true}
            groups={incomeGroups}
            totals={incomeTotals}
            onEditCategory={onEditCategory}
          />

          {/* Spacer row */}
          <tr className="h-2 bg-white border-none"></tr>

          {/* Expenses Section - collapsible with groups underneath */}
          <SectionRow
            title="All Expenses"
            isIncome={false}
            groups={expenseGroups}
            totals={expenseTotals}
            onEditCategory={onEditCategory}
          />

          {/* Spacer row */}
          <tr className="h-2 bg-white border-none"></tr>

          {/* Net Total at the bottom */}
          <tr className="bg-slate-200 border-t-2 border-slate-400">
            <td className="px-4 py-3 font-bold text-slate-900">
              Net (Income - Expenses)
            </td>
            <td className="px-4 py-3 text-right font-bold text-slate-900">
              {formatBudgetCurrency(netTotals.budget)}
            </td>
            <td className="px-4 py-3 text-right font-bold text-slate-900">
              {formatBudgetCurrency(netTotals.actual)}
            </td>
            <td className={`px-4 py-3 text-right font-bold ${netTotals.variance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {netTotals.variance >= 0 ? '+' : ''}{formatBudgetCurrency(netTotals.variance)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
