'use client';

import { Fragment } from 'react';
import { formatGBP, MONTH_SHORT } from '@/lib/format';
import { diffWords, type YearGroup, type YearLine, type YearRow, type YearTable } from '@/lib/budgets/year-table';
import { BudgetAmount } from './BudgetAmount';

interface BudgetYearTableProps {
  table: YearTable;
  year: number;
  /** Open the detail panel for a category. */
  onOpenLine: (row: YearRow) => void;
  /** Open the 12-month editor for a category. */
  onEditYear?: (row: YearRow) => void;
}

const TONE = { muted: 'text-ink-3', bad: 'text-bad', warn: 'text-warn', in: 'text-in' } as const;
const fmt = (n: number) => formatGBP(n);

function Diff({ line, kind }: { line: YearLine; kind: 'spending' | 'income' | 'net' }) {
  const w = diffWords(line.diff, kind, fmt);
  return <span className={`fig whitespace-nowrap ${TONE[w.tone]}`}>{w.text}</span>;
}

const num = 'px-3 py-2 text-right fig whitespace-nowrap';

/**
 * Year view: budget to date vs actual per category, grouped, with money in,
 * spending and net totals. Desktop is a table; phones get stacked rows.
 */
export function BudgetYearTable({ table, year, onOpenLine, onEditYear }: BudgetYearTableProps) {
  const partial = table.monthsToDate < 12;
  const toDateLabel = partial ? `Budget Jan–${MONTH_SHORT[table.monthsToDate - 1]}` : 'Budget';
  const sections: { title: string; kind: 'income' | 'spending'; groups: YearGroup[]; total: YearLine }[] = [
    { title: 'Money in', kind: 'income', groups: table.income, total: table.totals.income },
    { title: 'Spending', kind: 'spending', groups: table.spending, total: table.totals.spending },
  ];

  const nameButton = (r: YearRow) => (
    <button
      type="button"
      onClick={() => onOpenLine(r)}
      className="min-w-0 truncate text-left text-ink underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-accent"
      title={`${r.name}: details for ${year}`}
    >
      {r.name}
    </button>
  );

  const yearFigure = (r: YearRow) =>
    onEditYear ? (
      <BudgetAmount amount={r.budgetYear} name={r.name} periodWords={String(year)} onOpen={() => onEditYear(r)} />
    ) : (
      <span className="fig">{fmt(r.budgetYear)}</span>
    );

  return (
    <div className="grid gap-6">
      {/* Desktop table */}
      <table className="hidden w-full border-collapse text-[13.5px] md:table" data-testid="budget-year-table">
        <caption className="sr-only">
          Budget vs actual for {year}
          {partial ? `, budget counted to the end of ${MONTH_SHORT[table.monthsToDate - 1]}` : ''}
        </caption>
        <thead>
          <tr className="border-b border-line text-[12px] text-ink-3">
            <th scope="col" className="py-2 pr-3 text-left font-medium">Category</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">{toDateLabel}</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Actual</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Difference</th>
            <th scope="col" className="py-2 pl-3 text-right font-medium">Full year</th>
          </tr>
        </thead>
        {sections.map((s) =>
          s.groups.length === 0 ? null : (
            <tbody key={s.title}>
              <tr>
                <th colSpan={5} scope="colgroup" className="border-b-[1.5px] border-ink pb-1.5 pt-5 text-left text-[13px] font-semibold text-ink">
                  {s.title}
                </th>
              </tr>
              {s.groups.map((g) => (
                <Fragment key={g.name}>
                  {s.groups.length > 1 && (
                    <tr className="bg-sunk text-[12.5px] text-ink-2">
                      <th scope="rowgroup" className="py-1.5 pl-2 pr-3 text-left font-semibold">{g.name}</th>
                      <td className={num.replace('py-2', 'py-1.5')}>{fmt(g.budgetToDate)}</td>
                      <td className={num.replace('py-2', 'py-1.5')}>{fmt(g.actual)}</td>
                      <td className={`${num.replace('py-2', 'py-1.5')}`}><Diff line={g} kind={s.kind} /></td>
                      <td className="fig whitespace-nowrap py-1.5 pl-3 text-right">{fmt(g.budgetYear)}</td>
                    </tr>
                  )}
                  {g.rows.map((r) => (
                    <tr key={r.categoryId} data-testid="year-row" className="border-b border-line-2 hover:bg-sunk">
                      <th scope="row" className="max-w-0 py-2 pl-4 pr-3 text-left font-normal">
                        <span className="flex min-w-0">{nameButton(r)}</span>
                      </th>
                      <td className={`${num} text-ink-2`}>{fmt(r.budgetToDate)}</td>
                      <td className={`${num} ${r.isIncome ? 'text-in' : 'text-ink'}`}>{fmt(r.actual)}</td>
                      <td className={num}><Diff line={r} kind={s.kind} /></td>
                      <td className="whitespace-nowrap py-2 pl-3 text-right text-ink-2">{yearFigure(r)}</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
              <tr className="font-semibold">
                <th scope="row" className="py-2 pr-3 text-left">Total {s.title.toLowerCase()}</th>
                <td className={num}>{fmt(s.total.budgetToDate)}</td>
                <td className={`${num} ${s.kind === 'income' ? 'text-in' : 'text-ink'}`}>{fmt(s.total.actual)}</td>
                <td className={num}><Diff line={s.total} kind={s.kind} /></td>
                <td className="fig whitespace-nowrap py-2 pl-3 text-right">{fmt(s.total.budgetYear)}</td>
              </tr>
            </tbody>
          )
        )}
        <tbody>
          <tr className="border-t-[1.5px] border-ink font-semibold">
            <th scope="row" className="py-2.5 pr-3 text-left">Left over (money in minus spending)</th>
            <td className={num}>{fmt(table.totals.net.budgetToDate)}</td>
            <td className={num}>{fmt(table.totals.net.actual)}</td>
            <td className={num}><Diff line={table.totals.net} kind="net" /></td>
            <td className="fig whitespace-nowrap py-2.5 pl-3 text-right">{fmt(table.totals.net.budgetYear)}</td>
          </tr>
        </tbody>
      </table>

      {/* Phone: stacked rows */}
      <div className="grid gap-6 md:hidden">
        {sections.map((s) =>
          s.groups.length === 0 ? null : (
            <section key={s.title} className="grid gap-1" aria-label={s.title}>
              <h3 className="flex items-baseline justify-between border-t-[1.5px] border-ink pt-2 text-[13.5px] font-semibold text-ink">
                {s.title}
                <span className="text-[12.5px] font-normal">
                  <span className="fig">{fmt(s.total.actual)}</span> <span className="text-ink-3">of</span> <span className="fig">{fmt(s.total.budgetToDate)}</span>
                </span>
              </h3>
              <ul role="list" className="divide-y divide-line-2">
                {s.groups.flatMap((g) => g.rows).map((r) => (
                  <li key={r.categoryId} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 py-2 text-[13.5px]">
                    <span className="flex min-w-0">{nameButton(r)}</span>
                    <span className="fig whitespace-nowrap text-right">
                      {fmt(r.actual)} <span className="text-ink-3">/ {fmt(r.budgetToDate)}</span>
                    </span>
                    <span className="text-[12px] text-ink-3">Full year {fmt(r.budgetYear)}</span>
                    <span className="text-right text-[12.5px]"><Diff line={r} kind={s.kind} /></span>
                  </li>
                ))}
              </ul>
            </section>
          )
        )}
        <p className="flex items-baseline justify-between border-t-[1.5px] border-ink pt-2 text-[13.5px] font-semibold">
          Left over
          <span className="text-right">
            <span className="fig">{fmt(table.totals.net.actual)}</span>{' '}
            <span className="text-[12.5px] font-normal"><Diff line={table.totals.net} kind="net" /></span>
          </span>
        </p>
      </div>
    </div>
  );
}
