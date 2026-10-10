'use client';

import { Suspense } from 'react';
import { AppLayout } from '@/components/layout';
import { SkeletonRows } from '@/components/ui/Notice';
import { AccountsPageContent } from '@/components/accounts/AccountsPageContent';

export default function AccountsPage() {
  // AppLayout sits above the content so the content can use useToast().
  return (
    <AppLayout title="Accounts">
      <Suspense fallback={<SkeletonRows rows={8} />}>
        <AccountsPageContent />
      </Suspense>
    </AppLayout>
  );
}
