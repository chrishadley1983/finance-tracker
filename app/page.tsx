'use client';

import { Suspense } from 'react';
import { AppLayout } from '@/components/layout';
import { SkeletonRows } from '@/components/ui/Notice';
import { OverviewContent } from '@/components/dashboard';

export default function OverviewPage() {
  return (
    <AppLayout title="Overview">
      <Suspense fallback={<SkeletonRows rows={6} />}>
        <OverviewContent />
      </Suspense>
    </AppLayout>
  );
}
