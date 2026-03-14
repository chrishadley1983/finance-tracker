'use client';

import { AppLayout } from '@/components/layout';

export default function PetsPage() {
  return (
    <AppLayout title="Pets">
      <div className="-m-6 min-h-[calc(100vh-4rem)]">
        <iframe
          src="/pets-standalone.html"
          className="w-full h-[calc(100vh-4rem)] border-0"
          title="Pet Playground"
          allow="autoplay"
        />
      </div>
    </AppLayout>
  );
}
