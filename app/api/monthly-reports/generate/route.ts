import { NextRequest, NextResponse } from 'next/server';
import { aggregateMonthlyReport, saveMonthlyReport } from '@/lib/reports/aggregate';
import { generateMonthlyReportHtml } from '@/lib/reports/monthly-html';

/**
 * POST /api/monthly-reports/generate
 *
 * Generate (and optionally save) a monthly finance report.
 * Body: { year: number, month: number, save?: boolean, format?: 'json' | 'html' }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const year = Number(body.year);
    const month = Number(body.month);

    if (!year || !month || month < 1 || month > 12) {
      return NextResponse.json(
        { error: 'Invalid year or month' },
        { status: 400 },
      );
    }

    const report = await aggregateMonthlyReport(year, month);
    const html = generateMonthlyReportHtml(report);

    if (body.save !== false) {
      await saveMonthlyReport(report, html);
    }

    if (body.format === 'html') {
      return new NextResponse(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': `inline; filename="report-${year}-${String(month).padStart(2, '0')}.html"`,
        },
      });
    }

    return NextResponse.json(report);
  } catch (error) {
    console.error('Monthly report generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate monthly report' },
      { status: 500 },
    );
  }
}
