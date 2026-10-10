'use client';

import { Suspense } from 'react';
import { AppLayout } from '@/components/layout';
import { SkeletonRows } from '@/components/ui/Notice';
import { SubscriptionsPageContent } from '@/components/subscriptions/SubscriptionsPageContent';

export default function SubscriptionsPage() {
  // AppLayout sits above the content so the content can use useToast().
  return (
    <AppLayout title="Subscriptions">
      <Suspense fallback={<SkeletonRows rows={6} />}>
        <SubscriptionsPageContent />
      </Suspense>
    </AppLayout>
  );
}
