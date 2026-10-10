'use client';

import { Suspense } from 'react';
import { AppLayout } from '@/components/layout';
import { TransactionsPageContent } from '@/components/transactions/TransactionsPageContent';

export default function TransactionsPage() {
  // AppLayout sits above the content so the content can use useToast().
  return (
    <AppLayout title="Transactions">
      <Suspense fallback={
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
        </div>
      }>
        <TransactionsPageContent />
      </Suspense>
    </AppLayout>
  );
}
