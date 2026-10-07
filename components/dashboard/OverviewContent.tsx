'use client';

import { useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageIntro } from '@/components/ui/PageIntro';
import { Panel } from '@/components/ui/Panel';
import { useDashboardData } from '@/lib/hooks/useDashboardData';
import {
  buildLede,
  isCurrentMonth,
  monthElapsed,
  monthKey,
  monthRange,
  monthShort,
  parseMonthParam,
  type YearMonth,
} from '@/lib/dashboard/overview';
import { MonthNav } from './MonthNav';
import { NetWorthFigure } from './NetWorthFigure';
import { OverviewLede } from './OverviewLede';
import { BudgetPace, overBudget } from './BudgetPace';
import { NetByMonth } from './NetByMonth';
import { SpendingByCategory } from './SpendingByCategory';
import { ComingUp } from './ComingUp';
import { RecentTransactions } from './RecentTransactions';
import { FireLine } from './FireLine';
import { SectionError, SectionState } from './Section';

const more = 'text-[12.5px] text-accent hover:underline';

/** The Overview: one month at a time, chosen with ?month=YYYY-MM. */
export function OverviewContent() {
  const router = useRouter();
  const params = useSearchParams();
  const monthParam = params.get('month');
  const month = useMemo(() => parseMonthParam(monthParam), [monthParam]);
  const live = isCurrentMonth(month);
  const { start, end } = monthRange(month);
  const data = useDashboardData(month);

  const goTo = useCallback(
    (m: YearMonth) => router.push(isCurrentMonth(m) ? '/' : `/?month=${monthKey(m)}`, { scroll: false }),
    [router]
  );

  const pace = live ? monthElapsed(month) : undefined;
  const monthQuery = `month=${monthKey(month)}`;

  return (
    <div className="grid gap-7">
      <PageIntro aside={<NetWorthFigure month={month} current={data.netWorth} history={data.netWorthHistory} />}>
        <MonthNav month={month} onChange={goTo} />
        <div className="mt-2 min-h-[3.2em]">
          {data.savings.isLoading ? (
            <div className="grid max-w-[60ch] gap-2 pt-1" aria-busy="true" aria-label="Loading summary">
              <div className="h-4 w-full animate-pulse rounded bg-line-2" />
              <div className="h-4 w-2/3 animate-pulse rounded bg-line-2" />
            </div>
          ) : data.savings.error || !data.savings.data ? (
            <SectionError what="this month's summary" error={data.savings.error} onRetry={data.savings.retry} />
          ) : (
            <OverviewLede
              parts={buildLede({
                month,
                spent: Math.abs(data.savings.data.totalExpenseActual),
                plan: Math.abs(data.savings.data.totalExpenseBudget),
                income: Math.max(data.savings.data.totalIncomeActual, 0),
                overCategories: data.budgets.data ? overBudget(data.budgets.data) : [],
                uncategorised: data.uncategorised.data ?? 0,
              })}
            />
          )}
        </div>
      </PageIntro>

      <div className="grid gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <div className="grid min-w-0 content-start gap-8">
          <Panel
            title="Budget pace"
            action={
              <Link href={`/budgets?${monthQuery}`} className={more}>
                All budgets →
              </Link>
            }
          >
            <SectionState resource={data.budgets} what="budgets" rows={6}>
              {(rows) => <BudgetPace rows={rows} pace={pace} budgetsHref={`/budgets?${monthQuery}`} />}
            </SectionState>
          </Panel>

          <Panel title="What's left each month" action={<span>Income minus spending</span>}>
            <SectionState resource={data.trend} what="the monthly totals" rows={5}>
              {(trend) => <NetByMonth trend={trend} />}
            </SectionState>
          </Panel>

          <Panel
            title={`Spending by category${live ? '' : `, ${monthShort(month)} ${month.year}`}`}
            action={
              <Link href={`/transactions?dateFrom=${start}&dateTo=${end}`} className={more}>
                Transactions →
              </Link>
            }
          >
            <SectionState resource={data.categorySpend} what="spending by category" rows={6}>
              {(rows) => <SpendingByCategory data={rows} dateFrom={start} dateTo={end} />}
            </SectionState>
          </Panel>
        </div>

        <div className="grid min-w-0 content-start gap-8">
          <Panel
            title="Coming up"
            action={
              <Link href="/subscriptions" className={more}>
                Subscriptions →
              </Link>
            }
          >
            <SectionState resource={data.upcoming} what="upcoming bills" rows={3}>
              {(subs) => <ComingUp subscriptions={subs} />}
            </SectionState>
          </Panel>

          <Panel
            title="Latest"
            action={
              <Link href={`/transactions?dateFrom=${start}&dateTo=${end}`} className={more}>
                All →
              </Link>
            }
          >
            <SectionState resource={data.latest} what="recent transactions" rows={5}>
              {(rows) => <RecentTransactions transactions={rows} />}
            </SectionState>
          </Panel>

          <Panel
            title="Financial independence"
            action={
              <Link href="/fire" className={more}>
                FIRE plan →
              </Link>
            }
          >
            <SectionState resource={data.fire} what="the FIRE projection" rows={2}>
              {(fire) => <FireLine data={fire} />}
            </SectionState>
          </Panel>
        </div>
      </div>
    </div>
  );
}
