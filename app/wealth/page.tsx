'use client';

import { Suspense } from 'react';
import { AppLayout } from '@/components/layout';
import { SkeletonRows } from '@/components/ui/Notice';
import { WealthPageContent } from '@/components/wealth/WealthPageContent';

export default function WealthPage() {
  // AppLayout sits above the content so the content can use useToast().
  return (
    <AppLayout title="Net worth">
      <Suspense fallback={<SkeletonRows rows={6} />}>
        <WealthPageContent />
      </Suspense>
    </AppLayout>
  );
}
