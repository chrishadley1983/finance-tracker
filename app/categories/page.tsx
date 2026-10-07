'use client';

import { Suspense } from 'react';
import { AppLayout } from '@/components/layout';
import { SkeletonRows } from '@/components/ui/Notice';
import { CategoriesPageContent } from '@/components/categories/CategoriesPageContent';

export default function CategoriesPage() {
  // AppLayout sits above the content so the content can use useToast().
  return (
    <AppLayout title="Categories">
      <Suspense fallback={<SkeletonRows rows={8} />}>
        <CategoriesPageContent />
      </Suspense>
    </AppLayout>
  );
}
