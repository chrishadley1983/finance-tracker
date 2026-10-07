/**
 * Month-close readiness (GET /api/monthly-reports/readiness) as a plain-English
 * checklist for the Reports page: one line per check, each failing line
 * linking to where it can be fixed. Pure; client-safe.
 */
import { MONTH_NAMES } from '@/lib/format';
import type { MonthReadiness, ReadinessCheck } from './readiness';

export interface ChecklistItem {
  key: ReadinessCheck['key'] | 'changed';
  ok: boolean;
  text: string;
  href?: string;
  linkLabel?: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  if (names.length > 3) return `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`;
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const sentence = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export function readinessChecklist(r: MonthReadiness): ChecklistItem[] {
  const monthName = MONTH_NAMES[r.month - 1];
  const last = new Date(Date.UTC(r.year, r.month, 0)).getUTCDate();
  const dateFrom = `${r.year}-${pad(r.month)}-01`;
  const dateTo = `${r.year}-${pad(r.month)}-${pad(last)}`;
  const items: ChecklistItem[] = [];

  for (const c of r.checks) {
    switch (c.key) {
      case 'wealth':
        items.push(
          c.ok
            ? { key: 'wealth', ok: true, text: `${monthName} closing balances entered` }
            : {
                key: 'wealth',
                ok: false,
                text: `${monthName} balances not entered for ${joinNames(c.missing ?? [])}`,
                href: '/wealth',
                linkLabel: 'Enter balances',
              }
        );
        break;
      case 'synced':
        items.push(
          c.ok
            ? { key: 'synced', ok: true, text: sentence(c.detail) }
            : { key: 'synced', ok: false, text: sentence(c.detail), href: '/settings/bank-sync', linkLabel: 'Sync accounts' }
        );
        break;
      case 'categorised': {
        const n = c.count ?? 0;
        items.push(
          c.ok
            ? { key: 'categorised', ok: true, text: `Every ${monthName} transaction categorised` }
            : { key: 'categorised', ok: false, text: `${plural(n, 'transaction')} uncategorised or flagged`, href: '/review', linkLabel: 'Review them' }
        );
        break;
      }
      case 'validated': {
        const n = c.count ?? 0;
        const by = Object.entries(c.byAccount ?? {})
          .sort((a, b) => b[1] - a[1])
          .map(([name, count]) => `${name} ${count}`);
        items.push(
          c.ok
            ? { key: 'validated', ok: true, text: `Every ${monthName} transaction validated` }
            : {
                key: 'validated',
                ok: false,
                text: `${plural(n, 'transaction')} not validated${by.length > 1 ? ` (${by.slice(0, 3).join(', ')}${by.length > 3 ? ', …' : ''})` : by.length === 1 ? ` in ${by[0].replace(/ \d+$/, '')}` : ''}`,
                href: `/transactions?dateFrom=${dateFrom}&dateTo=${dateTo}`,
                linkLabel: 'Open transactions',
              }
        );
        break;
      }
    }
  }

  if (r.reportExists && r.changedSinceReport) {
    items.push({
      key: 'changed',
      ok: false,
      text:
        r.lateTransactions > 0
          ? `${plural(r.lateTransactions, 'transaction')} arrived after the saved report`
          : `${monthName}'s figures changed after the saved report`,
    });
  }
  return items;
}

/** One line on where the month stands. */
export function readinessHeadline(r: MonthReadiness): string {
  const open = readinessChecklist(r).filter((i) => !i.ok).length;
  switch (r.action) {
    case 'none':
      return `The saved ${r.monthLabel} report is up to date.`;
    case 'regenerate':
      return `${r.monthLabel} changed after its report was saved. Regenerate it to pick up the changes.`;
    case 'generate':
      return `${r.monthLabel} is ready to report.`;
    default:
      return `${r.monthLabel} has ${plural(open, 'thing')} to finish before its report is complete.`;
  }
}
