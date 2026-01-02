'use client';

import { AppLayout } from '@/components/layout';
import { ImportWizard } from '@/components/import';

export default function ImportPage() {
  return (
    <AppLayout title="Import Transactions">
      <div className="max-w-4xl mx-auto">
        <ImportWizard />
      </div>
    </AppLayout>
  );
}
