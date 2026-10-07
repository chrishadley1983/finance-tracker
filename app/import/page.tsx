'use client';

import { AppLayout } from '@/components/layout';
import { ImportWizard } from '@/components/import';

export default function ImportPage() {
  return (
    <AppLayout title="Import">
      <div className="max-w-5xl">
        <ImportWizard />
      </div>
    </AppLayout>
  );
}
