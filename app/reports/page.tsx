'use client';

import { Suspense } from 'react';
import { AppLayout } from '@/components/layout';
import { SkeletonRows } from '@/components/ui/Notice';
import { ReportsView } from '@/components/reports/ReportsView';

export default function ReportsPage() {
  return (
    <AppLayout title="Monthly reports">
      <Suspense fallback={<SkeletonRows rows={5} />}>
        <ReportsView />
      </Suspense>
    </AppLayout>
  );
}
