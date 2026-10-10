'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { PageIntro } from '@/components/ui/PageIntro';
import { Panel } from '@/components/ui/Panel';
import { Notice, EmptyState, SkeletonRows } from '@/components/ui/Notice';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { formatGBP, MONTH_NAMES } from '@/lib/format';
import { useBudgets } from '@/lib/hooks/useBudgets';
import {
  budgetTotals,
  listNames,
  monthKey,
  periodFromSearchParams,
  periodLabel,
  periodProgress,
  periodToQueryString,
  shiftMonth,
  type BudgetPeriod,
  type PeriodProgress,
  type BudgetTotals,
} from '@/lib/budgets/period';
import type { BudgetComparison, SavingsRate } from '@/lib/types/budget';
import { PeriodNav } from './PeriodNav';
import { BudgetGroups } from './BudgetGroups';
import { BudgetBulkEditDialog, type MonthlyBudget } from './BudgetBulkEditDialog';
import { CopyBudgetDialog } from './CopyBudgetDialog';
import { ExportMenu } from './ExportMenu';
import { BudgetLinePanel, type BudgetLineTarget } from './BudgetLinePanel';
import { BudgetYearTable } from './BudgetYearTable';
import { buildYearTable, type MonthlyBudgets, type YearRow } from '@/lib/budgets/year-table';

async function readError(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => ({}));
  return (body && typeof body.error === 'string' && body.error) || fallback;
}

async function postBudgets(entries: { categoryId: string; year: number; month: number; amount: number }[]) {
  const res = await fetch('/api/budgets/bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entries }),
  });
  if (!res.ok) throw new Error(await readError(res, 'the server did not accept it'));
}

/** "October" for this year's months, "October 2025" otherwise; "2026" in year view. */
function periodWords(p: BudgetPeriod, now: Date): string {
  if (p.view === 'year') return String(p.year);
  return p.year === now.getFullYear() ? MONTH_NAMES[p.month - 1] : `${MONTH_NAMES[p.month - 1]} ${p.year}`;
}

/** The opening sentence: where spending stands, and what is over. */
export function BudgetLede({
  period,
  totals,
  progress,
  now,
  toDate,
}: {
  period: BudgetPeriod;
  totals: BudgetTotals;
  progress: PeriodProgress;
  now: Date;
  /** Year view mid-year: compare with the budget for the months so far. */
  toDate?: { planned: number; over: string[] } | null;
}) {
  const words = periodWords(period, now);
  const midYear = period.view === 'year' && progress.timing === 'current' && toDate;
  const overNames = midYear ? toDate.over : totals.over.map((c) => c.categoryName);
  const many = overNames.length > 1;
  const forYear = period.view === 'year' ? ' for the year' : '';

  if (progress.timing === 'future') {
    return (
      <p>
        <strong className="fig">{formatGBP(totals.planned)}</strong> of spending planned for {words}.
      </p>
    );
  }

  let tail: string;
  if (progress.timing === 'current') {
    const r = progress.remaining ?? 0;
    const unit = period.view === 'year' ? 'month' : 'day';
    tail = r === 0 ? (period.view === 'year' ? ', the last month of the year' : ', the last day of the month') : `, ${r} ${unit}${r === 1 ? '' : 's'} to go`;
  } else {
    tail = '';
  }

  const overSentence =
    overNames.length > 0
      ? ` ${listNames(overNames)} ${progress.timing === 'past' ? (many ? 'were' : 'was') : many ? 'are' : 'is'} over${midYear ? ' budget to date' : forYear}.`
      : progress.timing === 'past'
        ? ' Everything stayed within budget.'
        : ' Nothing is over budget so far.';

  if (midYear) {
    return (
      <p>
        <strong className="fig">{formatGBP(totals.spent)}</strong> spent in {words} so far, against <span className="fig">{formatGBP(toDate.planned)}</span> budgeted to
        date (<span className="fig">{formatGBP(totals.planned)}</span> for the year){tail}.{overSentence}
      </p>
    );
  }

  return (
    <p>
      <strong className="fig">{formatGBP(totals.spent)}</strong> of <span className="fig">{formatGBP(totals.planned)}</span> spent in {words}
      {period.view === 'year' && progress.timing === 'current' ? ' so far' : ''}
      {tail}.{overSentence}
    </p>
  );
}

