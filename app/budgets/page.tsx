'use client';

import { Suspense } from 'react';
import { AppLayout } from '@/components/layout';
import { SkeletonRows } from '@/components/ui/Notice';
import { BudgetsView } from '@/components/budgets';

export default function BudgetsPage() {
  // AppLayout sits above the content so the content can use useToast().
  return (
    <AppLayout title="Budgets">
      <Suspense fallback={<SkeletonRows rows={6} />}>
        <BudgetsView />
      </Suspense>
    </AppLayout>
  );
}
