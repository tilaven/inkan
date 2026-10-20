/** Due dates in the reader's local time zone, as the browser scripts of the review pages use them. Dates are plain `YYYY-MM-DD` strings. */
import { DEADLINE_SOON, daysUntil, urgency } from '../../../lib/calendar.mjs';
import { t } from './i18n';

export { DEADLINE_SOON, daysUntil, urgency };

export type Urgency = ReturnType<typeof urgency>;

/** The short chip: `D-3`, `D-DAY`, `D+2` (`due.tag*` keys). */
export function dTag(days: number): string {
  return days === 0 ? t('due.tagToday') : days > 0 ? t('due.tagBefore', { count: days }) : t('due.tagAfter', { count: -days });
}

/** `3 days late`, `today`, `in 1 day`. */
export function dueText(days: number): string {
  return days < 0 ? t('due.late', { count: -days }) : days === 0 ? t('due.today') : t('due.in', { count: days });
}

/** How many of the `YYYY-MM-DD` dates are before `today`. */
export const overdueCount = (dates: string[], today = new Date()) => dates.filter((d) => daysUntil(d, today) < 0).length;

export interface DueRow {
  row: HTMLElement;
  days: number;
  level: Urgency;
}

/**
 * Fills the due cell of each `.bl__row[data-review-by]` from today's date, so a static page never goes stale:
 * the `is-overdue`/`is-soon` state, the `D-n` chip in `.bl__d b` and the sentence in `[data-due]`.
 * Returns each row with its days and urgency, in the given order.
 */
export function stampDueRows(rows: Iterable<HTMLElement>, soon: number, today = new Date()): DueRow[] {
  const stamped: DueRow[] = [];
  for (const row of rows) {
    const days = daysUntil(row.dataset.reviewBy!, today);
    const level = urgency(days, soon);
    row.classList.remove('is-overdue', 'is-soon');
    if (level !== 'later') row.classList.add(`is-${level}`);
    const tag = row.querySelector('.bl__d b');
    if (tag) tag.textContent = dTag(days);
    const text = row.querySelector('[data-due]');
    if (text) text.textContent = dueText(days);
    stamped.push({ row, days, level });
  }
  return stamped;
}

export function formatLongDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