/** Income, spending, saved and savings rate as one quiet line. */
function SummaryLine({ s }: { s: SavingsRate }) {
  const item = 'flex items-baseline gap-1.5';
  return (
    <dl className="flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-ink-3" aria-label="Summary">
      <div className={item}>
        <dt>Income</dt>
        <dd>
          <span className="fig text-in">{formatGBP(s.totalIncomeActual)}</span> of <span className="fig">{formatGBP(s.totalIncomeBudget)}</span>
        </dd>
      </div>
      <div className={item}>
        <dt>Spending</dt>
        <dd>
          <span className="fig text-ink">{formatGBP(s.totalExpenseActual)}</span> of <span className="fig">{formatGBP(s.totalExpenseBudget)}</span>
        </dd>
      </div>
      <div className={item}>
        <dt>Saved</dt>
        <dd className="fig text-ink">{formatGBP(s.savingsActual)}</dd>
      </div>
      <div className={item}>
        <dt>Savings rate</dt>
        <dd>
          <span className="fig text-ink">{Math.round(s.savingsRateActual)}%</span> (plan <span className="fig">{Math.round(s.savingsRateBudget)}%</span>)
        </dd>
      </div>
    </dl>
  );
}

export function BudgetsView({ now: nowProp }: { now?: Date } = {}) {
  const now = useMemo(() => nowProp ?? new Date(), [nowProp]);
  const router = useRouter();
  const pathname = usePathname() || '/budgets';
  const params = useSearchParams();
  const period = useMemo(() => periodFromSearchParams(params, now), [params, now]);
  const month = period.view === 'month' ? period.month : null;
  const { toast } = useToast();
  const { groups, savingsRate, isLoading, error, refresh, setLocalBudget } = useBudgets(period);

  // ---- Detail panel for one line ---------------------------------------------
  const [line, setLine] = useState<BudgetLineTarget | null>(null);
  const openLine = useCallback(
    (categoryId: string, categoryName: string) => setLine({ categoryId, categoryName, year: period.year, month }),
    [period.year, month]
  );

  // ---- Year view: monthly budgets, for "budget to date" ----------------------
  const [monthly, setMonthly] = useState<MonthlyBudgets | null>(null);
  useEffect(() => {
    if (period.view !== 'year') return;
    let cancelled = false;
    fetch(`/api/budgets/bulk?year=${period.year}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { budgets?: { categoryId: string; months: Record<number, { amount: number }> }[] } | null) => {
        if (cancelled) return;
        if (!data?.budgets) return setMonthly(null);
        const out: MonthlyBudgets = {};
        for (const b of data.budgets) {
          out[b.categoryId] = {};
          for (const [m, v] of Object.entries(b.months ?? {})) out[b.categoryId][Number(m)] = Number(v.amount);
        }
        setMonthly(out);
      })
      .catch(() => !cancelled && setMonthly(null));
    return () => {
      cancelled = true;
    };
    // Re-read after edits (groups change when budgets are saved).
  }, [period.view, period.year, groups]);
  const yearTable = useMemo(
    () => (period.view === 'year' ? buildYearTable(groups, monthly, period.year, now) : null),
    [period.view, period.year, groups, monthly, now]
  );

  const progress = useMemo(() => periodProgress(period, now), [period, now]);
  const totals = useMemo(() => budgetTotals(groups), [groups]);
  const words = periodWords(period, now);
  const hasBudgets = groups.some((g) => g.categories.some((c) => c.budgetAmount > 0));
  const prev = period.view === 'month' ? shiftMonth(period.year, period.month, -1) : null;
  const prevName = prev ? (prev.year === period.year ? MONTH_NAMES[prev.month - 1] : `${MONTH_NAMES[prev.month - 1]} ${prev.year}`) : '';

  const go = useCallback(
    (next: BudgetPeriod) => router.push(`${pathname}?${periodToQueryString(next)}`, { scroll: false }),
    [router, pathname]
  );

  // ---- Inline edit (month view) -------------------------------------------
  const saveAmount = useCallback(
    async (c: BudgetComparison, amount: number) => {
      if (period.view !== 'month') return;
      const before = c.budgetAmount;
      setLocalBudget(c.categoryId, amount);
      try {
        await postBudgets([{ categoryId: c.categoryId, year: period.year, month: period.month, amount }]);
        toast({
          tone: 'success',
          message: `${c.categoryName} budget for ${words} set to ${formatGBP(amount)}.`,
          action: { label: 'Undo', onClick: () => void saveAmount({ ...c, budgetAmount: amount }, before) },
        });
        void refresh({ quiet: true });
      } catch (err) {
        setLocalBudget(c.categoryId, before);
        toast({
          tone: 'error',
          message: `Couldn't save the ${c.categoryName} budget (${err instanceof Error ? err.message : 'unknown error'}). It is back to ${formatGBP(before)}.`,
        });
      }
    },
    [period, setLocalBudget, toast, words, refresh]
  );

  // ---- Year view: 12-month editor ------------------------------------------
  const [bulk, setBulk] = useState<{ category: BudgetComparison; groupName: string; months: MonthlyBudget[] } | null>(null);
  const openYear = useCallback(
    async (category: BudgetComparison, groupName: string) => {
      try {
        const res = await fetch(`/api/budgets/bulk?year=${period.year}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(await readError(res, 'the server did not respond'));
        const data = await res.json();
        const found = (data.budgets ?? []).find((b: { categoryId: string }) => b.categoryId === category.categoryId) as
          | { months: Record<number, { amount: number }> }
          | undefined;
        const months = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, amount: Number(found?.months?.[i + 1]?.amount ?? 0) }));
        setBulk({ category, groupName, months });
      } catch (err) {
        toast({ tone: 'error', message: `Couldn't load the monthly budgets for ${category.categoryName} (${err instanceof Error ? err.message : 'unknown error'}).` });
      }
    },
    [period.year, toast]
  );
  const saveYear = useCallback(
    async (budgets: MonthlyBudget[]) => {
      if (!bulk) return;
      try {
        await postBudgets(budgets.map((b) => ({ categoryId: bulk.category.categoryId, year: period.year, month: b.month, amount: b.amount })));
      } catch (err) {
        throw new Error(`Couldn't save: ${err instanceof Error ? err.message : 'unknown error'}.`);
      }
      toast({ tone: 'success', message: `${bulk.category.categoryName} budgets for ${period.year} saved.` });
      void refresh({ quiet: true });
    },
    [bulk, period.year, toast, refresh]
  );

  // ---- Copy from last month ------------------------------------------------
  const [confirmCopy, setConfirmCopy] = useState(false);
  const [copying, setCopying] = useState(false);
  const copyLastMonth = useCallback(
    async (overwrite = false) => {
      if (period.view !== 'month' || !prev) return;
      if (!overwrite && hasBudgets) {
        setConfirmCopy(true);
        return;
      }
      setCopying(true);
      try {
        const res = await fetch('/api/budgets/copy-month', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: monthKey(prev.year, prev.month), to: monthKey(period.year, period.month), overwrite }),
        });
        if (res.status === 409) {
          setConfirmCopy(true);
          return;
        }
        if (!res.ok) throw new Error(await readError(res, 'the server did not accept it'));
        const data = (await res.json()) as { copied: number; previous: { categoryId: string; amount: number }[] };
        const target = { year: period.year, month: period.month };
        toast({
          tone: 'success',
          message: `Copied ${data.copied} budget${data.copied === 1 ? '' : 's'} from ${prevName}.`,
          action: {
            label: 'Undo',
            onClick: () => {
              postBudgets(data.previous.map((p) => ({ categoryId: p.categoryId, ...target, amount: p.amount })))
                .then(() => refresh({ quiet: true }))
                .catch((err) => toast({ tone: 'error', message: `Couldn't undo the copy (${err instanceof Error ? err.message : 'unknown error'}).` }));
            },
          },
        });
        await refresh({ quiet: true });
      } catch (err) {
        toast({ tone: 'error', message: `Couldn't copy ${prevName}'s budgets: ${err instanceof Error ? err.message : 'unknown error'}.` });
      } finally {
        setCopying(false);
      }
    },
    [period, prev, prevName, hasBudgets, toast, refresh]
  );

  const [copyYearOpen, setCopyYearOpen] = useState(false);

  const copyAction =
    period.view === 'month' ? (
      <Button onClick={() => void copyLastMonth()} loading={copying}>
        Copy from {prevName}
      </Button>
    ) : (
      <Button onClick={() => setCopyYearOpen(true)}>Copy from another year</Button>
    );

  return (
    <div className="grid gap-6 pb-8">
      <PeriodNav period={period} onChange={go} now={now} />

      {error ? (
        <Notice tone="error" action={<Button size="sm" onClick={() => void refresh()}>Try again</Button>}>
          {error}
        </Notice>
      ) : isLoading ? (
        <div className="grid gap-6">
          <SkeletonRows rows={2} />
          <Panel title="Loading budgets">
            <SkeletonRows rows={6} />
          </Panel>
        </div>
      ) : !hasBudgets && totals.spent === 0 && totals.income === 0 ? (
        <Panel variant="boxed">
          <EmptyState
            title={`No budgets set for ${periodLabel(period)} yet`}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {copyAction}
                {period.view === 'month' && <Button onClick={() => setCopyYearOpen(true)}>Copy a whole year</Button>}
              </div>
            }
          >
            {period.view === 'month'
              ? `Start from ${prevName}'s amounts, or copy every month from an earlier year. You can then change any figure by clicking it.`
              : `Copy every month from an earlier year, then adjust any category by clicking its figure.`}
          </EmptyState>
        </Panel>
      ) : (
        <>
          <div className="grid gap-2.5">
            <PageIntro
              actions={
                <>
                  {copyAction}
                  <ExportMenu year={period.year} month={month} groups={groups} savingsRate={savingsRate} />
                </>
              }
            >
              <BudgetLede
                period={period}
                totals={totals}
                progress={progress}
                now={now}
                toDate={
                  yearTable && yearTable.monthsToDate < 12
                    ? {
                        planned: yearTable.totals.spending.budgetToDate,
                        over: yearTable.spending
                          .flatMap((g) => g.rows)
                          .filter((r) => r.budgetToDate > 0 && r.diff >= 0.5)
                          .sort((a, b) => b.diff - a.diff)
                          .map((r) => r.name),
                      }
                    : null
                }
              />
            </PageIntro>
            {savingsRate && <SummaryLine s={savingsRate} />}
          </div>

          {period.view === 'month' ? (
            <BudgetGroups
              groups={groups}
              pace={progress.pace}
              periodWords={words}
              onSaveAmount={(c, n) => void saveAmount(c, n)}
              onOpenLine={(c) => openLine(c.categoryId, c.categoryName)}
            />
          ) : (
            yearTable && (
              <BudgetYearTable
                table={yearTable}
                year={period.year}
                onOpenLine={(r: YearRow) => openLine(r.categoryId, r.name)}
                onEditYear={(r: YearRow) => {
                  const g = groups.find((x) => x.categories.some((c) => c.categoryId === r.categoryId));
                  const c = g?.categories.find((x) => x.categoryId === r.categoryId);
                  if (g && c) void openYear(c, g.groupName);
                }}
              />
            )
          )}
          <p className="text-[12.5px] text-ink-3">
            {period.view === 'month'
              ? 'Click a category for its history and transactions. Click a budget figure to change it: Enter saves, Esc cancels.'
              : `Click a category for its history and transactions. Click a full-year figure to set its twelve monthly amounts.${
                  yearTable && yearTable.monthsToDate < 12
                    ? ` Budget to date counts January to ${MONTH_NAMES[yearTable.monthsToDate - 1]}, so a part-used year compares fairly.`
                    : ''
                }`}
          </p>
        </>
      )}

      <BudgetLinePanel target={line} onClose={() => setLine(null)} />

      {bulk && (
        <BudgetBulkEditDialog
          isOpen
          onClose={() => setBulk(null)}
          onSave={saveYear}
          categoryName={bulk.category.categoryName}
          groupName={bulk.groupName}
          year={period.year}
          currentBudgets={bulk.months}
        />
      )}

      <CopyBudgetDialog
        isOpen={copyYearOpen}
        onClose={() => setCopyYearOpen(false)}
        onSuccess={(message) => {
          toast({ tone: 'success', message });
          void refresh({ quiet: true });
        }}
        targetYear={period.year}
      />

      <ConfirmDialog
        isOpen={confirmCopy}
        title={`Replace ${words}'s budgets?`}
        message={`${words} already has budgets. Copying from ${prevName} replaces every category that ${prevName} has a budget for. Categories ${prevName} has no budget for keep their current amounts. You can undo straight after.`}
        confirmLabel={`Copy from ${prevName}`}
        variant="warning"
        onConfirm={() => {
          setConfirmCopy(false);
          void copyLastMonth(true);
        }}
        onCancel={() => setConfirmCopy(false)}
      />
    </div>
  );
}
