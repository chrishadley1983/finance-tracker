import { NextRequest, NextResponse } from 'next/server';
import { listMonthlyReports, getMonthlyReportHtml } from '@/lib/reports/aggregate';

/**
 * GET /api/monthly-reports/list
 *
 * Without query params: list all saved monthly reports.
 * With ?year=YYYY&month=MM: return the stored HTML for that report.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const month = searchParams.get('month');

    // If year and month provided, return stored HTML for that report
    if (year && month) {
      const html = await getMonthlyReportHtml(Number(year), Number(month));
      if (!html) {
        return NextResponse.json(
          { error: 'No stored report found for this month' },
          { status: 404 },
        );
      }
      return new NextResponse(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      });
    }

    // Otherwise list all reports
    const reports = await listMonthlyReports();
    return NextResponse.json(reports);
  } catch (error) {
    console.error('Error fetching monthly reports:', error);
    return NextResponse.json(
      { error: 'Failed to fetch monthly reports' },
      { status: 500 },
    );
  }
}
