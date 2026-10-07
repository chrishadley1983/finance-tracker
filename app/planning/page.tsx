'use client';

import { Suspense } from 'react';
import { AppLayout } from '@/components/layout';
import { PlanningNotes } from '@/components/planning/PlanningNotes';
import { SkeletonRows } from '@/components/ui/Notice';

export default function PlanningPage() {
  // AppLayout sits above the content so the content can use useToast().
  return (
    <AppLayout title="Notes">
      <Suspense fallback={<SkeletonRows rows={6} />}>
        <PlanningNotes />
      </Suspense>
    </AppLayout>
  );
}
