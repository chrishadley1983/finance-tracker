'use client';

import { Suspense } from 'react';
import { AppLayout } from '@/components/layout';
import { SkeletonRows } from '@/components/ui/Notice';
import { FirePageContent } from '@/components/fire/FirePageContent';

export default function FirePage() {
  // AppLayout sits above the content so the content can use useToast().
  return (
    <AppLayout title="FIRE">
      <Suspense fallback={<SkeletonRows rows={6} />}>
        <FirePageContent />
      </Suspense>
    </AppLayout>
  );
}
