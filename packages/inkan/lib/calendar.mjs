/**
 * Calendar-day arithmetic on plain `YYYY-MM-DD` strings, shared by the CLI, the build and browser scripts (no Node imports).
 * "Today" is the local calendar day of whoever runs the code, never the UTC one: a reader or an `inkan new` at 00:30 in
 * Warsaw is on a different day from UTC, and the record dates they compare against are local days too.
 */

const MS_PER_DAY = 864e5;

/** Days before a `reviewBy` deadline from which an open record counts as due soon on the backlog. Not configurable. */
export const DEADLINE_SOON = 7;

/** Local calendar day of `date` as `YYYY-MM-DD`. */
export function isoDay(date = new Date()) {
  const pad = (v) => String(v).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Today's local calendar day as `YYYY-MM-DD`. */
export const today = () => isoDay();

/** Whole days from `from` to `to`, both `YYYY-MM-DD`; negative when `to` is earlier. */
export function daysBetween(from, to) {
  return Math.round((Date.parse(to) - Date.parse(from)) / MS_PER_DAY);
}

/** Whole calendar days from `now` (a Date, read as a local day) to `date`; negative when `date` is in the past. */
export function daysUntil(date, now = new Date()) {
  return daysBetween(isoDay(now), date);
}

/**
 * `overdue` when past, `soon` within `soon` days (today included), else `later`.
 * `soon` is `reviews.soon` for periodic reviews and `DEADLINE_SOON` for `reviewBy` deadlines.
 * @param {number} days
 * @param {number} soon
 * @returns {'overdue' | 'soon' | 'later'}
 */
export function urgency(days, soon) {
  return days < 0 ? 'overdue' : days <= soon ? 'soon' : 'later';
}
