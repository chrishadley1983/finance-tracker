/**
 * UI harness entry: the Budgets page with one line's detail panel open.
 * Name the line with ?open=Eating%20out in --path (default: the first line).
 * Dev tool only; not part of the app build.
 */
import { Suspense, useEffect } from 'react';
import { AppLayout } from '@/components/layout';
import { BudgetsView } from '@/components/budgets';

const query = new URLSearchParams((window as unknown as { __path: string }).__path.split('?')[1] ?? '');
const open = query.get('open');

export default function BudgetLineHarness() {
  useEffect(() => {
    const t = setInterval(() => {
      const rows = Array.from(document.querySelectorAll<HTMLButtonElement>('main button[title$="details"], main button[title*=": details for"]'));
      const target = open ? rows.find((b) => b.textContent?.trim() === open) : rows[0];
      if (target) {
        target.click();
        clearInterval(t);
      }
    }, 150);
    return () => clearInterval(t);
  }, []);
  return (
    <AppLayout title="Budgets">
      <Suspense fallback={null}>
        <BudgetsView />
      </Suspense>
    </AppLayout>
  );
}
