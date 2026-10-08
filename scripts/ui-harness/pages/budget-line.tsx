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
/** ?scope=year|month presses that figures toggle once the panel has loaded. */
const scope = query.get('scope');

export default function BudgetLineHarness() {
  useEffect(() => {
    const t = setInterval(() => {
      const rows = Array.from(document.querySelectorAll<HTMLButtonElement>('main button[title$="details"], main button[title*=": details for"]'));
      const target = open ? rows.find((b) => b.textContent?.trim() === open) : rows[0];
      if (target) {
        target.click();
        clearInterval(t);
        if (scope) {
          const press = setInterval(() => {
            const group = document.querySelector('[role="dialog"] [role="group"][aria-label="Figures for"]');
            const btn = group?.querySelectorAll('button')[scope === 'year' ? 1 : 0] as HTMLButtonElement | undefined;
            if (btn) {
              btn.click();
              clearInterval(press);
            }
          }, 150);
        }
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
