'use client';

import { usePathname } from 'next/navigation';
import { AppLayout } from '@/components/layout';
import { ReportView } from '@/components/reports/ReportView';

/** /reports/YYYY-MM: one saved monthly report. */
export default function MonthlyReportPage({ params }: { params?: { month?: string } }) {
  const pathname = usePathname() ?? '';
  const month = params?.month ?? pathname.split('/').filter(Boolean).pop() ?? '';
  return (
    <AppLayout title="Monthly report">
      <ReportView month={decodeURIComponent(month)} />
    </AppLayout>
  );
}
