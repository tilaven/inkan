/**
 * Periodic reviews: decided records come back up for review on a date (`reviewBy`) or on an interval
 * (`reviewEvery`, counted from the last `reviewed` date or the record's `date`).
 * Dates are plain `YYYY-MM-DD` strings; see calendar.mjs for the day arithmetic.
 */

import { gitHistory, realpath } from './git.mjs';

const UNITS = { d: 'day', day: 'day', w: 'week', week: 'week', m: 'month', mo: 'month', month: 'month', y: 'year', yr: 'year', year: 'year' };
const INTERVAL = /^(\d{1,4})\s*([a-z]+)$/i;

/** `6 months`, `1 year`, `90d`, `2w` as `{ count, unit }` (at most 9999 of a unit); null when the text is not an interval. */
export function parseInterval(value) {
  if (value == null || value === false) return null;
  const m = INTERVAL.exec(String(value).trim());
  if (!m) return null;
  const word = m[2].toLowerCase();
  const unit = UNITS[word] ?? (word.length > 2 && word.endsWith('s') ? UNITS[word.slice(0, -1)] : undefined);
  const count = Number(m[1]);
  return unit && count > 0 ? { count, unit } : null;
}

/** True for values `reviewEvery` accepts: an interval, or `false` / `never` to opt out. */
export const isInterval = (value) => value === false || String(value).trim().toLowerCase() === 'never' || parseInterval(value) !== null;

const optOut = (value) => value === false || String(value).trim().toLowerCase() === 'never';

/** `YYYY-MM-DD` of a Date or date-like string; null for anything else. */
export function isoDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(value)) return null;
  const day = value.slice(0, 10);
  const parsed = new Date(`${day}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === day ? day : null;
}

/** `date` plus an interval; month and year steps clamp to the end of shorter months (Jan 31 + 1 month = Feb 28). */
export function addInterval(date, { count, unit }) {
  const [y, m, d] = date.split('-').map(Number);
  if (unit === 'day' || unit === 'week') {
    return new Date(Date.UTC(y, m - 1, d + count * (unit === 'week' ? 7 : 1))).toISOString().slice(0, 10);
  }
  const months = m - 1 + count * (unit === 'year' ? 12 : 1);
  const last = new Date(Date.UTC(y, months + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, months, Math.min(d, last))).toISOString().slice(0, 10);
}

/** Statuses whose records get periodic reviews: `reviews.statuses`, else the `current` ones. */
export function reviewStatuses(config) {
  const statuses = config.statuses ?? {};
  return config.reviews?.statuses ?? Object.keys(statuses).filter((s) => statuses[s].current);
}

/**
 * When a record is next due for review, or null when it has no schedule.
 * An explicit `reviewBy` wins until a `reviewed` date on or after it; then the interval takes over.
 * The interval comes from the record, its project, then the site (`reviews.every`); `false`/`never` stops it.
 * @param {{ status?: string, date?: unknown, reviewBy?: unknown, reviewed?: unknown, reviewEvery?: unknown }} data
 * @param {{ statuses: string[], projectEvery?: unknown, siteEvery?: unknown }} opts
 * @returns {{ due: string, reviewed: string | null, every: string | null, from: 'reviewBy' | 'interval' } | null}
 */
export function nextReview(data, { statuses, projectEvery, siteEvery }) {
  if (!data.status || !statuses.includes(String(data.status))) return null;
  const reviewed = isoDate(data.reviewed);
  const reviewBy = isoDate(data.reviewBy);
  const raw = [data.reviewEvery, projectEvery, siteEvery].find((v) => v != null && v !== '');
  const every = raw == null || optOut(raw) ? null : parseInterval(raw);
  const label = every ? `${every.count} ${every.unit}${every.count === 1 ? '' : 's'}` : null;
  if (reviewBy && !(reviewed && reviewed >= reviewBy)) return { due: reviewBy, reviewed, every: label, from: 'reviewBy' };
  const base = reviewed ?? isoDate(data.date);
  if (!every || !base) return null;
  return { due: addInterval(base, every), reviewed, every: label, from: 'interval' };
}

/** `nextReview` options for one project of a resolved config (`projects` as from loadProjects). */
export const reviewOptions = (config, projects, project) => ({
  statuses: reviewStatuses(config),
  projectEvery: projects?.get(project)?.data?.reviewEvery,
  siteEvery: config.reviews?.every,
});

/**
 * `nextReview` for records of a resolved config (as from loadRecords), with the project and site intervals applied.
 * A record without `date` falls back to its first commit when `git.dates` is on, as on the site.
 * @returns {(record: { file: string, project: string, data: Record<string, unknown> }) => ReturnType<typeof nextReview>}
 */
export function reviewSchedule(config, projects) {
  const statuses = reviewStatuses(config);
  let history;
  const created = (file) => {
    if (config.git?.dates === false) return undefined;
    history ??= gitHistory([config.contentDir, ...(config.sources ?? []).filter((s) => !s.repo).map((s) => s.contentDir)]) ?? new Map();
    return (history.get(realpath(file)) ?? history.get(file))?.created;
  };
  return (r) => {
    const opts = { statuses, projectEvery: projects?.get(r.project)?.data?.reviewEvery, siteEvery: config.reviews?.every };
    if (r.data.date != null || !statuses.includes(String(r.data.status))) return nextReview(r.data, opts);
    return nextReview({ ...r.data, date: created(r.file) }, opts);
  };
}
